/** Source-backed comparison. Reads sources/catalogue; never writes to Supabase.
 * --url=https://... (repeat), --ai, --catalog, --follow, --max-pages=6
 * --replay=directory reuses archived inputs and saved deterministic results.
 */
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractEvents, combineExtractedEvents, type ExtractResult } from "../src/lib/watcher/core";
import { extractWithLlm } from "../src/lib/watcher/extractors/llm-calendar";
import { fetchPage } from "../src/lib/watcher/http";
import { sourceEditionExists, sourceEditionIsRepresented, type StoredEdition } from "../src/lib/catalog/source-yield";
import { createServerSupabase } from "../src/lib/supabase/server";
import { addUsage, NO_USAGE } from "../src/lib/llm/anthropic";
import { pickBestDuplicate } from "../src/lib/dedup";
import { asDedup, type MergeDuplicateRow } from "../src/lib/catalog/merge-duplicates";
import { isSiteIdentityName } from "../src/lib/watcher/extractors/generic";

config({ path: ".env.local", quiet: true });
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ai = process.argv.includes("--ai");
const catalog = process.argv.includes("--catalog");
const replay = arg("replay");
const out = resolve(arg("out") ?? "tmp/pipeline-audit");
const max = Number(arg("max-pages") ?? 6);
if (!Number.isInteger(max) || max < 1 || max > 30) throw new Error("max-pages must be between 1 and 30");
process.env.LLM_BUDGET_USD ??= "0.30";
process.env.LLM_LEDGER_PATH ??= resolve("tmp/llm-budget.json");
process.env.LLM_DAILY_BUDGET_USD ??= "2.50";
process.env.LLM_MONTHLY_BUDGET_USD ??= "25";
process.env.LLM_EXTRACTION_CACHE_DIR ??= resolve("tmp/extraction-cache");
type Archive = { url: string; html: string; fetchedAt: string; baseline: ExtractResult };
let catalogue: Promise<MergeDuplicateRow[]> | undefined;
function catalogueRows() {
  return catalogue ??= (async () => {
    const db = createServerSupabase();
    const rows: MergeDuplicateRow[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("events")
        .select("id,name,start_date,end_date,website_url,registration_url,series_id,fingerprint,disciplines,location:locations(name,municipality,lat,lng,country_code),series:series!events_series_id_fkey(name)")
        .eq("visibility", "public").is("merged_into_id", null).order("id").range(from, from + 999);
      if (error) throw error;
      rows.push(...data as unknown as MergeDuplicateRow[]);
      if (!data || data.length < 1000) break;
    }
    return rows;
  })();
}

async function representation(url: string, events: ExtractResult["events"]) {
  if (!catalog) return null;
  const db = createServerSupabase();
  const { data: source, error } = await db.from("watched_urls").select("id").eq("url", url).maybeSingle();
  if (error) throw error;
  const stored: StoredEdition[] = [];
  if (source) for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("event_sources")
      .select("external_id, event:events(start_date,end_date,visibility,merged_into_id)")
      .eq("watched_url_id", source.id).order("id").range(offset, offset + 999);
    if (error) throw error;
    for (const row of data ?? []) {
      const event = (Array.isArray(row.event) ? row.event[0] : row.event) as unknown as Omit<StoredEdition, "externalId"> | null;
      if (event) stored.push({ externalId: row.external_id, ...event });
    }
    if (!data || data.length < 1000) break;
  }
  const candidates = (await catalogueRows()).map(row => ({ row, event: asDedup(row) }));
  return events.map(e => {
    const match = pickBestDuplicate({ ...e, countryCode: e.countryHint, urls: [e.sourceUrl, e.websiteUrl, e.registrationUrl], disciplines: e.discipline }, candidates);
    return { name: e.name, date: e.startDate, sourceUrl: e.sourceUrl,
      result: sourceEditionIsRepresented(stored, e.externalId, e.startDate) ? "represented" :
        sourceEditionExists(stored, e.externalId, e.startDate) ? "hidden_or_merged" :
        match ? "likely_existing_cross_source" : "unrepresented_candidate_needs_review",
      match: match ? { id: match.row.id, name: match.row.name, score: match.score, reasons: match.reasons } : null };
  });
  // Unrepresented source identity does NOT mean a new race: another source may
  // already represent it. The normal identity resolver still has to check it.
}

async function main() {
  await mkdir(resolve(out, "sources"), { recursive: true });
  const queue: ({ url: string; archive?: Archive })[] = process.argv.filter(a => a.startsWith("--url=")).map(a => ({ url: a.slice(6) }));
  if (replay) for (const file of (await readdir(resolve(replay, "sources"))).sort()) {
    if (!file.endsWith(".json")) continue;
    const archive = JSON.parse(await readFile(resolve(replay, "sources", file), "utf8")) as Archive;
    queue.push({ url: archive.url, archive });
  }
  if (!queue.length) throw new Error("Supply --url=https://... or --replay=directory");
  const seen = new Set<string>();
  const results = [];
  let usage = NO_USAGE;
  for (const target of queue) {
    if (seen.size >= max) break;
    if (seen.has(target.url)) continue;
    seen.add(target.url);
    const started = Date.now();
    try {
      let archive = target.archive;
      if (!archive) {
        const page = await fetchPage(target.url, { retries: 1 });
        if (page.status >= 400) throw new Error(`HTTP ${page.status}`);
        archive = { url: target.url, html: page.html, fetchedAt: new Date().toISOString(),
          baseline: await extractEvents(target.url, page.html, { ai: false }) };
      }
      const key = createHash("sha256").update(target.url).digest("hex");
      await writeFile(resolve(out, "sources", `${key}.json`), JSON.stringify(archive, null, 2));
      const read = ai ? await extractWithLlm(target.url, archive.html) : null;
      if (read) usage = addUsage(usage, read.usage);
      const primary = archive.baseline.strategy === "generic" ? archive.baseline.events.filter(e => !isSiteIdentityName(e.name, target.url)) : archive.baseline.events;
      const events = read ? combineExtractedEvents(primary, read.events) : primary;
      const result = { url: target.url, fetchedAt: archive.fetchedAt, ms: Date.now() - started,
        baselineCount: archive.baseline.events.length, combinedCount: events.length,
        additionalCandidates: events.length - primary.length,
        removedWeakGenericCandidates: archive.baseline.events.length - primary.length,
        ai: read ? { ...read, events: undefined } : null,
        representation: await representation(target.url, events), events };
      results.push(result);
      console.log(JSON.stringify({ url: result.url, before: result.baselineCount, after: result.combinedCount,
        additionalCandidates: result.additionalCandidates, complete: !read?.truncated, costUsd: read?.usage.costUsd ?? 0 }));
      if (process.argv.includes("--follow") && !replay) {
        for (const url of read?.childUrls ?? []) if (!seen.has(url)) queue.push({ url });
      }
    } catch (error) {
      results.push({ url: target.url, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) });
      console.error(`SOURCE FAILED ${target.url}: ${String(error)}`);
    }
  }
  const report = { capturedAt: new Date().toISOString(), mode: "read_only", catalogueWrites: 0, ai, usage, results };
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: resolve(out, "report.json"), usage, sources: results.length, catalogueWrites: 0 }));
  if (results.some(r => "error" in r)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });

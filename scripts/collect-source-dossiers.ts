/**
 * Collect every available source into one local race dossier, including PDFs.
 * Read-only: writes files, never changes production events.
 * node scripts/with-node.cjs tsx --env-file=.env.local scripts/collect-source-dossiers.ts [--country=CZ] [--ids=id,id] [--max=100] [--render]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { gatherEventDossier, readSourceEvidence } from "../src/lib/catalog/source-evidence";
import { parseMtbs } from "../src/lib/watcher/extractors/mtbs";
import { mapPool } from "../src/lib/watcher/pool";
import type { ParsedEvent } from "../src/lib/domain";
import { config } from "dotenv";
import { readDocument, categoriesFromRegulationsText } from "../src/lib/catalog/regulation-ages";
import { editionDocs } from "../src/lib/catalog/dossier-classes";
import { localSourceReader, readJson, writeJsonAtomic } from "../src/lib/catalog/local-source-cache";
import { hostnameOf, hostIntervalMs, withHostGate } from "../src/lib/watcher/pool";
import { textHash } from "../src/lib/catalog/facts";

config({ path: ".env.local", quiet: true });

type Row = { id: string; name: string; start_date: string; website_url: string | null; registration_url: string | null; regulations_url: string | null; location: { country_code: string | null } | null; sources: { source_url: string; external_id: string; kind: string }[] };
const arg = (name: string, fallback: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;

async function main() {
  const s = createServerSupabase();
  const country = arg("country", "all");
  const ids = arg("ids", "").split(",").filter(Boolean);
  const max = Number(arg("max", "10000"));
  if (!Number.isInteger(max) || max < 1) throw new Error("--max must be a positive integer");
  const hours = Number(arg("hours", "6"));
  const concurrency = Number(arg("concurrency", "3"));
  const maxDocs = Number(arg("docs", "16"));
  if (!Number.isFinite(hours) || hours <= 0 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8 || !Number.isInteger(maxDocs) || maxDocs < 1 || maxDocs > 50) throw new Error("Invalid --hours, --concurrency or --docs");
  const deadline = Date.now() + hours * 3600000;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const output = resolve(arg("out", "tmp/source-dossiers"));
  await mkdir(output, { recursive: true });
  let stopped = false;
  const stop = () => { stopped = true; console.log("Finishing current reads and saving progress; rerun to resume."); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const reader = localSourceReader({ directory: resolve(output, "documents"), maxAgeMs: 24 * 3600000, deadline, stopped: () => stopped,
    read: url => withHostGate(hostnameOf(url), Math.max(500, hostIntervalMs(hostnameOf(url))), () => readDocument(url)) });
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = s.from("events").select("id,name,start_date,website_url,registration_url,regulations_url,location:locations(country_code),sources:event_sources(source_url,external_id,kind)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", ["scheduled", "confirmed", "tbc"])
      .gte("start_date", today).order("start_date").order("id").range(offset, offset + 499);
    if (ids.length) query = query.in("id", ids);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 500) break;
  }
  // Recover detail/rules links for older MTBS records that only kept the
  // organiser URL. Match by the adapter's stable external ID, never by guess.
  let mtbs: ParsedEvent[] = [];
  if (rows.some(r => r.sources.some(source => source.external_id?.startsWith("mtbs-")))) {
    try {
      const response = await fetch("https://mtbs.cz/sekce/kalendar", { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`MTBS calendar HTTP ${response.status}`);
      mtbs = await parseMtbs(response.url, await response.text());
    } catch (error) { console.error("MTBS refresh failed; continuing with saved source URLs:", error instanceof Error ? error.message : String(error)); }
  }
  const countries = country === "all" ? null : country.split(",");
  const targets = rows.filter(r => !countries || countries.includes(r.location?.country_code ?? "")).slice(0, max);
  const results = await mapPool(targets, concurrency, async race => {
    if (stopped || Date.now() >= deadline) return { id: race.id, name: race.name, pending: true };
    try {
      const extra = mtbs.filter(event => race.sources.some(source => source.external_id === event.externalId));
      const storedSourceEvidence = await readSourceEvidence(s, race.id);
      const signature = textHash(JSON.stringify({ race, extra, storedSourceEvidence, maxDocs, render: process.argv.includes("--render"), version: 2 }));
      const previous = await readJson<{ signature: string; collectedAt: string; complete: boolean; documents: unknown[] }>(resolve(output, `${race.id}.json`));
      if (!process.argv.includes("--again") && previous?.signature === signature && previous.complete && Date.now() - Date.parse(previous.collectedAt) < 24 * 3600000) {
        console.log(`CACHED ${race.start_date} ${race.name}`);
        return { id: race.id, name: race.name, cached: true, documents: previous.documents.length };
      }
      const attempted = new Set<string>();
      const docs = await gatherEventDossier(s, race.id, { startDate: race.start_date, website: race.website_url,
        registration: race.registration_url, regulations: race.regulations_url, sources: race.sources.map(source => source.source_url), render: process.argv.includes("--render"), maxDocs,
        read: url => { attempted.add(url.replace(/#.*$/, "")); return reader.read(url); } }, extra);
      const usable = editionDocs(docs, race.start_date, [race.name]);
      const categoryEvidence = usable.map(doc => ({ url: doc.url, ...categoriesFromRegulationsText(doc.text, Number(race.start_date.slice(0, 4))) })).filter(evidence => evidence.ages.length);
      const failedUrls = [...attempted].filter(url => reader.failures.has(url));
      const complete = !stopped && Date.now() < deadline && docs.length > 0 && !docs.some(doc => doc.thin) && failedUrls.length === 0;
      await writeJsonAtomic(resolve(output, `${race.id}.json`), { collectedAt: new Date().toISOString(), signature, complete, failedUrls, race, storedSourceEvidence, freshSourceEvidence: extra, documents: docs,
        enrichment: { categoryEvidence, statedAges: [...new Set(categoryEvidence.flatMap(e => e.ages))], rulesDocuments: docs.filter(d => d.kind === "regulations" || /propoz|reglement|regulamin|regolament|ausschreib|technical.?guide|\/rules|\.pdf/i.test(d.url)).map(d => ({ url: d.url, editionVerified: usable.includes(d) })), registrationDocuments: docs.filter(d => d.kind === "registration").map(d => d.url) } });
      const result = { id: race.id, name: race.name, date: race.start_date, sources: race.sources.length, documents: docs.length, editionDocuments: usable.length, thinDocuments: docs.filter(d => d.thin).length, statedClasses: categoryEvidence.length, complete };
      console.log(`${result.date} ${result.name}: ${result.sources} sources, ${result.documents} documents, ${result.editionDocuments} edition documents`);
      await writeJsonAtomic(resolve(output, "progress.json"), { updatedAt: new Date().toISOString(), lastEvent: result, downloads: reader.stats(), resumeCommand: "bash scripts/keep-fresh.sh --deep --hours=6" });
      return result;
    } catch (error) {
      const result = { id: race.id, name: race.name, error: error instanceof Error ? error.message : String(error) };
      console.error(result);
      return result;
    }
  });
  const summary = { collectedAt: new Date().toISOString(), country, events: results.length, pending: results.filter(r => "pending" in r).length, failed: results.filter(r => "error" in r).length, stopped, downloads: reader.stats(), failedUrls: [...reader.failures], documents: results.reduce((total, r) => total + ("documents" in r ? r.documents ?? 0 : 0), 0), results };
  await writeFile(resolve(output, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, results: undefined, output }));
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

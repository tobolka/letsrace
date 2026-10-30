/** Read-only by default. --apply registers monitoring and imports verified history.
 * Resumable source snapshots and per-event outcomes live in --out=<directory>.
 */
import { mkdirSync, readFileSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";
import { fetchPage } from "../src/lib/watcher/http";
import { NAKOLE_ARCHIVE, nakoleListings, nakoleLastPage, parseNakoleDetail } from "../src/lib/watcher/extractors/nakole";
import type { NakoleListing } from "../src/lib/watcher/extractors/nakole";
import { ingestNakoleArchiveEvent } from "../src/lib/watcher/run";
import { createServerSupabase } from "../src/lib/supabase/server";
import { mapPool } from "../src/lib/watcher/pool";
config({ path: ".env.local", quiet: true });
const apply = process.argv.includes("--apply");
const out = resolve(process.argv.find(s => s.startsWith("--out="))?.slice(6) ?? "reports/nakole-2026-2026-10-30");
process.env.CATALOG_OVERVIEW_ONLY = "1";
mkdirSync(join(out, "pages"), { recursive: true });
const today = new Date().toISOString().slice(0, 10);
async function document(url: string, key: string) {
  const file = join(out, "pages", `${key}.html`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  const r = await fetchPage(url);
  if (r.status !== 200 || !r.html) throw new Error(`HTTP ${r.status}: ${url}`);
  writeFileSync(file, r.html);
  appendFileSync(join(out, "fetches.jsonl"), JSON.stringify({ url, file, fetchedAt: new Date().toISOString(), hash: r.hash }) + "\n");
  return r.html;
}
async function main() {
  const first = await document(NAKOLE_ARCHIVE, "archive-1");
  const last = nakoleLastPage(first);
  if (last > 1000) throw new Error(`Unexpected archive size: ${last}`);
  const listings = new Map<string, NakoleListing>();
  const pageSignatures = new Set<string>();
  let pagesRead = 0;
  // Sequential pages and the shared host gate keep traffic modest.
  for (let page = 1; page <= last; page++) {
    const html = page === 1 ? first : await document(`${NAKOLE_ARCHIVE}?strana=${page}`, `archive-${page}`);
    const rows = nakoleListings(html);
    const signature = rows.map(r => r.url).join("|");
    if (!rows.length || pageSignatures.has(signature)) throw new Error(`Empty/repeated archive page ${page}`);
    pageSignatures.add(signature);
    pagesRead++;
    rows.filter(row => /\b2026\b/.test(row.date)).forEach(row => listings.set(row.url, row));
    // Archive is newest first. Stop at the first older edition; never fetch its details.
    if (rows.some(row => /\b20\d{2}\b/.test(row.date) && Math.max(...[...row.date.matchAll(/\b(20\d{2})\b/g)].map(m => Number(m[1]))) < 2026)) break;
    if (page % 25 === 0 || page === last) console.log(JSON.stringify({ phase: "archive", page, last, entries: listings.size }));
  }
  const candidates = [...listings.values()].filter(row => row.type.toLowerCase() === "závod");
  const excluded = [...listings.values()].filter(row => row.type.toLowerCase() !== "závod").map(row => ({ ...row, reason: "listing_not_race" }));
  const failures: { url: string; error: string }[] = [];
  const accepted = (await mapPool(candidates, 2, async (row, i) => {
    try {
      const parsed = parseNakoleDetail(row.url, await document(row.url, `event-${new URL(row.url).pathname.match(/\/(\d+)-/)![1]}`));
      if (!parsed.event) { excluded.push({ ...row, reason: parsed.reason ?? "unresolved" }); return; }
      const event = parsed.event;
      if ((event.endDate ?? event.startDate) >= today || !event.startDate.startsWith("2026-")) { excluded.push({ ...row, reason: "outside_2026_history" }); return; }
      if (i % 50 === 0) console.log(JSON.stringify({ phase: "details", read: i + 1, total: candidates.length }));
      return event;
    } catch (e) { failures.push({ url: row.url, error: String(e) }); }
  })).filter(ev => ev != null);
  writeFileSync(join(out, "accepted.json"), JSON.stringify(accepted, null, 2));
  writeFileSync(join(out, "excluded.json"), JSON.stringify(excluded, null, 2));
  writeFileSync(join(out, "failures.json"), JSON.stringify(failures, null, 2));
  const summary = { year: 2026, pagesRead, entries: listings.size, labelledRaces: candidates.length, accepted: accepted.length, excluded: excluded.length, failures: failures.length, apply };
  writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  if (!apply) return;
  if (failures.length) throw new Error("Incomplete source read; rerun to retry before applying");
  const db = createServerSupabase();
  const { data: existing, error: readError } = await db.from("watched_urls").select("id,status").eq("url", NAKOLE_ARCHIVE).maybeSingle();
  if (readError) throw readError;
  if (existing && existing.status !== "active") throw new Error("Existing source is paused/dead; preserved for explicit review");
  if (!existing) {
    const { error } = await db.from("watched_urls").insert({ url: NAKOLE_ARCHIVE, kind: "aggregator", status: "active", added_by: "admin",
      notes: "NaKole archive: 2026 backfill only; entries labelled závod AND cycling competition verified on detail. Normal polls read the latest page and never infer removal. No rides, tours, camps, talks or exhibitions.", next_poll_at: new Date().toISOString() });
    if (error) throw error;
  }
  const { data: source, error } = await db.from("watched_urls").select("id").eq("url", NAKOLE_ARCHIVE).single();
  if (error) throw error;
  const resultFile = join(out, "writes.jsonl");
  const done = new Set(existsSync(resultFile) ? readFileSync(resultFile, "utf8").trim().split("\n").filter(Boolean).map(s => JSON.parse(s)).filter(r => r.ok).map(r => r.externalId) : []);
  // Preserve all normal identity/manual-lock/source-authority protections.
  await mapPool(accepted.filter(ev => !done.has(ev.externalId)), 3, async ev => {
    try {
      const result = await ingestNakoleArchiveEvent(ev, source.id);
      if (!result) throw new Error("Rejected by normal ingestion policy");
      appendFileSync(resultFile, JSON.stringify({ externalId: ev.externalId, url: ev.sourceUrl, ok: true, ...result }) + "\n");
      done.add(ev.externalId);
      if (done.size % 25 === 0) console.log(JSON.stringify({ phase: "write", done: done.size, total: accepted.length }));
    } catch (e) { appendFileSync(resultFile, JSON.stringify({ externalId: ev.externalId, url: ev.sourceUrl, ok: false, error: String(e) }) + "\n"); }
  });
  console.log(JSON.stringify({ phase: "complete", written: done.size, total: accepted.length, deferred: accepted.length - done.size }));
  if (done.size !== accepted.length) process.exitCode = 2;
}
main().catch(e => { console.error(e); process.exitCode = 1; });

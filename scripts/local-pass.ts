/**
 * Big passes on this Mac, so the server is spared: one catalogue snapshot, then any
 * amount of reading and judging against a local database. Only `snapshot` talks to
 * the server, and it only reads. The other steps never load the server's credentials,
 * so they could not write there even by mistake. Every step resumes after a crash.
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/local-pass.ts <step> [options]
 *
 *   snapshot   Copy the catalogue to the Mac (--force to refresh one under a day old)
 *   read       Read sources, one request at a time per host (--limit= --concurrency= --max-age-hours=)
 *   csc        Read the federation calendar for each season, with Chrome (--years=2026,2027)
 *   extract    Turn stored pages into races, no AI (--concurrency=)
 *   evaluate   Compare with the snapshot and write the report (--target=2027)
 *   status     Show progress
 *   all        snapshot, read, csc, extract, evaluate
 *
 * --country=CZ limits the pass; --country=all reads every source.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { parse } from "dotenv";
import { openStore, nextForFreeHost, hostOf, type CatalogueEvent, type LocalStore } from "../src/lib/local-pass/store";
import { createComparer, editionCoverage, type ParsedRace } from "../src/lib/local-pass/compare";

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const number = (name: string, fallback: number) => {
  const value = Number(arg(name) ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw Error(`Invalid --${name}`);
  return value;
};
const step = process.argv[2] ?? "status";
const country = (arg("country") ?? "CZ").toUpperCase();
const target = number("target", 2027);
const EXTRACT_VERSION = "local-1";
const DAY = 86_400_000;

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
  if (stopping) process.exit(130);
  stopping = true;
  console.log("Stopping after the work in progress; the next run continues from here.");
});

async function snapshot(store: LocalStore) {
  const at = store.meta("snapshot_at");
  if (at && Date.now() - Date.parse(at) < DAY && !process.argv.includes("--force")) {
    console.log(`Snapshot from ${at} is still fresh; no server request made.`);
    return;
  }
  for (const [key, value] of Object.entries(parse(readFileSync(".env.local")))) process.env[key] ??= value;
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  let requests = 0;
  const pages = async <T extends { id: string }>(read: (after: string) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) => {
    const rows: T[] = [];
    for (let after = "00000000-0000-0000-0000-000000000000"; ;) {
      requests++;
      const { data, error } = await read(after);
      if (error) throw Error(error.message);
      rows.push(...data!);
      if (data!.length < 1000) return rows;
      after = data!.at(-1)!.id;
    }
  };
  const from = `${target - 1}-01-01`;
  const events = await pages(after => db.from("events")
    .select("id,name,start_date,end_date,status,visibility,event_type,series_id,disciplines,website_url,location:locations(lat,lng,municipality,country_code)")
    .is("merged_into_id", null).gte("start_date", from).gt("id", after).order("id").limit(1000));
  const known = new Set(events.map(row => row.id));
  const sources = await pages(after => db.from("event_sources").select("id,event_id,watched_url_id,external_id,source_url").gt("id", after).order("id").limit(1000));
  const watched = await pages(after => db.from("watched_urls").select("id,url,kind,status,added_by").gt("id", after).order("id").limit(1000));

  store.replaceCatalogue(events.map(({ location, ...row }) => ({
    ...row, lat: location?.lat ?? null, lng: location?.lng ?? null, municipality: location?.municipality ?? null, country_code: location?.country_code ?? null,
  })) as CatalogueEvent[], sources.filter(row => known.has(row.event_id)));

  // A source belongs to the pass through its races, or a national domain when it has none yet.
  const countries = new Map<string, Set<string>>();
  const eventCountry = new Map(events.map(row => [row.id, row.location?.country_code ?? null]));
  for (const row of sources) if (row.watched_url_id) {
    const set = countries.get(row.watched_url_id) ?? new Set<string>();
    const code = eventCountry.get(row.event_id);
    if (code) set.add(code);
    countries.set(row.watched_url_id, set);
  }
  const inScope = (id: string, url: string) => country === "ALL" || countries.get(id)?.has(country) || hostOf(url).endsWith(`.${country.toLowerCase()}`);
  const { isAuxiliaryDiscoveryUrl } = await import("../src/lib/watcher/discovery-policy");
  store.addSources(watched
    .filter(row => row.status === "active" && inScope(row.id, row.url) && !isAuxiliaryDiscoveryUrl(row.url) && !/portal\.czechcyclingfederation\.com/.test(row.url))
    .map(row => ({ url: row.url, origin: row.added_by === "season-successor" ? "guessed_next_year" : "watched", kind: row.kind, watched_url_id: row.id })));
  // Organisers' own sites of last year's races are where the next edition is announced.
  store.addSources(events
    .filter(row => row.website_url && row.start_date.startsWith(`${target - 1}-`) && (country === "ALL" || row.location?.country_code === country))
    .map(row => ({ url: row.website_url!, origin: "race_website" })));
  console.log(JSON.stringify({ snapshot: { events: events.length, sources: sources.length, watched: watched.length, serverRequests: requests } }));
}

async function read(store: LocalStore) {
  const { fetchPage } = await import("../src/lib/watcher/http");
  const concurrency = number("concurrency", 24), limit = number("limit", 1_000_000);
  // The federation calendar needs Chrome and has its own step.
  const now = Date.now(), queue = store.dueSources(now, now - number("max-age-hours", 24) * 3600_000).filter(row => row.origin !== "federation").slice(0, limit);
  const total = queue.length, busy = new Set<string>();
  let done = 0, ok = 0, failed = 0;
  console.log(`Reading ${total} sources, ${concurrency} at once.`);
  const worker = async () => {
    while (!stopping) {
      const item = nextForFreeHost(queue, busy);
      if (!item) {
        if (!queue.length) return;
        await new Promise(resolve => setTimeout(resolve, 200));
        continue;
      }
      const host = hostOf(item.url);
      busy.add(host);
      try {
        const page = await fetchPage(item.url, { fresh: true, timeoutMs: 20_000, retries: 1 });
        if (/pdf|octet-stream|image\//i.test(page.contentType ?? "")) { store.saveFailure(item.url, { state: "unsupported", status: page.status, error: page.contentType ?? undefined }, Date.now()); }
        else if (page.status === 200 && page.html) { store.saveRead(item.url, page, Date.now()); ok++; }
        else if (page.status === 404 || page.status === 410) { store.saveFailure(item.url, { state: "gone", status: page.status }, Date.now()); failed++; }
        else { store.saveFailure(item.url, { state: "error", status: page.status, error: `HTTP ${page.status}` }, Date.now()); failed++; }
      } catch (error) {
        store.saveFailure(item.url, { state: "error", error: error instanceof Error ? error.message : String(error) }, Date.now());
        failed++;
      } finally {
        busy.delete(host);
        if (++done % 50 === 0) console.log(`  ${done}/${total}: ${ok} read, ${failed} unavailable`);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(JSON.stringify({ read: { done, ok, failed, left: queue.length } }));
}

async function csc(store: LocalStore) {
  const { renderCscPublicCalendar } = await import("../src/lib/watcher/extractors/csc-render");
  const { parseCscPublicGrid } = await import("../src/lib/watcher/extractors/csc");
  const years = (arg("years") ?? `${target - 1},${target}`).split(",").map(Number);
  const url = "https://portal.czechcyclingfederation.com/Races/Race/Pub";
  const watchedId = store.sourceKeys().find(row => row.source_url?.includes("portal.czechcyclingfederation.com") && row.watched_url_id)?.watched_url_id ?? null;
  for (const year of years) {
    if (stopping) return;
    const key = `${url}#year=${year}`;
    store.addSources([{ url: key, origin: "federation", kind: "federation", watched_url_id: watchedId }]);
    try {
      const html = await renderCscPublicCalendar(url, { year });
      const events = parseCscPublicGrid(url, html);
      store.saveRead(key, { html, status: 200, hash: String(events.length) }, Date.now());
      store.saveExtraction(key, EXTRACT_VERSION, String(events.length), { strategy: "adapter:csc", complete: true, events });
      console.log(JSON.stringify({ csc: { year, races: events.length } }));
    } catch (error) {
      store.saveFailure(key, { state: "error", error: error instanceof Error ? error.message : String(error) }, Date.now());
      console.log(JSON.stringify({ csc: { year, error: error instanceof Error ? error.message : String(error) } }));
    }
  }
}

async function extract(store: LocalStore) {
  const { extractEvents } = await import("../src/lib/watcher/core");
  const queue = store.sourcesToExtract(EXTRACT_VERSION).filter(row => row.origin !== "federation");
  const total = queue.length;
  let done = 0, races = 0;
  console.log(`Extracting ${total} stored pages without AI.`);
  // Mostly CPU, but a page that needs Chrome can take half a minute.
  await Promise.all(Array.from({ length: number("concurrency", 6) }, async () => {
    while (!stopping) {
      const row = queue.shift();
      if (!row) return;
      try {
        const html = gunzipSync(row.body).toString("utf8");
        const result = await extractEvents(row.url, html, { ai: false, deadline: Date.now() + 90_000 });
        store.saveExtraction(row.url, EXTRACT_VERSION, row.hash, { strategy: result.strategy, complete: result.complete !== false, events: result.events });
        races += result.events.length;
      } catch (error) {
        store.saveExtractionFailure(row.url, error instanceof Error ? error.message : String(error));
      }
      if (++done % 50 === 0) console.log(`  ${done}/${total}: ${races} races`);
    }
  }));
  console.log(JSON.stringify({ extract: { done, races, left: queue.length } }));
}

function evaluate(store: LocalStore) {
  const events = store.catalogue();
  if (!events.length) throw Error("No snapshot yet; run the snapshot step first");
  const compare = createComparer(events, store.sourceKeys());
  const parsed = store.parsedEvents(`${target}-01-01`, `${target}-12-31`);
  const seen = new Map<string, { url: string; race: ParsedRace; decision: string; eventId?: string; reason?: string; sources: number }>();
  const rows = parsed.map(row => {
    const race = row.event as unknown as ParsedRace;
    const finding = compare(race, row.watched_url_id);
    const key = finding.eventId ?? `${race.startDate}|${race.name.toLowerCase().trim()}`;
    const held = seen.get(key);
    seen.set(key, held ? { ...held, sources: held.sources + 1 } : { url: row.url, race, ...finding, sources: 1 });
    return { url: row.url, externalId: race.externalId, name: race.name, startDate: race.startDate, ...finding };
  });
  store.saveFindings(rows);
  const unique = [...seen.values()];
  const found = unique.filter(item => item.decision === "new").map(item => item.race);
  const textOf = new Map<string, boolean>();
  const mentions = (row: CatalogueEvent) => {
    if (!row.website_url) return false;
    if (!textOf.has(row.website_url)) textOf.set(row.website_url, (store.pageText(row.website_url) ?? "").includes(String(target)));
    return textOf.get(row.website_url)!;
  };
  const scope = country === "ALL" ? [...new Set(events.map(row => row.country_code).filter(Boolean))] as string[] : [country];
  const coverage = scope.map(code => ({ country: code, ...editionCoverage(events, found.filter(race => !race.countryHint || race.countryHint === code), target, code, mentions) }));
  const count = (decision: string) => unique.filter(item => item.decision === decision).length;
  const report = {
    at: new Date().toISOString(), target, snapshotAt: store.meta("snapshot_at"), sources: store.sourceSummary(),
    racesRead: { rows: rows.length, unique: unique.length, known: count("known"), dateDiffers: count("date_differs"), review: count("review"), new: count("new") },
    coverage: coverage.map(({ rows: _rows, ...summary }) => summary),
    newRaces: unique.filter(item => item.decision === "new").map(item => ({ name: item.race.name, date: item.race.startDate, place: item.race.placeText, url: item.url })),
    dateDiffers: unique.filter(item => item.decision === "date_differs").map(item => ({ name: item.race.name, date: item.race.startDate, reason: item.reason, url: item.url })),
    review: unique.filter(item => item.decision === "review").map(item => ({ name: item.race.name, date: item.race.startDate, reason: item.reason, url: item.url })),
    failures: store.failures(),
  };
  writeFileSync(join(store.directory, `report-${target}.json`), JSON.stringify({ ...report, coverageRows: coverage.flatMap(c => c.rows) }, null, 2));
  console.log(JSON.stringify({ racesRead: report.racesRead, coverage: report.coverage, sources: report.sources, report: join(store.directory, `report-${target}.json`) }, null, 1));
}

async function main() {
  const store = openStore();
  try {
    if (step === "status") {
      console.log(JSON.stringify({ snapshotAt: store.meta("snapshot_at") ?? null, sources: store.sourceSummary() }, null, 1));
      return;
    }
    store.acquireLock();
    if (step === "snapshot" || step === "all") await snapshot(store);
    if ((step === "read" || step === "all") && !stopping) await read(store);
    if ((step === "csc" || step === "all") && !stopping) await csc(store);
    if ((step === "extract" || step === "all") && !stopping) await extract(store);
    if ((step === "evaluate" || step === "all") && !stopping) evaluate(store);
    if (!["snapshot", "read", "csc", "extract", "evaluate", "all"].includes(step)) throw Error(`Unknown step: ${step}`);
    if (stopping) process.exitCode = 2;
  } finally {
    store.releaseLock();
    store.close();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

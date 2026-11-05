/**
 * Second step after `local-sync.cjs plan`: move new races that fail the last checks,
 * and everything written for them, from the change set to the review file.
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/local-review-new.ts --plan=DIR [--work=DB] [--only-new-races]
 *
 * --only-new-races leaves in the change set just the new races that passed, with their
 * places, sources and evidence. A date not found again on the source is noted, not a stop:
 * calendars built by script show it only to the reader that already read them.
 *
 * Reads only the local copy and the plan's own files.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchPage } from "../src/lib/watcher/http";
import { pageAsText } from "../src/lib/watcher/extractors/llm-calendar";
import { quoteStatesDate } from "../src/lib/catalog/quoted-date";
import { newRaceProblems, type KnownRace, type NewRace, type Place } from "../src/lib/local-pass/new-race-check";

const given = process.argv.find(value => value.startsWith("--plan="))?.slice(7);
if (!given) throw Error("Use --plan=DIR");
const directory: string = given;
type Change = { tab: string; op: string; pk: { id?: string }; owner?: string; after?: Record<string, unknown>; before?: Record<string, unknown>; heldBecause?: string[] };
const parse = (file: string) => readFileSync(file, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line) as Change);
const changes = parse(join(directory, "changes.ndjson"));

const PSQL = `${process.env.LOCAL_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin"}/psql`;
const catalogue = JSON.parse(execFileSync(PSQL, ["-h", "127.0.0.1", "-p", "54329", "-U", "postgres", "-d", process.argv.find(value => value.startsWith("--work="))?.slice(7) ?? "letsrace", "-qAt", "-c",
  `select coalesce(json_agg(json_build_object('id', e.id, 'name', e.name, 'start_date', e.start_date, 'end_date', e.end_date, 'disciplines', e.disciplines, 'website_url', e.website_url, 'visibility', e.visibility,
    'place', json_build_object('municipality', l.municipality, 'name', l.name, 'country_code', l.country_code, 'lat', l.lat, 'lng', l.lng))), '[]')
   from public.events e left join public.locations l on l.id = e.location_id where e.merged_into_id is null and e.start_date >= current_date - 2`],
  { encoding: "utf8", maxBuffer: 2 ** 30, env: { ...process.env, LC_ALL: "en_US.UTF-8", NODE_OPTIONS: "" } })) as (KnownRace & { visibility: string })[];

const inserted = new Map<string | undefined, Place>(changes.filter(change => change.tab === "public.locations" && change.op === "insert").map(change => [change.pk.id, change.after as Place]));
const fromCopy = new Map(catalogue.map(row => [row.id, row.place]));
const newIds = new Set(changes.filter(change => change.tab === "public.events" && change.op === "insert").map(change => change.pk.id));
// Two new records of one race must not both pass, so new races are compared with each other too.
const known = catalogue.filter(row => row.visibility === "public" || newIds.has(row.id));
const sourced = new Set(changes.filter(change => change.tab === "public.event_sources" && change.op === "insert").map(change => change.owner ?? change.after?.event_id));
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Prague" });

/** Read the source again and require the date on it, not just a row claiming to come from it. */
async function dateIsOnSource(url: string, date: string) {
  try {
    const page = await fetchPage(url, { fresh: true, timeoutMs: 20_000, retries: 1 });
    if (page.status !== 200) return false;
    return quoteStatesDate(pageAsText(page.html, url).text, date) || quoteStatesDate(page.html, date);
  } catch { return false; }
}
const sourceUrls = new Map(changes.filter(change => change.tab === "public.event_sources" && change.op === "insert").map(change => [change.owner ?? change.after?.event_id as string, change.after?.source_url as string]));

async function main() {
const reasons = new Map<string | undefined, string[]>();
const summary: Record<string, number> = {}, kept: { name: string; date: string; place: string | null; country: string | null; source: string | null; dateSeenOnSource: boolean | null; id: string; location: string | null }[] = [], heldRaces: { name: string; date: string; because: string[] }[] = [];
for (const change of changes) {
  if (change.tab !== "public.events" || change.op !== "insert") continue;
  const race = change.after as unknown as NewRace;
  const place = fromCopy.get(race.id) ?? (race.location_id ? inserted.get(race.location_id) : null);
  // Already hidden by the collector: it cannot reach the map, so there is nothing to hold.
  const problems = race.visibility === "public" ? newRaceProblems(race, place, known, today) : [];
  // A race must come with the source row that states it, whatever else looks right.
  if (race.visibility === "public" && !sourced.has(race.id)) problems.push("no_source_read_in_this_pass");
  const dateSeen = race.visibility === "public" && !problems.length ? await dateIsOnSource(sourceUrls.get(race.id)!, race.start_date) : null;
  if (problems.length) {
    reasons.set(race.id, problems);
    heldRaces.push({ name: race.name, date: race.start_date, because: problems });
    for (const problem of problems) summary[problem] = (summary[problem] ?? 0) + 1;
  } else if (race.visibility === "public") {
    kept.push({ name: race.name, date: race.start_date, place: place?.municipality ?? place?.name ?? null, country: place?.country_code ?? null, source: sourceUrls.get(race.id) ?? null, dateSeenOnSource: dateSeen, id: race.id, location: race.location_id ?? null });
  }
}

const eventOf = (change: Change) => change.owner ?? (change.tab === "public.events" ? change.pk.id : (change.after ?? change.before)?.event_id as string | undefined);
const onlyNew = process.argv.includes("--only-new-races");
const readyIds = new Set(kept.map(race => race.id)), readyPlaces = new Set(kept.map(race => race.location));
const send: Change[] = [], held: Change[] = [];
for (const change of changes) {
  const problems = reasons.get(eventOf(change) ?? "");
  if (problems) held.push({ ...change, heldBecause: problems });
  else if (!onlyNew || readyIds.has(eventOf(change) ?? "") && change.op === "insert" || change.tab === "public.locations" && change.op === "insert" && readyPlaces.has(change.pk.id ?? null)) send.push(change);
}
const body = send.map(change => JSON.stringify(change)).join("\n");
writeFileSync(join(directory, "changes.ndjson"), body);
if (held.length) appendFileSync(join(directory, "held-for-review.ndjson"), `\n${held.map(change => JSON.stringify(change)).join("\n")}`);
const planFile = join(directory, "plan.json");
const plan = JSON.parse(readFileSync(planFile, "utf8")) as Record<string, unknown>;
writeFileSync(planFile, JSON.stringify({ ...plan, rows: send.length, sha256: createHash("sha256").update(body).digest("hex"), reviewedAt: new Date().toISOString(), newRaces: { ready: kept, held: heldRaces, reasons: summary } }, null, 2));
console.log(JSON.stringify({ newRacesReady: kept.length, newRacesHeld: heldRaces.length, reasons: summary, rowsToSend: send.length }));
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });

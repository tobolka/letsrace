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
import { radsportEventToParsed } from "../src/lib/watcher/extractors/radsport";
import { load } from "cheerio";
import { fetchPage } from "../src/lib/watcher/http";
import { mapPool } from "../src/lib/watcher/pool";
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
   from public.events e left join public.locations l on l.id = e.location_id where e.start_date >= current_date - 2`],
  { encoding: "utf8", maxBuffer: 2 ** 30, env: { ...process.env, LC_ALL: "en_US.UTF-8", NODE_OPTIONS: "" } })) as (KnownRace & { visibility: string })[];

const inserted = new Map<string | undefined, Place>(changes.filter(change => change.tab === "public.locations" && change.op === "insert").map(change => [change.pk.id, change.after as Place]));
const fromCopy = new Map(catalogue.map(row => [row.id, row.place]));
// Two new records of one race must not both pass, so new races are compared with each other too.
const target = process.argv.find(value => value.startsWith("--catalogue="))?.slice(12);
if (target && !/^letsrace_[a-z0-9_]+$/.test(target)) throw Error("Invalid local catalogue name");
const live = target ? JSON.parse(execFileSync(PSQL, ["-h","127.0.0.1","-p","54329","-U","postgres","-d",target,"-qAt","-c", `select coalesce(json_agg(json_build_object('id',e.id,'name',e.name,'start_date',e.start_date,'end_date',e.end_date,'disciplines',e.disciplines,'website_url',e.website_url,'visibility',e.visibility,'place',json_build_object('municipality',l.municipality,'name',l.name,'country_code',l.country_code,'lat',l.lat,'lng',l.lng))),'[]') from public.events e left join public.locations l on l.id=e.location_id where e.start_date>=current_date-2`], {encoding:"utf8",maxBuffer:2**30,env:{...process.env,LC_ALL:"en_US.UTF-8",NODE_OPTIONS:""}})) as typeof catalogue : [];
// A hidden or unpublished record still represents an existing race. Publishing
// a second ID would bypass the operator's earlier decision about that record.
const known = [...new Map([...catalogue,...live].map(row=>[row.id,row])).values()];
type SourceRow = { id: string; url: string; kind: string; status: string; added_by: string | null; notes: string | null };
const readSources = (database: string, where = "true") => JSON.parse(execFileSync(PSQL, ["-h", "127.0.0.1", "-p", "54329", "-U", "postgres", "-d", database, "-qAt", "-c", `select coalesce(json_agg(json_build_object('id',id,'url',url,'kind',kind,'status',status,'added_by',added_by,'notes',notes)),'[]') from public.watched_urls where ${where}`], { encoding: "utf8", maxBuffer: 2 ** 30, env: { ...process.env, NODE_OPTIONS: "" } })) as SourceRow[];
const onTarget = target ? new Map(readSources(target).map(row => [row.id, row])) : null;
const onTargetByUrl = new Map([...(onTarget?.values() ?? [])].map(row => [row.url, row]));
const here = new Map(readSources(process.argv.find(value => value.startsWith("--work="))?.slice(7) ?? "letsrace", "(added_by = 'pipeline_review' and status = 'paused') or added_by = 'owner_request'").map(row => [row.id, row]));
/**
 * How a race's source gets to the target, or why it cannot. A source found by a reviewed
 * announcement is evidence, never something to poll: it travels as its bare configuration,
 * paused, with none of the Mac's reading state. So does a source the owner asked the Mac to
 * read: it is read here, and the server only needs it for its races' links. Anything else must
 * already be there.
 */
function sourcePath(id: string): { problem: string } | { use: string; carry?: SourceRow } {
  const there = onTarget?.get(id);
  const evidenceOnly = (row: SourceRow) => row.added_by === "pipeline_review" || row.added_by === "owner_request";
  if (there) return there.status === "active" || evidenceOnly(there) ? { use: id } : { problem: "source_paused_on_server" };
  const local = here.get(id);
  if (!local) return { problem: "source_not_in_target_catalogue" };
  const sameUrl = onTargetByUrl.get(local.url);
  if (!sameUrl) return { use: id, carry: local };
  return sameUrl.status === "active" || evidenceOnly(sameUrl) ? { use: sameUrl.id } : { problem: "source_paused_on_server" };
}
const sourced = new Set(changes.filter(change => change.tab === "public.event_sources" && change.op === "insert").map(change => change.owner ?? change.after?.event_id));
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Prague" });

/** Read the source again and require the date on it, not just a row claiming to come from it. */
const rideSources = new Set<string>();
async function dateIsOnSource(url: string, date: string) {
  try {
    const radsport = /^https?:\/\/(?:www\.)?radsport-events\.de\/events\/(\d+)(?:[/?#]|$)/i.exec(url);
    if(radsport){
      const response=await fetch(`https://api.radsport-events.de/api/v1/events/${radsport[1]}`,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)return false;
      const event=await response.json();if(String(event.id)!==radsport[1])return false;
      const parsed=radsportEventToParsed(event);if(parsed?.eventType==='ride')rideSources.add(url);
      return parsed?.startDate===date;
    }
    const page = await fetchPage(url, { fresh: true, timeoutMs: 20_000, retries: 1 });
    if (page.status !== 200) return false;
    // A federation's race date is not its separate registration window.
    if (/members\.federciclismo\.it\/race\/detail\//i.test(url)) {
      const $ = load(page.html);
      const value = $(".lblBlock").filter((_, el) => /^Data\s*:/i.test($(el).text().trim())).first().text().replace(/^Data\s*:/i, "");
      return quoteStatesDate(value, date);
    }
    return quoteStatesDate(pageAsText(page.html, url).text, date) || quoteStatesDate(page.html, date);
  } catch { return false; }
}
const sourceUrls = new Map(changes.filter(change => change.tab === "public.event_sources" && change.op === "insert").map(change => [change.owner ?? change.after?.event_id as string, change.after?.source_url as string]));

async function main() {
const reasons = new Map<string | undefined, string[]>();
const summary: Record<string, number> = {}, kept: { name: string; date: string; place: string | null; country: string | null; source: string | null; dateSeenOnSource: boolean | null; id: string; location: string | null }[] = [], heldRaces: { name: string; date: string; because: string[] }[] = [];
// Everything that needs no network first, so a big calendar's races are not re-read one by one.
type Checked = { race: NewRace; place: Place | null | undefined; problems: string[] };
const checked: Checked[] = [];
for (const change of changes) {
  if (change.tab !== "public.events" || change.op !== "insert") continue;
  const race = change.after as unknown as NewRace;
  const place = fromCopy.get(race.id) ?? (race.location_id ? inserted.get(race.location_id) : null);
  // Already hidden by the collector: it cannot reach the map, so there is nothing to hold.
  const problems = race.visibility === "public" ? newRaceProblems(race, place, known, today) : [];
  // A race must come with the source row that states it, whatever else looks right.
  if (race.visibility === "public" && !sourced.has(race.id)) problems.push("no_source_read_in_this_pass");
  if (race.visibility === "public" && onTarget) {
    const links = changes.filter(c=>c.tab==="public.event_sources" && (c.owner ?? c.after?.event_id)===race.id);
    for (const link of links) {
      if (!link.after?.watched_url_id) continue;
      const path = sourcePath(String(link.after.watched_url_id));
      if ("problem" in path) problems.push(path.problem);
    }
  }
  checked.push({ race, place, problems });
}
const dateSeenOn = new Map<string, boolean>();
await mapPool(checked.filter(item => item.race.visibility === "public" && !item.problems.length), 8, async ({ race }) => {
  dateSeenOn.set(race.id, await dateIsOnSource(sourceUrls.get(race.id)!, race.start_date));
});
for (const { race, place, problems } of checked) {
  const dateSeen = dateSeenOn.get(race.id) ?? null;
  if(rideSources.has(sourceUrls.get(race.id) ?? ""))problems.push("listed_as_a_ride");
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
const maxNew = Number(process.argv.find(value => value.startsWith("--max-new="))?.slice(10) ?? 100);
if (!Number.isInteger(maxNew) || maxNew < 1 || maxNew > 100) throw Error("Invalid new race batch size");
const selected = kept.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,maxNew);
const readyIds = new Set(selected.map(race => race.id)), readyPlaces = new Set(selected.map(race => race.location));
const primary = new Map(changes.filter(c=>c.tab==="public.events" && c.op==="insert").map(c=>[c.pk.id,c.after?.series_id]));
const readySeries = new Set(changes.filter(c=>c.tab==="public.events" && readyIds.has(c.pk.id ?? "")).map(c=>c.after?.series_id));
for (const c of changes) if(c.tab==="public.event_series" && readyIds.has(eventOf(c) ?? "")) readySeries.add(c.after?.series_id);
const send: Change[] = [], held: Change[] = [];
for (const change of changes) {
  const problems = reasons.get(eventOf(change) ?? "");
  if (onlyNew && change.tab === "public.event_series" && change.op === "insert" && primary.get(eventOf(change)) === change.after?.series_id) continue; // Created by the event's own trigger.
  if (problems) held.push({ ...change, heldBecause: problems });
  else if (!onlyNew || readyIds.has(eventOf(change) ?? "") && change.op === "insert" || change.tab === "public.locations" && change.op === "insert" && readyPlaces.has(change.pk.id ?? null) || onlyNew && change.tab === "public.series" && change.op === "insert" && readySeries.has(change.pk.id)) send.push(change);
}
// Sources first, so their races find them in the same send.
const carried = new Map<string, SourceRow>();
for (const change of send) {
  if (change.tab !== "public.event_sources" || !change.after?.watched_url_id || !onTarget) continue;
  const path = sourcePath(String(change.after.watched_url_id));
  if ("problem" in path) continue;
  change.after.watched_url_id = path.use;
  if (path.carry) carried.set(path.use, path.carry);
}
const sources: Change[] = [...carried.values()].map(row => ({ tab: "public.watched_urls", op: "insert", pk: { id: row.id }, after: { id: row.id, url: row.url, kind: row.kind, status: "paused", added_by: row.added_by, notes: row.notes } }));
send.unshift(...sources);
const body = send.map(change => JSON.stringify(change)).join("\n");
writeFileSync(join(directory, "changes.ndjson"), body);
if (held.length) appendFileSync(join(directory, "held-for-review.ndjson"), `\n${held.map(change => JSON.stringify(change)).join("\n")}`);
const planFile = join(directory, "plan.json");
const plan = JSON.parse(readFileSync(planFile, "utf8")) as Record<string, unknown>;
writeFileSync(planFile, JSON.stringify({ ...plan, rows: send.length, sha256: createHash("sha256").update(body).digest("hex"), reviewedAt: new Date().toISOString(), evidenceSources: sources.length, newRaces: { ready: selected, held: heldRaces, reasons: summary, deferredByBatchLimit: kept.length-selected.length } }, null, 2));
console.log(JSON.stringify({ newRacesReady: selected.length, newRacesHeld: heldRaces.length, reasons: summary, rowsToSend: send.length }));
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });

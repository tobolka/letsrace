/**
 * What a pass on the Mac found, per country. Reads only the local copy and its twin.
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/local-report.ts [--target=2027] [--out=file.json]
 *
 * A source that gave races before and gives none now is flagged, so a reader broken
 * by the new season can be told apart from a calendar that has not been published.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { editionCoverage } from "../src/lib/local-pass/compare";
import type { CatalogueEvent } from "../src/lib/local-pass/store";
import { recordedRunState } from "../src/lib/watcher/run-summary";

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const target = Number(arg("target") ?? 2027);
const COUNTRIES = (process.env.PIPELINE_TARGET_COUNTRIES ?? "CZ,SK,AT,DE,PL,CH,IT").split(",");
const PSQL = `${process.env.LOCAL_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin"}/psql`;
const json = <T>(database: string, sql: string) => JSON.parse(execFileSync(PSQL, ["-h", "127.0.0.1", "-p", "54329", "-U", "postgres", "-d", database, "-qAt", "-c", sql],
  { encoding: "utf8", maxBuffer: 2 ** 30, env: { ...process.env, LC_ALL: "en_US.UTF-8", PGTZ: "UTC", NODE_OPTIONS: "" } })) as T;

const EVENTS = `select coalesce(json_agg(json_build_object('id', e.id, 'name', e.name, 'start_date', e.start_date, 'end_date', e.end_date, 'status', e.status, 'visibility', e.visibility,
  'event_type', e.event_type, 'series_id', e.series_id, 'disciplines', e.disciplines, 'website_url', e.website_url, 'lat', l.lat, 'lng', l.lng, 'municipality', l.municipality, 'country_code', l.country_code)), '[]')
  from public.events e left join public.locations l on l.id = e.location_id where e.merged_into_id is null and e.start_date >= '${target - 1}-01-01'`;
const before = json<CatalogueEvent[]>("letsrace_baseline", EVENTS);
const after = json<CatalogueEvent[]>("letsrace", EVENTS);
const beforeIds = new Set(before.map(row => row.id));

const since = arg("since") ?? json<string>("letsrace_baseline", "select to_json(coalesce(max(started_at), '2000-01-01'::timestamptz)) from public.ingest_runs");
if (!/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(since) || !Number.isFinite(Date.parse(since))) throw Error("Invalid report start date");
type Run = { url: string; kind: string; unchanged: boolean; ok: boolean | null; finishedAt: string | null; status: number | null; error: string | null; extracted: number; upserted: number; database: number; seconds: number; countries: string[] | null; prior: number | null };
const runs = json<Run[]>("letsrace", `with latest as (
    select distinct on (r.watched_url_id) r.* from public.ingest_runs r where r.started_at > '${since}' order by r.watched_url_id, r.started_at desc),
  totals as (select r.watched_url_id, sum(coalesce((r.metrics -> 'database' ->> 'attempts')::int, 0)) as database from public.ingest_runs r where r.started_at > '${since}' group by 1),
  best as (select r.watched_url_id, max(coalesce((r.metrics ->> 'extracted')::int, 0)) as extracted, bool_or(coalesce((r.metrics ->> 'unchanged')::boolean, false) or r.http_status = 304) as unchanged from public.ingest_runs r where r.started_at > '${since}' group by 1),
  prior as (select r.watched_url_id, max((r.metrics ->> 'extracted')::int) as extracted from public.ingest_runs r where r.started_at <= '${since}' and r.started_at > '${since}'::timestamptz - interval '60 days' and r.metrics ->> 'extracted' ~ '^[0-9]+$' group by 1)
  select coalesce(json_agg(json_build_object('url', w.url, 'kind', w.kind, 'ok', l.ok, 'finishedAt',l.finished_at, 'status', l.http_status, 'error', left(l.error, 160),
    'extracted', b.extracted, 'unchanged', b.unchanged or w.last_extract_status in ('unchanged', 'off_season'), 'upserted', coalesce(l.events_upserted, 0), 'database', t.database,
    'seconds', extract(epoch from l.finished_at - l.started_at), 'prior', p.extracted,
    'countries', (select json_agg(distinct lo.country_code) from public.event_sources s join public.events e on e.id = s.event_id join public.locations lo on lo.id = e.location_id where s.watched_url_id = w.id))), '[]')
  from latest l join public.watched_urls w on w.id = l.watched_url_id join totals t on t.watched_url_id = l.watched_url_id join best b on b.watched_url_id = l.watched_url_id left join prior p on p.watched_url_id = l.watched_url_id`);

// An unchanged page gives no rows because nothing was parsed, which says nothing about the reader.
// Which of last year's races had a source actually read in this pass.
const readSources = new Set(runs.filter(run => run.ok).map(run => run.url));
const sourceLinks = json<{ event_id: string; url: string }[]>("letsrace", `select coalesce(json_agg(json_build_object('event_id', s.event_id, 'url', w.url)), '[]') from public.event_sources s join public.watched_urls w on w.id = s.watched_url_id`);
const checkedRaces = new Set(sourceLinks.filter(link => readSources.has(link.url)).map(link => link.event_id));
const silent = runs.filter(run => (run.prior ?? 0) > 0 && run.extracted === 0 && !run.unchanged);
const state = (run: Run) => recordedRunState({ok:run.ok,error:run.error,finished_at:run.finishedAt});
const countries = COUNTRIES.map(country => {
  const coverage = editionCoverage(after, [], target, country, () => false);
  const startedAt = editionCoverage(before, [], target, country, () => false);
  const own = runs.filter(run => run.countries?.includes(country));
  return {
    country, lastYearRaces: coverage.base,
    withEditionBefore: startedAt.counts.public, withEditionNow: coverage.counts.public, percentNow: coverage.percentPublic, hiddenEdition: coverage.counts.hidden,
    // Not the same thing: a race whose source was read and shows no new date has simply not been
    // announced as far as we can tell; one with no working source tells us nothing at all.
    noEditionButSourceChecked: coverage.rows.filter(row => row.state === "nothing_yet" && checkedRaces.has(row.id)).length,
    noEditionAndNotChecked: coverage.rows.filter(row => row.state === "nothing_yet" && !checkedRaces.has(row.id)).length,
    newRecords: after.filter(row => !beforeIds.has(row.id) && row.country_code === country && row.start_date.startsWith(`${target}-`)).length,
    sourcesRead: own.length, sourcesOk: own.filter(run => run.ok).length, silentSources: silent.filter(run => run.countries?.includes(country)).length,
    rowsReadFromSources: own.reduce((sum, run) => sum + run.extracted, 0),
  };
});
const report = {
  at: new Date().toISOString(), since, target, countries,
  overall: { sourcesRead: runs.length, ok: runs.filter(run => state(run)==="ok").length, failed: runs.filter(run => state(run)==="failed").length,
    unreadable:runs.filter(run=>state(run)==="unreadable").length,deferred:runs.filter(run=>state(run)==="deferred").length,
    unfinished:runs.filter(run=>["running","unknown"].includes(state(run))).length,
    silent: silent.length, databaseRequestsSpared: runs.reduce((sum, run) => sum + run.database, 0) },
  problems:runs.filter(run=>state(run)!=="ok").map(run=>({url:run.url,error:run.error,state:state(run)})),
  silentSources: silent.map(({ url, prior, status, error }) => ({ url, prior, status, error })),
  costliest: [...runs].sort((a, b) => b.database - a.database).slice(0, 12).map(({ url, database, upserted, extracted }) => ({ url, database, upserted, extracted })),
  failures: Object.entries(Object.groupBy(runs.filter(run => !run.ok), run => (run.error ?? "unknown").replace(/:.*$/, "").slice(0, 50)))
    .map(([error, rows]) => ({ error, count: rows!.length })).sort((a, b) => b.count - a.count).slice(0, 12),
};
const out = arg("out");
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ overall: report.overall, countries: report.countries, costliest: report.costliest.slice(0, 6), failures: report.failures, silentSources: report.silentSources.slice(0, 12) }, null, 1));

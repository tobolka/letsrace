/** Read-only check of catalogue visibility, series links, and watcher health. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { PUBLIC_EVENT_STATUSES, isPublicMapWorthy, shouldHideFromMap } from "../src/lib/event-visibility";
import { isListedCountry } from "../src/lib/geo/europe";

try {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
} catch { /* Environment may already be loaded. */ }

const sb = createServerSupabase();
const now = new Date();
const today = now.toISOString().slice(0, 10);

async function all<T>(table: string, columns: string, orderColumns = ["id"]): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let query = sb.from(table).select(columns);
    for (const column of orderColumns) query = query.order(column);
    const { data, error } = await query.range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

type Event = {
  id: string; name: string; start_date: string; status: string; visibility: string;
  merged_into_id: string | null; series_id: string | null; disciplines: string[] | null;
  age_categories: string[] | null; website_url: string | null; registration_url: string | null;
  source_kind: string | null; event_type: string | null;
  location: { id: string; country_code: string | null; lat: number | null; lng: number | null } | null;
};
type Link = { event_id: string; series_id: string; is_primary: boolean; source: string | null };
type Series = { id: string; slug: string; name: string; visibility: string };
type Watch = {
  id: string; url: string; kind: string; status: string; last_extract_status: string | null;
  next_poll_at: string | null; last_fetched_at: string | null; last_error: string | null;
};
type Run = { id: string; watched_url_id: string; started_at: string; finished_at: string | null; ok: boolean | null };

function tally<T>(rows: T[], key: (row: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) result[key(row)] = (result[key(row)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1]));
}

async function main() {
  const [events, links, series, watches, runs] = await Promise.all([
    all<Event>("events", "id,name,start_date,status,visibility,merged_into_id,series_id,disciplines,age_categories,website_url,registration_url,source_kind,event_type,location:locations(id,country_code,lat,lng)"),
    all<Link>("event_series", "event_id,series_id,is_primary,source", ["event_id", "series_id"]),
    all<Series>("series", "id,slug,name,visibility"),
    all<Watch>("watched_urls", "id,url,kind,status,last_extract_status,next_poll_at,last_fetched_at,last_error"),
    all<Run>("ingest_runs", "id,watched_url_id,started_at,finished_at,ok"),
  ]);

  const future = events.filter((e) => e.start_date >= today && !e.merged_into_id);
  const publicFuture = future.filter((e) => e.visibility === "public");
  const hiddenFuture = future.filter((e) => e.visibility === "hidden");
  const statusEligible = new Set<string>(PUBLIC_EVENT_STATUSES);
  const reasons = {
    nonPublic: future.filter((e) => e.visibility !== "public"),
    nonListingStatus: publicFuture.filter((e) => !statusEligible.has(e.status)),
    nonRaceName: publicFuture.filter((e) => statusEligible.has(e.status) && shouldHideFromMap(e.name, e.status, e.visibility)),
    noLocation: publicFuture.filter((e) => statusEligible.has(e.status) && !e.location),
    noCountry: publicFuture.filter((e) => statusEligible.has(e.status) && e.location && !e.location.country_code),
    unlistedCountry: publicFuture.filter((e) => statusEligible.has(e.status) && e.location?.country_code && !isListedCountry(e.location.country_code)),
    missingCoordinates: publicFuture.filter((e) => statusEligible.has(e.status) && e.location && (e.location.lat == null || e.location.lng == null)),
    noPublicLink: publicFuture.filter((e) => statusEligible.has(e.status) && e.location && !isPublicMapWorthy({ websiteUrl: e.website_url, registrationUrl: e.registration_url, location: { countryCode: e.location.country_code } })),
  };

  const eventById = new Map(events.map((e) => [e.id, e]));
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const linkByEvent = new Map<string, Link[]>();
  for (const link of links) linkByEvent.set(link.event_id, [...(linkByEvent.get(link.event_id) ?? []), link]);
  const primaryMissing = events.filter((e) => e.series_id && !e.merged_into_id && !(linkByEvent.get(e.id) ?? []).some((l) => l.series_id === e.series_id && l.is_primary));
  const primaryMismatch = links.filter((l) => l.is_primary && eventById.get(l.event_id)?.series_id !== l.series_id);
  const orphanLinks = links.filter((l) => !eventById.has(l.event_id) || !seriesById.has(l.series_id));
  const mergedLinks = links.filter((l) => eventById.get(l.event_id)?.merged_into_id);
  const hiddenSeriesLinks = links.filter((l) => seriesById.get(l.series_id)?.visibility === "hidden" && eventById.get(l.event_id)?.visibility === "public");

  const active = watches.filter((w) => w.status === "active");
  const overdue = active.filter((w) => w.next_poll_at && Date.parse(w.next_poll_at) < now.getTime() - 60 * 60_000);
  const overdueDay = overdue.filter((w) => w.next_poll_at && Date.parse(w.next_poll_at) < now.getTime() - 24 * 60 * 60_000);
  const unfinished = runs.filter((r) => !r.finished_at && Date.parse(r.started_at) < now.getTime() - 30 * 60_000);
  const recentRuns = runs.filter((r) => Date.parse(r.started_at) >= now.getTime() - 24 * 60 * 60_000);
  const nextYear = String(now.getUTCFullYear() + 1);
  const nextYearSources = active.filter((w) => w.url.includes(nextYear));

  const report = {
    auditedAt: now.toISOString(), today,
    counts: { events: events.length, future: future.length, publicFuture: publicFuture.length, series: series.length, memberships: links.length, watched: watches.length, activeWatches: active.length, ingestRuns: runs.length },
    futureByYear: tally(future, (e) => e.start_date.slice(0, 4)),
    publicFutureByYear: tally(publicFuture, (e) => e.start_date.slice(0, 4)),
    futureByVisibility: tally(future, (e) => e.visibility),
    futureByStatus: tally(publicFuture, (e) => e.status),
    hiddenFuture: {
      byCountry: tally(hiddenFuture, (e) => e.location?.country_code ?? "??"),
      bySourceKind: tally(hiddenFuture, (e) => e.source_kind ?? "??"),
      byEventType: tally(hiddenFuture, (e) => e.event_type ?? "??"),
      byStatus: tally(hiddenFuture, (e) => e.status),
      inListedCountry: hiddenFuture.filter((e) => isListedCountry(e.location?.country_code)).length,
      withPublicLink: hiddenFuture.filter((e) => Boolean(e.website_url || e.registration_url)).length,
    },
    visibilityReasons: Object.fromEntries(Object.entries(reasons).map(([key, rows]) => [key, { count: rows.length, examples: rows.slice(0, 8).map((e) => ({ id: e.id, date: e.start_date, name: e.name })) }])),
    upcomingMissingDiscipline: publicFuture.filter((e) => !e.disciplines?.length).length,
    upcomingMissingAges: publicFuture.filter((e) => !e.age_categories?.length).length,
    seriesIntegrity: {
      primaryMissing: primaryMissing.length, primaryMismatch: primaryMismatch.length,
      orphanLinks: orphanLinks.length, mergedLinks: mergedLinks.length, hiddenSeriesLinks: hiddenSeriesLinks.length,
      hiddenSeriesLinkGroups: tally(hiddenSeriesLinks, (l) => seriesById.get(l.series_id)?.slug ?? "unknown"),
      primaryMissingExamples: primaryMissing.slice(0, 8).map((e) => ({ id: e.id, name: e.name })),
      primaryMismatchExamples: primaryMismatch.slice(0, 8).map((l) => ({ eventId: l.event_id, seriesId: l.series_id })),
    },
    watcher: {
      activeByKind: tally(active, (w) => w.kind),
      activeByExtractStatus: tally(active, (w) => w.last_extract_status ?? "never"),
      overdueHour: overdue.length, overdueDay: overdueDay.length,
      overdueDayExamples: overdueDay.sort((a, b) => String(a.next_poll_at).localeCompare(String(b.next_poll_at))).slice(0, 12).map((w) => ({ url: w.url, kind: w.kind, nextPoll: w.next_poll_at, lastFetched: w.last_fetched_at, extractStatus: w.last_extract_status })),
      neverFetched: active.filter((w) => !w.last_fetched_at).length,
      nextYearSources: nextYearSources.length,
      nextYearByExtractStatus: tally(nextYearSources, (w) => w.last_extract_status ?? "never"),
      nextYearSourceExamples: nextYearSources.slice(0, 12).map((w) => ({ url: w.url, lastFetched: w.last_fetched_at, nextPoll: w.next_poll_at, extractStatus: w.last_extract_status })),
      recentRuns: recentRuns.length, recentRunFailures: recentRuns.filter((r) => r.ok === false).length,
      unfinishedOver30Minutes: unfinished.length,
      unfinishedExamples: unfinished.slice(0, 12).map((r) => ({ id: r.id, sourceId: r.watched_url_id, startedAt: r.started_at })),
    },
  };

  const output = process.argv[process.argv.indexOf("--output") + 1];
  if (process.argv.includes("--output")) {
    if (!output || output.startsWith("--")) throw new Error("--output requires a file path");
    writeFileSync(resolve(output), JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

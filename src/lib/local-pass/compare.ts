/**
 * Judge locally read races against the catalogue snapshot. Pure and offline.
 * "new" only means "worth checking": publication still goes through the normal
 * evidence gates, so nothing here can put an invented race on the map.
 */
import { assessDuplicate, datesCompatible, type DedupEvent } from "@/lib/dedup";
import { findNextEdition, type EditionIdentity } from "@/lib/catalog/edition-identity";
import type { CatalogueEvent } from "./store";

export type ParsedRace = {
  externalId: string; name: string; startDate: string; endDate?: string; placeText?: string; countryHint?: string;
  discipline?: string[]; lat?: number; lng?: number; seriesName?: string; websiteUrl?: string; status?: string;
};
export type Decision = "known" | "date_differs" | "review" | "new";
export type Finding = { decision: Decision; eventId?: string; reason?: string };

const incoming = (race: ParsedRace): DedupEvent => ({
  name: race.name, startDate: race.startDate, endDate: race.endDate, countryCode: race.countryHint, placeText: race.placeText,
  lat: race.lat, lng: race.lng, disciplines: race.discipline as DedupEvent["disciplines"], seriesName: race.seriesName,
});
const stored = (row: CatalogueEvent): DedupEvent => ({
  name: row.name, startDate: row.start_date, endDate: row.end_date, countryCode: row.country_code, placeText: row.municipality,
  lat: row.lat, lng: row.lng, disciplines: row.disciplines as DedupEvent["disciplines"],
});

export function createComparer(events: CatalogueEvent[], sources: { event_id: string; watched_url_id: string | null; external_id: string | null }[]) {
  const byId = new Map(events.map(row => [row.id, row]));
  const bySource = new Map(sources.filter(s => s.watched_url_id && s.external_id).map(s => [`${s.watched_url_id}|${s.external_id}`, s.event_id]));
  const byMonth = Map.groupBy(events, row => row.start_date.slice(0, 7));

  return (race: ParsedRace, watchedUrlId: string | null): Finding => {
    const linked = watchedUrlId ? byId.get(bySource.get(`${watchedUrlId}|${race.externalId}`) ?? "") : undefined;
    if (linked) {
      const sameDates = linked.start_date === race.startDate && (linked.end_date ?? linked.start_date) === (race.endDate ?? race.startDate);
      return sameDates ? { decision: "known", eventId: linked.id, reason: "same_source_row" } : { decision: "date_differs", eventId: linked.id, reason: `catalogue_has_${linked.start_date}` };
    }
    const nearby = (byMonth.get(race.startDate.slice(0, 7)) ?? []).filter(row => datesCompatible({ startDate: row.start_date, endDate: row.end_date }, { startDate: race.startDate, endDate: race.endDate }, 1));
    const assessed = nearby.map(row => ({ row, ...assessDuplicate(incoming(race), stored(row)) })).sort((a, b) => b.score - a.score);
    const matches = assessed.filter(item => item.decision === "match");
    if (matches.length === 1) return { decision: "known", eventId: matches[0]!.row.id, reason: "same_race_elsewhere" };
    if (matches.length > 1) return { decision: "review", reason: "several_possible_races" };
    const possible = assessed.find(item => item.decision === "review");
    return possible ? { decision: "review", eventId: possible.row.id, reason: "uncertain_identity" } : { decision: "new" };
  };
}

export type EditionState = "public" | "hidden" | "found_locally" | "mentioned_on_site" | "nothing_yet";

const identity = (row: CatalogueEvent): EditionIdentity => ({
  id: row.id, name: row.name, start_date: row.start_date, series_id: row.series_id, disciplines: row.disciplines,
  location: { lat: row.lat, lng: row.lng, country_code: row.country_code, municipality: row.municipality },
});

/** A race counts towards the goal only when it can really return; a ride or a cancelled event cannot. */
export function isBaseRace(row: CatalogueEvent, year: number, country: string) {
  return row.start_date.startsWith(`${year}-`) && row.country_code === country && row.visibility === "public"
    && row.status !== "cancelled" && row.event_type !== "ride";
}

/** Where each of last year's races stands for the target year. Never calculates a date. */
export function editionCoverage(events: CatalogueEvent[], local: ParsedRace[], target: number, country: string, mentionsTarget: (row: CatalogueEvent) => boolean) {
  const future = events.filter(row => row.start_date.startsWith(`${target}-`)).map(row => ({ ...identity(row), visibility: row.visibility }));
  const found = local.map((race, index) => ({
    id: `local:${index}`, name: race.name, start_date: race.startDate, series_id: null, disciplines: race.discipline ?? null,
    location: { lat: race.lat ?? null, lng: race.lng ?? null, country_code: race.countryHint ?? country, municipality: race.placeText ?? null },
  }));
  const rows = events.filter(row => isBaseRace(row, target - 1, country)).map(row => {
    const next = findNextEdition(identity(row), future);
    const state: EditionState = next ? (next.visibility === "public" ? "public" : "hidden")
      : findNextEdition(identity(row), found) ? "found_locally"
      : mentionsTarget(row) ? "mentioned_on_site" : "nothing_yet";
    return { id: row.id, name: row.name, start_date: row.start_date, website_url: row.website_url, state, nextId: next?.id ?? null };
  });
  const counts = Object.fromEntries((["public", "hidden", "found_locally", "mentioned_on_site", "nothing_yet"] as const).map(state => [state, rows.filter(row => row.state === state).length])) as Record<EditionState, number>;
  return { base: rows.length, counts, percentPublic: rows.length ? Math.round(counts.public / rows.length * 1000) / 10 : 0, rows };
}

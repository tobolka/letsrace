import { todayIso } from "@/lib/date-presets";
import { catalogueCovers } from "@/lib/filter-catalogue";

export type EventsQuery = {
  q: string;
  series: string;
  dateFrom: string;
  dateTo: string;
  categories: string[];
  disciplines: string[];
  levels: string[];
  country: string[];
};

export type Box = { west: number; south: number; east: number; north: number };

/**
 * The request behind the map, the list and the schedule.
 *
 * `shared` is true when the answer is the catalogue everyone shares: no text
 * search, no cup, and a window that starts no earlier than today. That is
 * filtered in the browser (`filterCatalogue`) and its viewport is not part of
 * the request, so a pan is not a new copy of the catalogue leaving compute.
 * Anything else asks `/api/events`, which `lib/api/events-query` reads.
 */
export function buildEventsQuery(
  query: EventsQuery,
  box: Box | null,
): { shared: boolean; params: URLSearchParams } {
  const params = new URLSearchParams();
  const q = query.q.trim();
  const shared = !q && !query.series && catalogueCovers(query.dateFrom, todayIso());
  if (q) params.set("q", q);
  if (query.series) params.set("series", query.series);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (!query.dateFrom && !query.dateTo) params.set("anyDate", "1");
  query.categories.forEach((v) => params.append("categories", v));
  query.disciplines.forEach((v) => params.append("disciplines", v));
  query.levels.forEach((v) => params.append("levels", v));
  query.country.forEach((v) => params.append("country", v));
  if (!shared && box) {
    params.set("west", String(box.west));
    params.set("south", String(box.south));
    params.set("east", String(box.east));
    params.set("north", String(box.north));
  }
  return { shared, params };
}

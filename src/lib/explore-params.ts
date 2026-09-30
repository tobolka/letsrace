import { parseAsArrayOf, parseAsString } from "nuqs";
import { thisWeekendRange } from "@/lib/date-presets";

const WEEKEND_DEFAULT = thisWeekendRange();

/**
 * The filters every view of the race catalogue shares.
 *
 * The map, the list and the schedule are three ways of looking at one query, so
 * the query lives in the URL under one set of names. Moving between the views
 * carries it along (see `carryFilterQuery`), and a link to any of them can be
 * pasted to somebody else and mean the same thing.
 */
export const filterSearchParams = {
  q: parseAsString.withDefault(""),
  categories: parseAsArrayOf(parseAsString).withDefault([]),
  disciplines: parseAsArrayOf(parseAsString).withDefault([]),
  levels: parseAsArrayOf(parseAsString).withDefault([]),
  series: parseAsString.withDefault(""),
  country: parseAsString.withDefault(""),
  dateFrom: parseAsString.withDefault(WEEKEND_DEFAULT.from),
  dateTo: parseAsString.withDefault(WEEKEND_DEFAULT.to),
  sort: parseAsString.withDefault(""),
};

/** Filters plus what only the map cares about: the open race and the camera. */
export const exploreSearchParams = {
  ...filterSearchParams,
  e: parseAsString.withDefault(""),
  view: parseAsString.withDefault(""),
  west: parseAsString,
  south: parseAsString,
  east: parseAsString,
  north: parseAsString,
};

/**
 * The distance from you. The list and the calendar filter by it; the map has a
 * camera for that, so it is not one of the map's filters — but it still rides
 * along between views, so going map → list → calendar keeps it.
 */
export const RADIUS_PARAM = "radius";
export const RADIUS_OPTIONS = [10, 25, 50, 100, 200] as const;

const FILTER_KEYS = [...Object.keys(filterSearchParams), RADIUS_PARAM];

/**
 * The query string to put on a link to another view.
 *
 * Only the filters travel. The camera box and the open race belong to the map,
 * and a list that inherited a viewport would quietly show a corner of Europe.
 */
export function carryFilterQuery(search: URLSearchParams | null | undefined): string {
  if (!search) return "";
  const out = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    for (const value of search.getAll(key)) out.append(key, value);
  }
  const qs = out.toString();
  return qs ? `?${qs}` : "";
}

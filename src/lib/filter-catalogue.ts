import type { EventListItem } from "@/lib/events";
import { ageCategoryMatch, ageMatchRank, matchesDisciplineFilter } from "@/lib/taxonomy";

export type CatalogueQuery = {
  categories: string[];
  disciplines: string[];
  levels: string[];
  country: string[];
  dateFrom: string;
  dateTo: string;
  west?: number;
  south?: number;
  east?: number;
  north?: number;
};

/** The shared feed already starts at today, so a look into the past still has to ask the server. */
export function catalogueCovers(dateFrom: string, today: string): boolean {
  return Boolean(dateFrom) && dateFrom >= today;
}

/**
 * The same cuts the events API applies, on the one cached feed.
 * Text search and series membership stay on the server: those use the
 * database's folding and the series link table.
 */
export function filterCatalogue(events: EventListItem[], query: CatalogueQuery): EventListItem[] {
  let rows = events;
  if (query.dateFrom) rows = rows.filter((e) => e.startDate >= query.dateFrom);
  if (query.dateTo) rows = rows.filter((e) => e.startDate <= query.dateTo);
  if (query.country.length) {
    const wanted = new Set(query.country);
    rows = rows.filter((e) => e.location?.countryCode && wanted.has(e.location.countryCode));
  }
  if (query.levels.length) {
    const wanted = new Set(query.levels);
    rows = rows.filter((e) => wanted.has(e.level));
  }
  if (query.disciplines.length) {
    rows = rows.filter((e) => matchesDisciplineFilter(e.disciplines, query.disciplines));
  }
  if (
    query.west != null &&
    query.south != null &&
    query.east != null &&
    query.north != null
  ) {
    const { west, south, east, north } = query;
    rows = rows.filter((e) => {
      const lat = e.location?.lat;
      const lng = e.location?.lng;
      if (lat == null || lng == null) return false;
      return lng >= west && lng <= east && lat >= south && lat <= north;
    });
  }
  if (query.categories.length) {
    rows = rows.flatMap((e) => {
      const match = ageCategoryMatch(e, query.categories);
      if (match === "no") return [];
      return [{ ...e, ageMatch: match, ageRank: ageMatchRank(e, query.categories) }];
    });
  }
  return rows;
}

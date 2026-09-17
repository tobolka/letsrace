/**
 * Persist explore list filters on the same device across visits.
 * Named date presets re-resolve to the live range on restore.
 */
import {
  nextMonthRange,
  nextWeekendRange,
  thisMonthRange,
  thisWeekendRange,
  todayIso,
} from "@/lib/date-presets";

export const EXPLORE_FILTER_STORAGE_KEY = "letsrace.explore.filters.v1";

export type ExploreDatePreset =
  | "thisWeekend"
  | "nextWeekend"
  | "thisMonth"
  | "nextMonth"
  | "upcoming"
  | "any"
  | "custom";

export type StoredExploreFilters = {
  v: 1;
  q: string;
  categories: string[];
  disciplines: string[];
  levels: string[];
  series: string;
  country: string;
  sort: string;
  datePreset: ExploreDatePreset;
  /** Absolute dates — used when datePreset is "custom". */
  dateFrom: string;
  dateTo: string;
};

export type ExploreFilterPatch = {
  q: string;
  categories: string[];
  disciplines: string[];
  levels: string[];
  series: string;
  country: string;
  sort: string;
  dateFrom: string;
  dateTo: string;
};

const URL_FILTER_KEYS = [
  "q",
  "categories",
  "disciplines",
  "levels",
  "series",
  "country",
  "dateFrom",
  "dateTo",
  "sort",
] as const;

export function urlHasExploreFilterParams(search: string): boolean {
  const qs = search.startsWith("?") ? search.slice(1) : search;
  if (!qs) return false;
  const params = new URLSearchParams(qs);
  return URL_FILTER_KEYS.some((key) => params.has(key));
}

export function matchExploreDatePreset(
  dateFrom: string,
  dateTo: string,
  now = new Date(),
): ExploreDatePreset {
  if (!dateFrom && !dateTo) return "any";
  const thisW = thisWeekendRange(now);
  if (dateFrom === thisW.from && dateTo === thisW.to) return "thisWeekend";
  const nextW = nextWeekendRange(now);
  if (dateFrom === nextW.from && dateTo === nextW.to) return "nextWeekend";
  const thisM = thisMonthRange(now);
  if (dateFrom === thisM.from && dateTo === thisM.to) return "thisMonth";
  const nextM = nextMonthRange(now);
  if (dateFrom === nextM.from && dateTo === nextM.to) return "nextMonth";
  if (dateFrom === todayIso(now) && !dateTo) return "upcoming";
  return "custom";
}

export function resolveExploreDatePreset(
  preset: ExploreDatePreset,
  dateFrom: string,
  dateTo: string,
  now = new Date(),
): { from: string; to: string } {
  switch (preset) {
    case "thisWeekend":
      return thisWeekendRange(now);
    case "nextWeekend":
      return nextWeekendRange(now);
    case "thisMonth":
      return thisMonthRange(now);
    case "nextMonth":
      return nextMonthRange(now);
    case "upcoming":
      return { from: todayIso(now), to: "" };
    case "any":
      return { from: "", to: "" };
    case "custom":
    default:
      return { from: dateFrom, to: dateTo };
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

export function parseStoredExploreFilters(raw: string | null): StoredExploreFilters | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<StoredExploreFilters>;
    if (data?.v !== 1) return null;
    const datePreset = data.datePreset;
    if (
      datePreset !== "thisWeekend" &&
      datePreset !== "nextWeekend" &&
      datePreset !== "thisMonth" &&
      datePreset !== "nextMonth" &&
      datePreset !== "upcoming" &&
      datePreset !== "any" &&
      datePreset !== "custom"
    ) {
      return null;
    }
    return {
      v: 1,
      q: typeof data.q === "string" ? data.q : "",
      categories: asStringArray(data.categories),
      disciplines: asStringArray(data.disciplines),
      levels: asStringArray(data.levels),
      series: typeof data.series === "string" ? data.series : "",
      country: typeof data.country === "string" ? data.country : "",
      sort: data.sort === "distance" ? "distance" : "",
      datePreset,
      dateFrom: typeof data.dateFrom === "string" ? data.dateFrom : "",
      dateTo: typeof data.dateTo === "string" ? data.dateTo : "",
    };
  } catch {
    return null;
  }
}

export function readExploreFilterPrefs(): StoredExploreFilters | null {
  try {
    return parseStoredExploreFilters(window.localStorage.getItem(EXPLORE_FILTER_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function toStoredExploreFilters(filters: ExploreFilterPatch): StoredExploreFilters {
  return {
    v: 1,
    q: filters.q,
    categories: [...filters.categories],
    disciplines: [...filters.disciplines],
    levels: [...filters.levels],
    series: filters.series,
    country: filters.country,
    sort: filters.sort === "distance" ? "distance" : "",
    datePreset: matchExploreDatePreset(filters.dateFrom, filters.dateTo),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
}

export function writeExploreFilterPrefs(filters: ExploreFilterPatch): void {
  try {
    window.localStorage.setItem(
      EXPLORE_FILTER_STORAGE_KEY,
      JSON.stringify(toStoredExploreFilters(filters)),
    );
  } catch {
    /* private mode / quota */
  }
}

export function storedExploreFiltersToPatch(
  stored: StoredExploreFilters,
  now = new Date(),
): ExploreFilterPatch {
  const dates = resolveExploreDatePreset(stored.datePreset, stored.dateFrom, stored.dateTo, now);
  return {
    q: stored.q,
    categories: [...stored.categories],
    disciplines: [...stored.disciplines],
    levels: [...stored.levels],
    series: stored.series,
    country: stored.country,
    sort: stored.sort === "distance" ? "distance" : "",
    dateFrom: dates.from,
    dateTo: dates.to,
  };
}

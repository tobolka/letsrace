import { ageCategoryLabel, disciplineLabel, raceLevelLabel } from "@/lib/i18n/taxonomy";
import { countryDisplayName, sortCountryCodes } from "@/lib/geo/europe";
import {
  INT_COUNTRY,
  seriesCountryCodes,
  seriesCountryKey,
  seriesInCountries,
  type SeriesOption,
} from "@/lib/explore-filters";
import type { Messages } from "@/lib/i18n/messages";

export type ExtraFilter = "discipline" | "category" | "level" | "country" | "series";

export const EXTRA_ORDER: ExtraFilter[] = ["discipline", "category", "level", "country", "series"];

export type SeriesGroup = { key: string; label: string; items: SeriesOption[] };

export function groupSeriesByCountry(
  list: SeriesOption[],
  locale: string,
  internationalLabel: string,
): SeriesGroup[] {
  const groups = new Map<string, SeriesOption[]>();
  for (const s of list) {
    const key = seriesCountryKey(s.countryCode);
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }
  const keys = [
    ...sortCountryCodes(
      [...groups.keys()].filter((k) => k !== INT_COUNTRY),
      locale,
    ),
    ...(groups.has(INT_COUNTRY) ? [INT_COUNTRY] : []),
  ];
  return keys.map((key) => ({
    key,
    label: key === INT_COUNTRY ? internationalLabel : countryDisplayName(key, locale),
    items: (groups.get(key) ?? []).sort(
      (a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name),
    ),
  }));
}

/** What the series submenu lists: the series in the chosen countries, grouped, narrowed by the search box. */
export function seriesView(
  seriesList: SeriesOption[],
  country: string[],
  locale: string,
  internationalLabel: string,
  query: string,
) {
  const countryCodes = seriesCountryCodes(seriesList, locale);
  const visibleSeries = seriesInCountries(seriesList, country);
  const groups = groupSeriesByCountry(visibleSeries, locale, internationalLabel);
  const q = query.trim().toLowerCase();
  const filteredGroups = q
    ? groups
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.slug.includes(q) ||
              (s.shortName?.toLowerCase().includes(q) ?? false),
          ),
        }))
        .filter((g) => g.items.length > 0)
    : groups;
  return {
    countryCodes,
    visibleSeries,
    filteredGroups,
    showHeaders: country.length !== 1 && groups.length > 1,
  };
}

export type ExtraState = {
  disciplines: string[];
  categories: string[];
  levels: string[];
  country: string[];
  series: string;
};

export function hasExtraValue(id: ExtraFilter, s: ExtraState): boolean {
  if (id === "discipline") return s.disciplines.length > 0;
  if (id === "category") return s.categories.length > 0;
  if (id === "level") return s.levels.length > 0;
  if (id === "country") return s.country.length > 0;
  return Boolean(s.series);
}

/** The chip label of every extra filter, and what it says when it is on. */
export function extraMeta(
  s: ExtraState,
  seriesName: string | undefined,
  messages: Messages,
  locale: string,
): Record<ExtraFilter, { label: string; value?: string }> {
  return {
    discipline: {
      label: messages.typeFilter,
      value:
        s.disciplines.length === 0
          ? undefined
          : s.disciplines.map((id) => disciplineLabel(id, locale)).join(", "),
    },
    category: {
      label: messages.categoryFilter,
      value:
        s.categories.length === 0
          ? undefined
          : s.categories.map((id) => ageCategoryLabel(id, locale)).join(", "),
    },
    level: {
      label: messages.levelFilter,
      value:
        s.levels.length === 0 ? undefined : s.levels.map((id) => raceLevelLabel(id, locale)).join(", "),
    },
    country: {
      label: messages.countryFilter,
      value:
        s.country.length === 0
          ? undefined
          : s.country.map((code) => countryDisplayName(code, locale)).join(", "),
    },
    series: {
      label: messages.seriesFilter,
      value: seriesName || s.series || undefined,
    },
  };
}

/**
 * Which extra filters are chips on the bar and which wait behind the filter
 * menu. Mobile pins every one (nested submenus are unusable on a phone);
 * desktop pins only the ones that are on.
 */
export function layoutExtras(opts: {
  state: ExtraState;
  pinAll: boolean;
  hasMenuExtra: boolean;
  hasSeries: boolean;
  hasCountries: boolean;
}): { shown: ExtraFilter[]; menu: ExtraFilter[] } {
  const { state, pinAll, hasMenuExtra, hasSeries, hasCountries } = opts;
  const visible = EXTRA_ORDER.filter((id) => hasExtraValue(id, state));
  const shown = pinAll ? EXTRA_ORDER : visible;
  const availableToAdd = pinAll
    ? []
    : EXTRA_ORDER.filter((id) => {
        if (shown.includes(id)) return false;
        if (visible.includes(id)) return false;
        if (id === "series" && !hasSeries) return false;
        if (id === "country" && !hasCountries) return false;
        return true;
      });
  const menu = hasMenuExtra
    ? EXTRA_ORDER.filter((id) => {
        if (id === "series") return hasSeries || hasExtraValue(id, state);
        if (id === "country") return hasCountries || hasExtraValue(id, state);
        return true;
      })
    : availableToAdd;
  return { shown, menu };
}

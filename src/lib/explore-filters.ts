import { sortCountryCodes } from "@/lib/geo/europe";

/** Series that belong to no one country (a world cup, a continental tour). */
export const INT_COUNTRY = "INT";

export type SeriesOption = {
  slug: string;
  name: string;
  eventCount: number;
  countryCode: string | null;
  shortName?: string | null;
};

export function seriesCountryKey(code: string | null | undefined) {
  const cc = (code || "").trim().toUpperCase();
  return cc.length === 2 ? cc : INT_COUNTRY;
}

/** A national cup has no races outside its country; an international one fits any choice. */
export function seriesOutsideCountries(
  seriesCode: string | null | undefined,
  series: string,
  countries: string[],
) {
  if (!series || countries.length === 0) return false;
  const key = seriesCountryKey(seriesCode);
  return key !== INT_COUNTRY && !countries.includes(key);
}

/** The countries that have a cup of their own, in the reader's order. */
export function seriesCountryCodes(list: SeriesOption[], locale: string): string[] {
  return sortCountryCodes(
    list.map((s) => seriesCountryKey(s.countryCode)).filter((k) => k !== INT_COUNTRY),
    locale,
  );
}

/** The cups that fit the countries chosen; all of them when none is. */
export function seriesInCountries(list: SeriesOption[], countries: string[]): SeriesOption[] {
  return countries.length
    ? list.filter((s) => countries.includes(seriesCountryKey(s.countryCode)))
    : list;
}

/** Add `value` to a chosen list, or take it out if it is already there. */
export function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * What picking these countries does to the filters: the countries, and — when
 * the cup already chosen is a national one from a country that is no longer
 * among them — dropping the cup, since it would answer with nothing.
 */
export function countryChange(
  current: { series: string },
  next: string[],
  seriesList: SeriesOption[],
): { country: string[]; dropSeries: boolean } {
  const row = seriesList.find((s) => s.slug === current.series);
  return {
    country: next,
    dropSeries: seriesOutsideCountries(row?.countryCode, current.series, next),
  };
}

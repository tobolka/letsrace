import { findNextEdition, type EditionIdentity } from "./edition-identity";

export type CountryEditionCoverage = { races: number; withEdition: number; publicRaces?: number };

export type EditionCoverageResult = {
  season: number;
  races: number;
  withEdition: number;
  publicRaces: number;
  byCountry: Record<string, CountryEditionCoverage>;
};

export type EditionCoverageHistoryRow = {
  day: string;
  races: number;
  withEdition: number;
};

export type EditionCoverageFile = EditionCoverageResult & {
  at: string;
  history: EditionCoverageHistoryRow[];
};

export const DEFAULT_COVERAGE_COUNTRIES = ["CZ", "SK", "DE", "AT", "PL", "CH", "IT"] as const;

/**
 * Count how many public races from the previous season already have a public
 * next-season edition in the live catalogue, broken down by country.
 */
export function computeEditionCoverage(
  previous: readonly EditionIdentity[],
  upcoming: readonly EditionIdentity[],
  targetSeason: number,
  countries?: readonly string[],
): EditionCoverageResult {
  const allowed = countries?.length ? new Set(countries.map(c => c.toUpperCase())) : null;
  const byCountry: Record<string, CountryEditionCoverage> = {};
  const combinedPool = [...previous, ...upcoming];
  let races = 0;
  let withEdition = 0;
  let publicRaces = 0;

  for (const race of upcoming) {
    const code = race.location?.country_code ?? "?";
    if (allowed && !allowed.has(code)) continue;
    publicRaces += 1;
    const held = (byCountry[code] ??= { races: 0, withEdition: 0, publicRaces: 0 });
    held.publicRaces = (held.publicRaces ?? 0) + 1;
  }

  for (const race of previous) {
    const code = race.location?.country_code ?? "?";
    if (allowed && !allowed.has(code)) continue;
    races += 1;
    const held = (byCountry[code] ??= { races: 0, withEdition: 0, publicRaces: 0 });
    held.races += 1;
    if (findNextEdition(race, combinedPool)) {
      withEdition += 1;
      held.withEdition += 1;
    }
  }

  return { season: targetSeason, races, withEdition, publicRaces, byCountry };
}

export function mergeEditionCoverageHistory(
  existing: readonly EditionCoverageHistoryRow[] | undefined,
  current: { races: number; withEdition: number },
  day: string,
  maxDays = 120,
): EditionCoverageHistoryRow[] {
  const rows = Array.isArray(existing) ? existing.filter(row => row?.day && row.day !== day) : [];
  return [...rows, { day, races: current.races, withEdition: current.withEdition }].slice(-maxDays);
}

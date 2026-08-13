/**
 * ISO 3166-1 alpha-2 codes we treat as Europe for Startline.
 * Includes EU/EFTA/UK, Balkans, Caucasus edge cases used in UCI calendars, and TR/CY.
 */
export const EUROPE_COUNTRY_CODES = [
  "AD",
  "AL",
  "AT",
  "BA",
  "BE",
  "BG",
  "BY",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FO",
  "FR",
  "GB",
  "GE",
  "GG",
  "GI",
  "GR",
  "HR",
  "HU",
  "IE",
  "IM",
  "IS",
  "IT",
  "JE",
  "LI",
  "LT",
  "LU",
  "LV",
  "MC",
  "MD",
  "ME",
  "MK",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "RS",
  "RU",
  "SE",
  "SI",
  "SK",
  "SM",
  "TR",
  "UA",
  "VA",
  "XK",
] as const;

export type EuropeCountryCode = (typeof EUROPE_COUNTRY_CODES)[number];

const EUROPE_SET = new Set<string>(EUROPE_COUNTRY_CODES);

/** True when code is a known European ISO-2 (case-insensitive). */
export function isEuropeanCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  const cc = code.trim().toUpperCase();
  if (cc.length !== 2) return false;
  return EUROPE_SET.has(cc);
}

/**
 * Unknown / missing country → keep (many CZ sources omit hints).
 * Explicit non-EU code → drop.
 */
export function shouldIngestByCountry(code: string | null | undefined): boolean {
  if (!code || !code.trim()) return true;
  const cc = code.trim().toUpperCase();
  if (cc.length !== 2) return true;
  return EUROPE_SET.has(cc);
}

/** Rough continental Europe + UK/Ireland (+ a bit of Turkey/Caucasus). */
export function isRoughlyInEurope(lat: number, lng: number): boolean {
  return lat >= 34 && lat <= 72 && lng >= -31 && lng <= 60;
}

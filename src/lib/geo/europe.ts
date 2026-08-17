import { pickerCountryCodes } from "@/lib/coverage";

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

/**
 * Temporarily off the public map / ingest to keep payloads smaller.
 * Still treated as Europe (admin, geocode) — just not listed.
 */
export const PAUSED_COUNTRY_CODES = [] as const;

const PAUSED_SET = new Set<string>(PAUSED_COUNTRY_CODES);

/** Countries shown on the public explore map. */
export const PUBLIC_COUNTRY_CODES = EUROPE_COUNTRY_CODES.filter(
  (c) => !PAUSED_SET.has(c),
);

/** Prefer coverage markets at the top of admin / filter country pickers. */
const PREFERRED_COUNTRY_CODES = pickerCountryCodes();

/** Europe ISO-2 codes with CZ / neighbouring countries first. */
export function europeCountryOptions(current?: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (code: string) => {
    const cc = code.trim().toUpperCase();
    if (!cc || seen.has(cc)) return;
    seen.add(cc);
    out.push(cc);
  };
  for (const c of PREFERRED_COUNTRY_CODES) push(c);
  for (const c of EUROPE_COUNTRY_CODES) push(c);
  if (current) push(current);
  return out;
}

const EUROPE_SET = new Set<string>(EUROPE_COUNTRY_CODES);

/** True when code is a known European ISO-2 (case-insensitive). */
export function isEuropeanCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  const cc = code.trim().toUpperCase();
  if (cc.length !== 2) return false;
  return EUROPE_SET.has(cc);
}

/** True when the country should appear on the public map. */
export function isListedCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  const cc = code.trim().toUpperCase();
  return EUROPE_SET.has(cc) && !PAUSED_SET.has(cc);
}

const displayNamesCache = new Map<string, Intl.DisplayNames>();

/** Localized country name (e.g. CZ → Česko / Czechia). */
export function countryDisplayName(code: string, locale = "en"): string {
  const cc = code.trim().toUpperCase();
  if (!cc) return code;
  try {
    let dn = displayNamesCache.get(locale);
    if (!dn) {
      dn = new Intl.DisplayNames([locale], { type: "region" });
      displayNamesCache.set(locale, dn);
    }
    return dn.of(cc) || cc;
  } catch {
    return cc;
  }
}

/** CZ and neighbours first, then the rest A–Z by localized name. */
export function sortCountryCodes(codes: string[], locale = "en"): string[] {
  const preferred = new Map<string, number>(
    PREFERRED_COUNTRY_CODES.map((c, i) => [c, i]),
  );
  return [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))].sort((a, b) => {
    const ia = preferred.get(a) ?? 1000;
    const ib = preferred.get(b) ?? 1000;
    if (ia !== ib) return ia - ib;
    return countryDisplayName(a, locale).localeCompare(countryDisplayName(b, locale), locale);
  });
}

/**
 * Unknown / missing country → keep (many CZ sources omit hints).
 * Explicit non-EU code → drop.
 */
export function shouldIngestByCountry(code: string | null | undefined): boolean {
  if (!code || !code.trim()) return true;
  const cc = code.trim().toUpperCase();
  if (cc.length !== 2) return true;
  if (PAUSED_SET.has(cc)) return false;
  return EUROPE_SET.has(cc);
}

/** Rough continental Europe + UK/Ireland (+ a bit of Turkey/Caucasus). */
export function isRoughlyInEurope(lat: number, lng: number): boolean {
  return lat >= 34 && lat <= 72 && lng >= -31 && lng <= 60;
}

/**
 * Camera cage for the map (SW → NE). Tighter than ingest on the east
 * so zooming out does not reveal the Middle East / Central Asia.
 */
export const EUROPE_MAP_BOUNDS: [[number, number], [number, number]] = [
  [-26, 34.2],
  [45, 71.8],
];

/**
 * Looser than pin bounds so the camera can pan Europe into the visible
 * map (left list panel eats ~400px) and toward the continental edges.
 */
export const EUROPE_CAMERA_BOUNDS: [[number, number], [number, number]] = [
  [-40, 28],
  [58, 75.5],
];

export function isInEuropeMap(lat: number, lng: number): boolean {
  const [[west, south], [east, north]] = EUROPE_MAP_BOUNDS;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

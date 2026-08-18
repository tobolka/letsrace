/**
 * Coverage markets — the single place to grow Startline beyond Czechia.
 *
 * Learn quality on `core` + `neighbor` first (riders near the border do not
 * care which side a race is on). Promote a country to `expanding` when ingest
 * is good enough for vacation / foreign riders, then to `neighbor`/`core`
 * once unlinked local calendars are trustworthy.
 *
 * Adding Slovenia, Croatia, France later is one Market object (+ an explorer
 * pack). Do not sprinkle country lists through the app.
 */

export type MarketStage = "core" | "neighbor" | "expanding" | "listed";

export type MapBBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type Market = {
  code: string;
  stage: MarketStage;
  /**
   * Local calendars are trusted enough to show a pin without a website /
   * registration URL. Keep false for thin federation dumps (Italy/FCI).
   */
  allowUnlinkedListing: boolean;
  /** Camera when GPS is unavailable. */
  center: { lng: number; lat: number };
  /** Country outline used when the search box is the country name. */
  bbox: MapBBox;
  /** Folded aliases (no diacritics) for place search. */
  aliases: string[];
};

export type PlaceHit = {
  lat: number;
  lng: number;
  countryCode: string;
  displayName: string;
  bounds: MapBBox;
};

function foldAlias(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[-–—_/,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function foldPlaceQuery(s: string): string {
  return foldAlias(s);
}

/** Race-name tokens that must not fly the map to a random Nominatim hit. */
const PLACE_SEARCH_STOP = new Set([
  "cup",
  "mtb",
  "xc",
  "xco",
  "xcm",
  "xcc",
  "xce",
  "cx",
  "uci",
  "race",
  "races",
  "zavod",
  "zavody",
  "pretek",
  "preteky",
  "wyscig",
  "rennen",
  "gara",
  "gravel",
  "bike",
  "kolo",
  "kids",
  "junior",
  "enduro",
  "dh",
]);

export function isPlaceSearchStopword(q: string): boolean {
  return PLACE_SEARCH_STOP.has(foldAlias(q));
}

export function boundsFromRadiusKm(lng: number, lat: number, radiusKm: number): MapBBox {
  const dLat = radiusKm / 111;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = radiusKm / (111 * Math.max(cos, 0.2));
  return {
    west: lng - dLng,
    south: lat - dLat,
    east: lng + dLng,
    north: lat + dLat,
  };
}

/**
 * Order is the admin / filter picker order: home first, then vacation
 * targets, then the rest of the listed roadmap.
 */
export const MARKETS: readonly Market[] = [
  {
    code: "CZ",
    stage: "core",
    allowUnlinkedListing: true,
    center: { lng: 15.5, lat: 49.75 },
    bbox: { west: 12.09, south: 48.55, east: 18.86, north: 51.06 },
    aliases: ["cesko", "ceska republika", "czechia", "czech republic", "czech", "cr"],
  },
  {
    code: "SK",
    stage: "neighbor",
    allowUnlinkedListing: true,
    center: { lng: 19.15, lat: 48.67 },
    bbox: { west: 16.83, south: 47.73, east: 22.57, north: 49.61 },
    aliases: ["slovensko", "slovakia"],
  },
  {
    code: "AT",
    stage: "neighbor",
    allowUnlinkedListing: true,
    center: { lng: 14.55, lat: 47.52 },
    bbox: { west: 9.53, south: 46.37, east: 17.16, north: 49.02 },
    aliases: ["rakousko", "austria", "osterreich", "oesterreich"],
  },
  {
    code: "DE",
    stage: "neighbor",
    allowUnlinkedListing: true,
    center: { lng: 10.45, lat: 51.16 },
    bbox: { west: 5.87, south: 47.27, east: 15.04, north: 55.06 },
    aliases: ["nemecko", "germany", "deutschland"],
  },
  {
    code: "PL",
    stage: "neighbor",
    allowUnlinkedListing: true,
    center: { lng: 19.4, lat: 52.07 },
    bbox: { west: 14.12, south: 49.0, east: 24.15, north: 54.84 },
    aliases: ["polsko", "poland", "polska"],
  },
  {
    code: "CH",
    stage: "neighbor",
    allowUnlinkedListing: true,
    center: { lng: 8.23, lat: 46.82 },
    bbox: { west: 5.96, south: 45.82, east: 10.49, north: 47.81 },
    aliases: ["svycarsko", "switzerland", "schweiz", "suisse", "svizzera"],
  },
  {
    code: "IT",
    stage: "expanding",
    allowUnlinkedListing: false,
    center: { lng: 12.5, lat: 42.5 },
    bbox: { west: 6.63, south: 36.64, east: 18.52, north: 47.09 },
    aliases: ["italie", "italy", "italia", "italien", "italsko"],
  },
  {
    code: "FR",
    stage: "listed",
    allowUnlinkedListing: false,
    center: { lng: 2.3, lat: 46.8 },
    bbox: { west: -5.14, south: 41.33, east: 9.56, north: 51.09 },
    aliases: ["francie", "france", "frankreich"],
  },
  {
    code: "SI",
    stage: "listed",
    allowUnlinkedListing: false,
    center: { lng: 14.8, lat: 46.05 },
    bbox: { west: 13.38, south: 45.42, east: 16.61, north: 46.88 },
    aliases: ["slovinsko", "slovenia", "slovenija"],
  },
  {
    code: "HR",
    stage: "listed",
    allowUnlinkedListing: false,
    center: { lng: 16.0, lat: 44.8 },
    bbox: { west: 13.49, south: 42.39, east: 19.43, north: 46.55 },
    aliases: ["chorvatsko", "croatia", "hrvatska"],
  },
  {
    code: "HU",
    stage: "listed",
    allowUnlinkedListing: false,
    center: { lng: 19.5, lat: 47.16 },
    bbox: { west: 16.11, south: 45.74, east: 22.9, north: 48.59 },
    aliases: ["madarsko", "hungary", "ungarn", "magyarorszag"],
  },
  {
    code: "NL",
    stage: "listed",
    allowUnlinkedListing: false,
    center: { lng: 5.3, lat: 52.2 },
    bbox: { west: 3.36, south: 50.75, east: 7.23, north: 53.55 },
    aliases: ["nizozemsko", "netherlands", "holland", "nederland"],
  },
  {
    code: "BE",
    stage: "listed",
    allowUnlinkedListing: false,
    center: { lng: 4.4, lat: 50.6 },
    bbox: { west: 2.54, south: 49.5, east: 6.4, north: 51.51 },
    aliases: ["belgie", "belgium", "belgien", "belgique"],
  },
  {
    code: "DK",
    stage: "listed",
    allowUnlinkedListing: false,
    center: { lng: 10.0, lat: 56.0 },
    bbox: { west: 8.07, south: 54.56, east: 15.16, north: 57.75 },
    aliases: ["dansko", "denmark", "danemark", "danmark"],
  },
  {
    code: "ES",
    stage: "listed",
    allowUnlinkedListing: false,
    center: { lng: -3.7, lat: 40.4 },
    bbox: { west: -9.3, south: 35.95, east: 4.33, north: 43.79 },
    aliases: ["spanelsko", "spain", "spanien", "espana"],
  },
  {
    code: "GB",
    stage: "listed",
    allowUnlinkedListing: false,
    center: { lng: -1.5, lat: 53.0 },
    bbox: { west: -8.62, south: 49.86, east: 1.77, north: 60.86 },
    aliases: ["velka britanie", "united kingdom", "uk", "britain", "england"],
  },
];

/** Vacation / border destinations that are not whole countries. */
const DESTINATION_PLACES: PlaceHit[] = [
  {
    lat: 45.58,
    lng: 10.64,
    countryCode: "IT",
    displayName: "Lake Garda",
    bounds: { west: 10.5, south: 45.38, east: 11.05, north: 45.92 },
  },
  {
    lat: 46.41,
    lng: 11.84,
    countryCode: "IT",
    displayName: "Dolomites",
    bounds: { west: 10.5, south: 46.15, east: 12.4, north: 47.1 },
  },
  {
    lat: 43.4,
    lng: 11.3,
    countryCode: "IT",
    displayName: "Tuscany",
    bounds: { west: 10.25, south: 42.35, east: 12.4, north: 44.5 },
  },
];

const DESTINATION_ALIAS_TO_INDEX = (() => {
  const map = new Map<string, number>();
  const aliases = [
    ["garda", "lago di garda", "lake garda", "gardasee"],
    ["dolomites", "dolomiti", "dolomity"],
    ["tuscany", "toskana", "toskansko", "toscana"],
  ];
  aliases.forEach((names, i) => {
    for (const n of names) map.set(foldAlias(n), i);
  });
  return map;
})();

const MARKET_BY_CODE = new Map(MARKETS.map((m) => [m.code, m]));
const MARKET_BY_ALIAS = (() => {
  const map = new Map<string, Market>();
  for (const m of MARKETS) {
    map.set(m.code.toLowerCase(), m);
    for (const a of m.aliases) map.set(foldAlias(a), m);
  }
  return map;
})();

export function marketByCode(code: string | null | undefined): Market | undefined {
  if (!code) return undefined;
  return MARKET_BY_CODE.get(code.trim().toUpperCase());
}

export function allowsUnlinkedPublicListing(code: string | null | undefined): boolean {
  return marketByCode(code)?.allowUnlinkedListing === true;
}

/** ISO-2 codes whose local calendars may appear without an enter link. */
export const UNLINKED_LISTING_CODES = MARKETS.filter((m) => m.allowUnlinkedListing).map(
  (m) => m.code,
);

/** Admin / filter picker: markets in coverage order, then the rest of Europe. */
export function pickerCountryCodes(): string[] {
  return MARKETS.map((m) => m.code);
}

function marketToPlace(m: Market): PlaceHit {
  return {
    lat: m.center.lat,
    lng: m.center.lng,
    countryCode: m.code,
    displayName: m.code,
    bounds: m.bbox,
  };
}

/** Country name / ISO code typed in the search box. */
export function resolveMarketPlace(q: string): PlaceHit | null {
  const key = foldAlias(q);
  if (!key) return null;
  const m = MARKET_BY_ALIAS.get(key);
  return m ? marketToPlace(m) : null;
}

export function resolveDestinationPlace(q: string): PlaceHit | null {
  const key = foldAlias(q);
  const i = DESTINATION_ALIAS_TO_INDEX.get(key);
  return i == null ? null : DESTINATION_PLACES[i]!;
}

/**
 * Instant place hit (country / known destination) without hitting Nominatim.
 * Towns stay in the gazetteer.
 */
export function resolveCoveragePlace(q: string): PlaceHit | null {
  if (isPlaceSearchStopword(q)) return null;
  return resolveMarketPlace(q) ?? resolveDestinationPlace(q);
}

const COLD_START_BY_LOCALE: Record<string, string> = {
  cs: "CZ",
  sk: "SK",
  pl: "PL",
  en: "CZ",
};

/** Until GPS arrives: speaker's home market, English still Czechia (where we learn). */
export function coldStartCenter(locale: string): { lng: number; lat: number } {
  const code = COLD_START_BY_LOCALE[locale] ?? "CZ";
  return marketByCode(code)?.center ?? { lng: 15.5, lat: 49.75 };
}

export type ExplorerWeight = "home" | "expanding" | "other";

export function explorerWeight(packId: string): ExplorerWeight {
  const m = marketByCode(packId);
  if (!m) return "other";
  if (m.stage === "core" || m.stage === "neighbor") return "home";
  if (m.stage === "expanding") return "expanding";
  return "other";
}

/** Countries the public map actually offers — listed markets stay on the roadmap. */
export function isPublicMapMarket(code: string | null | undefined): boolean {
  const stage = marketByCode(code)?.stage;
  return stage === "core" || stage === "neighbor" || stage === "expanding";
}

export const PUBLIC_MAP_CODES = MARKETS.filter((m) =>
  m.stage === "core" || m.stage === "neighbor" || m.stage === "expanding",
).map((m) => m.code);

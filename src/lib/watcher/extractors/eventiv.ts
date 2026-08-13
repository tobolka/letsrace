import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { shouldIngestByCountry } from "@/lib/geo/europe";

type MapFeature = {
  type: string;
  geometry?: { type: string; coordinates?: [number, number] };
  properties?: {
    id?: string;
    slug?: string;
    title?: string;
    sport_type?: string;
    category?: string;
    date_start?: string;
    location_name?: string;
    country?: string;
    website_url?: string | null;
  };
};

type MapResponse = {
  type: string;
  features: MapFeature[];
};

const BIKE_SPORTS = new Set(["road", "mtb", "gravel", "cyclocross", "bmx", "track"]);

const SPORT_TO_DISC: Record<string, Discipline> = {
  road: "road",
  mtb: "mtb",
  gravel: "gravel",
  cyclocross: "cx",
  bmx: "bmx",
  track: "track",
};

const COUNTRY_TO_CC: Record<string, string> = {
  czechia: "CZ",
  "czech republic": "CZ",
  tschechien: "CZ",
  slovakia: "SK",
  slovaquie: "SK",
  slowakei: "SK",
  poland: "PL",
  pologne: "PL",
  polen: "PL",
  germany: "DE",
  deutschland: "DE",
  allemagne: "DE",
  austria: "AT",
  österreich: "AT",
  autriche: "AT",
  switzerland: "CH",
  schweiz: "CH",
  suisse: "CH",
  italy: "IT",
  italie: "IT",
  italien: "IT",
  france: "FR",
  frankreich: "FR",
  spain: "ES",
  espagne: "ES",
  portugal: "PT",
  belgium: "BE",
  belgique: "BE",
  belgien: "BE",
  netherlands: "NL",
  "the netherlands": "NL",
  niederlande: "NL",
  "pays-bas": "NL",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  "royaume uni": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "wales, united kingdom": "GB",
  ireland: "IE",
  irlande: "IE",
  denmark: "DK",
  danemark: "DK",
  dänemark: "DK",
  sweden: "SE",
  suède: "SE",
  norway: "NO",
  norvège: "NO",
  finland: "FI",
  finlande: "FI",
  hungary: "HU",
  hongrie: "HU",
  slovenia: "SI",
  slovénie: "SI",
  croatia: "HR",
  croatie: "HR",
  usa: "US",
  us: "US",
  "united states": "US",
  "united states of america": "US",
  "états unis": "US",
  "états-unis": "US",
  canada: "CA",
  australia: "AU",
  australie: "AU",
  "new zealand": "NZ",
  "nouvelle-zélande": "NZ",
  japan: "JP",
  japon: "JP",
  china: "CN",
  chine: "CN",
  andorra: "AD",
  andorre: "AD",
  luxembourg: "LU",
  liechtenstein: "LI",
  romania: "RO",
  roumanie: "RO",
  greece: "GR",
  grèce: "GR",
  turkey: "TR",
  türkiye: "TR",
  "republic of türkiye": "TR",
  turquie: "TR",
  brazil: "BR",
  brésil: "BR",
  argentina: "AR",
  argentine: "AR",
  chile: "CL",
  chili: "CL",
  colombia: "CO",
  colombie: "CO",
  mexico: "MX",
  mexique: "MX",
  "south africa": "ZA",
  "afrique du sud": "ZA",
  "south korea": "KR",
  "corée du sud": "KR",
  "korea, republic of": "KR",
  singapore: "SG",
  india: "IN",
  inde: "IN",
  thailand: "TH",
  thaïlande: "TH",
  malaysia: "MY",
  indonesia: "ID",
  indonésie: "ID",
  "hong kong": "HK",
  taiwan: "TW",
  taïwan: "TW",
  "chinese taipei": "TW",
  "united arab emirates": "AE",
  uae: "AE",
  israel: "IL",
  israël: "IL",
  estonia: "EE",
  latvia: "LV",
  lithuania: "LT",
  bulgaria: "BG",
  bulgarie: "BG",
  serbia: "RS",
  serbie: "RS",
  ukraine: "UA",
  iceland: "IS",
  islande: "IS",
  malta: "MT",
  monaco: "MC",
  cyprus: "CY",
  chypre: "CY",
  morocco: "MA",
  maroc: "MA",
  russia: "RU",
  "russian federation": "RU",
  kazakhstan: "KZ",
  qazaqstan: "KZ",
  peru: "PE",
  pérou: "PE",
  ecuador: "EC",
  équateur: "EC",
  "costa rica": "CR",
  "new caledonia": "NC",
  "nouvelle-calédonie": "NC",
  reunion: "RE",
  "la réunion": "RE",
  réunion: "RE",
  jersey: "JE",
  "dominican republic": "DO",
  "république dominicaine": "DO",
  guatemala: "GT",
  panama: "PA",
  uruguay: "UY",
  paraguay: "PY",
  venezuela: "VE",
  philippines: "PH",
  vietnam: "VN",
  "viêt nam": "VN",
  oman: "OM",
  qatar: "QA",
  "saudi arabia": "SA",
  "arabie saoudite": "SA",
  jordan: "JO",
  namibia: "NA",
  namibie: "NA",
  kenya: "KE",
  egypt: "EG",
  algeria: "DZ",
  algérie: "DZ",
  ethiopia: "ET",
  éthiopie: "ET",
  rwanda: "RW",
  uganda: "UG",
  zimbabwe: "ZW",
  zambia: "ZM",
  cameroon: "CM",
  senegal: "SN",
  sénégal: "SN",
  mauritius: "MU",
  maurice: "MU",
  "puerto rico": "PR",
  "el salvador": "SV",
  honduras: "HN",
  bolivia: "BO",
  bolivie: "BO",
  "bosnia and herzegovina": "BA",
  "bosnie-herzégovine": "BA",
  montenegro: "ME",
  "north macedonia": "MK",
  "macédoine du nord": "MK",
  albania: "AL",
  georgia: "GE",
  géorgie: "GE",
  armenia: "AM",
  azerbaijan: "AZ",
  uzbekistan: "UZ",
  mongolia: "MN",
  mongolie: "MN",
  moldova: "MD",
  belarus: "BY",
  kosovo: "XK",
  nepal: "NP",
  laos: "LA",
  cambodia: "KH",
  cambodge: "KH",
  "sri lanka": "LK",
  bangladesh: "BD",
  "trinidad and tobago": "TT",
  bahamas: "BS",
  barbados: "BB",
  bermuda: "BM",
  belize: "BZ",
  cuba: "CU",
  jamaica: "JM",
  jamaïque: "JM",
  gibraltar: "GI",
  antarctica: "AQ",
  "french polynesia": "PF",
  "polynésie française": "PF",
  guadeloupe: "GP",
  martinique: "MQ",
  "guyane française": "GF",
  iran: "IR",
  lebanon: "LB",
  palestine: "PS",
  syria: "SY",
  afghanistan: "AF",
  kyrgyzstan: "KG",
  tajikistan: "TJ",
  lesotho: "LS",
  "cape verde": "CV",
  "cabo verde": "CV",
  "cap-vert": "CV",
  mali: "ML",
  benin: "BJ",
  bénin: "BJ",
  "burkina faso": "BF",
  burundi: "BI",
  eritrea: "ER",
  mauritania: "MR",
  "sierra leone": "SL",
  seychelles: "SC",
  suriname: "SR",
  samoa: "WS",
  mayotte: "YT",
  "cayman islands": "KY",
  macau: "MO",
  "saint-barthélemy": "BL",
  bhutan: "BT",
};

const ISO3_TO_CC: Record<string, string> = {
  CZE: "CZ",
  SVK: "SK",
  POL: "PL",
  DEU: "DE",
  GER: "DE",
  AUT: "AT",
  CHE: "CH",
  SUI: "CH",
  ITA: "IT",
  FRA: "FR",
  ESP: "ES",
  PRT: "PT",
  BEL: "BE",
  NLD: "NL",
  NED: "NL",
  GBR: "GB",
  IRL: "IE",
  DEN: "DK",
  SWE: "SE",
  NOR: "NO",
  FIN: "FI",
  HUN: "HU",
  SLO: "SI",
  CRO: "HR",
  USA: "US",
  CAN: "CA",
  AUS: "AU",
  JPN: "JP",
  CHN: "CN",
  ROU: "RO",
  GRC: "GR",
  TUR: "TR",
  BRA: "BR",
  ARG: "AR",
  CHL: "CL",
  COL: "CO",
  MEX: "MX",
  RSA: "ZA",
  ZAF: "ZA",
  KOR: "KR",
  SIN: "SG",
  SGP: "SG",
  IND: "IN",
  THA: "TH",
  MAS: "MY",
  IDN: "ID",
  TWN: "TW",
  ARE: "AE",
  ISR: "IL",
  EST: "EE",
  LAT: "LV",
  LTU: "LT",
  BUL: "BG",
  SRB: "RS",
  UKR: "UA",
  ISL: "IS",
  MLT: "MT",
  MCO: "MC",
  CYP: "CY",
  MAR: "MA",
  RUS: "RU",
  KAZ: "KZ",
  PER: "PE",
  ECU: "EC",
  CRI: "CR",
  DOM: "DO",
  URY: "UY",
  PRY: "PY",
  VEN: "VE",
  PHL: "PH",
  VNM: "VN",
  OMN: "OM",
  QAT: "QA",
  SAU: "SA",
  JOR: "JO",
  NAM: "NA",
  KEN: "KE",
  EGY: "EG",
  DZA: "DZ",
  ETH: "ET",
  RWA: "RW",
  UGA: "UG",
  ZWE: "ZW",
  ZMB: "ZM",
  CMR: "CM",
  SEN: "SN",
  MUS: "MU",
  PRI: "PR",
  SLV: "SV",
  HND: "HN",
  BOL: "BO",
  BIH: "BA",
  MNE: "ME",
  MKD: "MK",
  ALB: "AL",
  GEO: "GE",
  ARM: "AM",
  AZE: "AZ",
  UZB: "UZ",
  MNG: "MN",
  MDA: "MD",
  BLR: "BY",
  NPL: "NP",
  LAO: "LA",
  KHM: "KH",
  LKA: "LK",
  BGD: "BD",
  LUX: "LU",
  AND: "AD",
  LIE: "LI",
};

function countryCode(name?: string | null): string | undefined {
  if (!name) return undefined;
  const raw = name.trim();
  if (!raw || /^(unknown|tbc|tbd|---|europe|global|international|multiple countries)$/i.test(raw)) {
    return undefined;
  }
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  if (/^[A-Za-z]{3}$/.test(raw)) {
    const iso3 = ISO3_TO_CC[raw.toUpperCase()];
    if (iso3) return iso3;
  }
  const key = raw.toLowerCase();
  return COUNTRY_TO_CC[key];
}

function toParsed(f: MapFeature): ParsedEvent | null {
  const p = f.properties;
  if (!p?.title || !p.date_start) return null;
  const sport = (p.sport_type || "").toLowerCase();
  if (!BIKE_SPORTS.has(sport)) return null;

  const startDate = p.date_start.slice(0, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  if (startDate < cutoff.toISOString().slice(0, 10)) return null;

  const coords = f.geometry?.coordinates;
  const lng = coords?.[0];
  const lat = coords?.[1];
  const place = p.location_name || p.country || "Unknown";
  const disc = SPORT_TO_DISC[sport] || "other";
  const id = p.id || p.slug || normalizeName(p.title);
  const sourceUrl = p.slug
    ? `https://eventivsport.com/events/${p.slug}`
    : "https://eventivsport.com/map";
  const websiteUrl = p.website_url || undefined;
  const cc = countryCode(p.country) || countryCode(place);
  if (cc && !shouldIngestByCountry(cc)) return null;
  // No country but clearly outside Europe (Eventiv is global)
  if (
    !cc &&
    typeof lat === "number" &&
    typeof lng === "number" &&
    (lat < 34 || lat > 72 || lng < -31 || lng > 60)
  ) {
    return null;
  }

  return {
    externalId: `eventiv-${id}-${startDate}`,
    name: p.title.trim(),
    startDate,
    placeText: place.slice(0, 100),
    countryHint: cc,
    discipline: [disc],
    audience: /kids|junior|youth|u1[0-9]|žák|deti/i.test(p.title) ? "youth" : "mixed",
    sourceUrl,
    websiteUrl,
    registrationUrl: websiteUrl,
    lat: typeof lat === "number" ? lat : undefined,
    lng: typeof lng === "number" ? lng : undefined,
    confidence: 0.88,
  };
}

async function fetchBikeMap(sport: string): Promise<MapFeature[]> {
  const url = `https://eventivsport.com/api/events/map?sport_type=${encodeURIComponent(sport)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "StartlineBot/0.1 (+https://startline.app; race calendar aggregator)",
    },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as MapResponse;
  return data.features ?? [];
}

/** eventivsport.com/map — GeoJSON map API, cycling sports only. */
export async function parseEventiv(_url: string, _html?: string): Promise<ParsedEvent[]> {
  const byId = new Map<string, ParsedEvent>();
  const sports = ["road", "mtb", "gravel", "cyclocross", "bmx", "track"];

  // Parallel sport fetches (each filtered server-side — much smaller than full map)
  const batches = await Promise.all(sports.map((s) => fetchBikeMap(s)));
  for (const features of batches) {
    for (const f of features) {
      const ev = toParsed(f);
      if (!ev) continue;
      byId.set(ev.externalId, ev);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 180);
  const horizonStr = horizon.toISOString().slice(0, 10);

  return [...byId.values()]
    .filter((e) => e.startDate >= today && e.startDate <= horizonStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

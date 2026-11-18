import type { ParsedCategory, ParsedEvent } from "@/lib/domain";
import type { AgeCategory, Discipline, RaceLevel, UciClass } from "@/lib/taxonomy";
import { AGE_CATEGORIES, audienceFromAgeCategories } from "@/lib/taxonomy";

/**
 * The UCI Competition Directory (uci-competition.tech.uci.ch): every competition on the UCI
 * calendar with its class, venue, dates, organiser website and e-mail, and the race of each
 * category (Men Elite, Women Junior, …). Its public pages are a JavaScript app over a JSON API
 * on the same host; the API is what this reads.
 */
export const UCI_DIRECTORY = "https://uci-competition.tech.uci.ch";
/** The UCI's codes for the countries on our map (`PUBLIC_MAP_CODES`). */
export const UCI_DIRECTORY_COUNTRIES: Record<string, string> = { CZE: "CZ", SVK: "SK", GER: "DE", POL: "PL", AUT: "AT", ITA: "IT", SUI: "CH" };

export type UciDirectoryRace = { name?: string | null; categoryCode?: string | null; categoryName?: string | null; raceTypeCode?: string | null; startDate?: string | null; endDate?: string | null };
export type UciDirectoryCompetition = {
  id: string; code?: string | null; name: string; seasonYear: number; disciplineCode: string; classCode?: string | null; className?: string | null;
  countryCode: string; venue?: string | null; startDate: string; endDate?: string | null; website?: string | null; email?: string | null;
  categoryCodes?: string[] | null; raceTypes?: { code: string; name?: string }[] | null; races?: UciDirectoryRace[] | null;
};

export const uciDirectoryPage = (id: string) => `${UCI_DIRECTORY}/competitions/${id}`;
export const uciDirectoryApi = (id: string) => `${UCI_DIRECTORY}/api/competitions/${id}`;
export function uciDirectoryId(url: string | null | undefined): string | null {
  return url?.match(/^https:\/\/uci-competition\.tech\.uci\.ch\/(?:api\/)?competitions\/([0-9a-f-]{36})\/?$/i)?.[1]?.toLowerCase() ?? null;
}

/** UCI class codes as the catalogue's classes. "1"/"2"/"3" are mountain-bike classes; "1.2U" is a 1.2 for under-23s. */
export function uciDirectoryClass(code: string | null | undefined, discipline: string): UciClass | null {
  const c = (code ?? "").trim();
  if (/^[123]$/.test(c)) return discipline === "MTB" || discipline === "BMX" ? (`c${c}` as UciClass) : null;
  if (/^C[123]$/i.test(c)) return c.toLowerCase() as UciClass;
  if (/^HC$/i.test(c)) return "hc";
  if (/^CDM$/i.test(c)) return "cdm";
  if (/^CS$/i.test(c)) return "cs";
  if (/^[12]\.Pro$/i.test(c)) return "proseries";
  if (/^[12]\.(UWT|WWT)$/i.test(c)) return "worldtour";
  const road = c.match(/^([12]\.[12])U?$/i);
  return road ? (road[1] as UciClass) : null;
}

/** How far the competition reaches. Championships by their class; every other UCI-registered class is international. */
export function uciDirectoryLevel(code: string | null | undefined): RaceLevel {
  const c = (code ?? "").trim().toUpperCase();
  if (c === "CM" || c === "CMM") return "world_championship";
  if (c === "CC") return "european_championship";
  if (c === "CDM") return "world_cup";
  if (c === "CN") return "national";
  if (c === "CS") return "continental";
  return "international";
}

const RACE_TYPE: Record<string, Discipline> = {
  IRR: "road_race", ITT: "tt", TTT: "tt", XCO: "xco", "XCO-JS": "xco", "E-XC": "xco", XCC: "xcc", XCE: "xce", XCM: "xcm",
  DHI: "dh", EDR: "enduro", "4X": "four_cross",
};

/** The disciplines of a competition; null for those the catalogue does not carry (indoor, trials). */
export function uciDirectoryDisciplines(c: Pick<UciDirectoryCompetition, "disciplineCode" | "raceTypes" | "races">): Discipline[] | null {
  const types = new Set([...(c.raceTypes ?? []).map((t) => t.code), ...(c.races ?? []).map((r) => r.raceTypeCode ?? "")].filter(Boolean));
  const out = new Set<Discipline>();
  switch (c.disciplineCode) {
    case "ROA": case "PRD": out.add("road"); break;
    case "CRO": out.add("cx"); return [...out];
    case "MTB": out.add("mtb"); break;
    case "CTR": case "PTR": out.add("track"); return [...out];
    case "BMX": case "BFR": out.add("bmx"); return [...out];
    case "GRA": out.add("gravel"); return [...out];
    default: return null;
  }
  for (const type of types) { const d = RACE_TYPE[type]; if (d) out.add(d); }
  return [...out];
}

const CATEGORY_AGES: Record<string, AgeCategory[]> = {
  ME: ["elite"], WE: ["elite"], XE: ["elite"], MJ: ["junior"], WJ: ["junior"], XJ: ["junior"], MU: ["u23"], WU: ["u23"],
  XY: ["youth"], MM: ["masters"], WM: ["masters"],
};
/** "B12"/"G13": a boys' or girls' class by age, used in BMX. */
function ageClass(code: string): AgeCategory[] {
  const m = code.match(/^[BG](\d{1,2})$/);
  if (!m) return [];
  const age = Number(m[1]);
  const band: AgeCategory = age <= 6 ? "u7" : age <= 8 ? "u9" : age <= 10 ? "u11" : age <= 12 ? "u13" : age <= 14 ? "u15" : age <= 16 ? "u17" : "junior";
  return [band];
}

/** Our age classes for UCI category codes. Only the UCI's own categories: a race may run national ones beside them. */
export function uciDirectoryAges(codes: string[]): AgeCategory[] {
  const found = new Set<AgeCategory>();
  for (const code of codes) for (const age of CATEGORY_AGES[code.toUpperCase()] ?? ageClass(code.toUpperCase())) found.add(age);
  if (["u7", "u9", "u11"].some((a) => found.has(a as AgeCategory))) found.add("kids");
  if (["u13", "u15", "u17"].some((a) => found.has(a as AgeCategory))) found.add("youth");
  return AGE_CATEGORIES.filter((a) => found.has(a));
}

/** "www.cyklokros.cz", "Gpwb.cz" → https URL; anything else is no website. */
export function uciDirectoryWebsite(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim().replace(/[\s,;]+$/, "");
  if (!text || /\s/.test(text) || /@/.test(text)) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch { return null; }
}

export function uciDirectoryEmail(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim().split(/[\s,;]+/)[0] ?? "";
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(text) ? text : null;
}

/** The race of each category, "Men Elite", once each. */
export function uciDirectoryCategories(c: UciDirectoryCompetition): ParsedCategory[] {
  const seen = new Set<string>();
  const out: ParsedCategory[] = [];
  for (const race of c.races ?? []) {
    const name = (race.categoryName ?? race.name ?? "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const code = (race.categoryCode ?? "").toUpperCase();
    const ages = uciDirectoryAges(code ? [code] : []);
    out.push({ name, ...(code.startsWith("W") || code.startsWith("G") ? { gender: "female" } : code.startsWith("M") || code.startsWith("B") ? { gender: "male" } : {}), ...(ages.length ? { audience: audienceFromAgeCategories(ages) } : {}) });
  }
  return out;
}

/** The fields this reader asserts, in a fixed order, so the gate can compare a re-read word for word. */
export function uciDirectoryQuote(c: UciDirectoryCompetition): string {
  // The dates first, written as calendars write them ("30.4.–2.5.2027"), so a multi-day competition's end is stated too.
  const [sy, sm, sd] = c.startDate.slice(0, 10).split("-").map(Number);
  const [ey, em, ed] = (c.endDate ?? c.startDate).slice(0, 10).split("-").map(Number);
  const dates = sy === ey && sm === em && sd === ed ? `${sd}.${sm}.${sy}` : sy === ey ? `${sd}.${sm}.–${ed}.${em}.${ey}` : `${sd}.${sm}.${sy}–${ed}.${em}.${ey}`;
  return `${dates} · ` + JSON.stringify({
    id: c.id, code: c.code ?? null, name: c.name, seasonYear: c.seasonYear, disciplineCode: c.disciplineCode, classCode: c.classCode ?? null,
    countryCode: c.countryCode, venue: c.venue ?? null, startDate: c.startDate, endDate: c.endDate ?? null, website: c.website ?? null, email: c.email ?? null,
    categoryCodes: c.categoryCodes ?? [], raceTypes: (c.raceTypes ?? []).map((t) => t.code),
    races: (c.races ?? []).map((r) => [r.categoryCode ?? null, r.categoryName ?? null, r.startDate ?? null, r.endDate ?? null]),
  });
}

/** One directory competition as a catalogue race; null when it is not one the catalogue carries. */
export function uciDirectoryEvent(c: UciDirectoryCompetition): ParsedEvent | null {
  const country = UCI_DIRECTORY_COUNTRIES[c.countryCode];
  const disciplines = uciDirectoryDisciplines(c);
  const start = c.startDate?.slice(0, 10), end = (c.endDate ?? c.startDate)?.slice(0, 10);
  if (!country || !disciplines?.length || !/^\d{4}-\d{2}-\d{2}$/.test(start ?? "") || !end || end < start || !c.name?.trim() || !c.venue?.trim()) return null;
  const codes = c.categoryCodes ?? [];
  const ages = uciDirectoryAges(codes);
  const website = uciDirectoryWebsite(c.website);
  const uciClass = uciDirectoryClass(c.classCode, c.disciplineCode);
  const categories = uciDirectoryCategories(c);
  const url = uciDirectoryPage(c.id);
  return {
    externalId: `uci-dir:${c.id}`, name: c.name.trim(), startDate: start, ...(end !== start ? { endDate: end } : {}),
    placeText: c.venue.trim(), countryHint: country, discipline: disciplines, eventType: "race",
    ...(uciClass ? { uciClass } : {}),
    ...(ages.length ? { ageCategories: ages, audience: audienceFromAgeCategories(ages) } : {}),
    ...(categories.length ? { categories } : {}),
    sourceUrl: url, ...(website ? { websiteUrl: website } : {}),
    confidence: 0.98,
    evidence: { quote: uciDirectoryQuote(c), sourceUrl: url, method: "uci_directory", version: "uci-directory-v2" },
  };
}

type Fetch = (url: string) => Promise<unknown>;
const getJson: Fetch = async (url) => {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "letsrace-catalog/1.0 (+https://letsrace.cz)" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw Error(`UCI directory HTTP ${response.status}`);
  return response.json();
};

/** Every competition of a season in one country, page by page. */
export async function listUciDirectory(season: number, country: string, get: Fetch = getJson): Promise<UciDirectoryCompetition[]> {
  const out: UciDirectoryCompetition[] = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const page = await get(`${UCI_DIRECTORY}/api/competitions?seasonYear=${season}&countryCode=${country}&limit=100&offset=${offset}`) as { count?: number; items?: UciDirectoryCompetition[] };
    const items = page.items ?? [];
    out.push(...items);
    if (items.length < 100 || out.length >= (page.count ?? 0)) break;
  }
  return out;
}

export async function readUciDirectoryCompetition(id: string, get: Fetch = getJson): Promise<UciDirectoryCompetition> {
  return await get(uciDirectoryApi(id)) as UciDirectoryCompetition;
}

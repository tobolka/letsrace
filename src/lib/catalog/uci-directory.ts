import type { ParsedCategory, ParsedEvent } from "@/lib/domain";
import type { PracticalDetails } from "@/lib/practical-details";
import type { AgeCategory, Discipline, RaceLevel, UciClass } from "@/lib/taxonomy";
import { AGE_CATEGORIES, audienceFromAgeCategories, levelAtLeast } from "@/lib/taxonomy";

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

/** Current UCI categories replace inherited guesses. Current regulations retain their additional classes. */
export function uciDirectoryCategoryState(event: ParsedEvent, current: {
  name: string; age_categories: string[] | null; age_confidence: string | null;
  practical_details: Record<string, unknown> | null;
}): { ages: AgeCategory[]; confidence: string | null } {
  const listed = event.ageCategories ?? [];
  const previous = current.age_categories ?? [];
  if (!listed.length) return { ages: AGE_CATEGORIES.filter(a => previous.includes(a)), confidence: current.age_confidence };
  const categories = current.practical_details?.categories as { editionYear?: number; status?: string; sourceUrl?: string; quote?: string } | undefined;
  const currentRules = categories?.status === "current" && categories.editionYear === Number(event.startDate.slice(0, 4))
    && !uciDirectoryId(categories.sourceUrl) && !categories.quote?.startsWith("UCI Competition Directory");
  const massStart = (event.discipline ?? []).some(d => ["xcm", "gran_fondo", "gravel"].includes(d))
    || /marathon|maraton|fondo|gravel/i.test(`${event.name} ${current.name}`);
  // A linked UCI race can describe one part of a weekend, or be an incorrect match.
  // Replacing the entire inherited set requires the same competition identity.
  const normalizedName = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/\b20\d{2}\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const sameName = normalizedName(event.name) === normalizedName(current.name);
  const keepExisting = currentRules || current.age_confidence === "explicit" || massStart || !sameName;
  const ages = AGE_CATEGORIES.filter(a => listed.includes(a) || keepExisting && previous.includes(a));
  const accounted = ages.every(a => listed.includes(a));
  return { ages, confidence: accounted ? "explicit" : current.age_confidence ?? "default" };
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
  const name = c.disciplineCode === "BMX" && !/\bbmx\b/i.test(c.name) ? `${c.name.trim()} - BMX Racing` : c.name.trim();
  return {
    externalId: `uci-dir:${c.id}`, name, startDate: start, ...(end !== start ? { endDate: end } : {}),
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
const RETRYABLE_HTTP = new Set([408, 425, 429]);
const isRetryableStatus = (status: number) => RETRYABLE_HTTP.has(status) || status >= 500;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function retryDelayMs(attempt: number, retryAfterHeader?: string | null): number {
  const seconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(15_000, Math.ceil(seconds * 1000));
  return Math.min(8_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

/** Fetch JSON from the UCI directory API with bounded retry and backoff on transient errors. */
export async function fetchUciJson(
  url: string,
  options: { fetch?: typeof globalThis.fetch; wait?: (ms: number) => Promise<void>; retries?: number; timeoutMs?: number } = {},
): Promise<unknown> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const doWait = options.wait ?? sleep;
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 30_000;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await doFetch(url, {
        headers: { Accept: "application/json", "User-Agent": "letsrace-catalog/1.0 (+https://letsrace.cz)" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return await response.json();
      lastError = Error(`UCI directory HTTP ${response.status}`);
      if (!isRetryableStatus(response.status) || attempt === retries) throw lastError;
      await doWait(retryDelayMs(attempt, response.headers?.get?.("retry-after")));
    } catch (error) {
      lastError = error;
      if (error instanceof Error && /^UCI directory HTTP \d+$/.test(error.message)) {
        const status = Number(error.message.slice("UCI directory HTTP ".length));
        if (!isRetryableStatus(status)) throw error;
      }
      if (attempt === retries) throw error;
      await doWait(retryDelayMs(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : Error("UCI directory fetch failed");
}

const getJson: Fetch = (url) => fetchUciJson(url);

/** Every competition of a season in one country, page by page. */
export async function listUciDirectory(season: number, country: string, get: Fetch = getJson): Promise<UciDirectoryCompetition[]> {
  const out: UciDirectoryCompetition[] = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const page = await get(`${UCI_DIRECTORY}/api/competitions?seasonYear=${season}&countryCode=${country}&limit=100&offset=${offset}`) as { count?: number; items?: UciDirectoryCompetition[] } | null;
    const items = page?.items ?? [];
    out.push(...items);
    if (items.length < 100 || out.length >= (page?.count ?? 0)) break;
  }
  return out;
}

export async function readUciDirectoryCompetition(id: string, get: Fetch = getJson): Promise<UciDirectoryCompetition> {
  return await get(uciDirectoryApi(id)) as UciDirectoryCompetition;
}

export type UciCatalogRow = {
  id: string; slug: string; name: string; start_date: string; end_date: string | null; visibility: string; status: string | null; merged_into_id: string | null;
  level: string | null; uci_class: string | null; website_url: string | null; registration_url: string | null; regulations_url: string | null; results_url: string | null;
  age_categories: string[] | null; age_confidence: string | null; audience: string; public_revision: string; practical_details: Record<string, unknown> | null;
  disciplines: string[] | null; location: { municipality: string | null; country_code: string | null } | null; sources: { source_url: string | null; external_id: string | null }[];
  overrides: { locked_fields: string[] | null } | null;
};

export type UciEventPatch = { uci_class?: string; level?: string; age_categories?: string[]; audience?: string; age_confidence?: string };
export type UciEventFact = { event_id: string; field: string; value: unknown; previous: unknown; source_url: string; quote: string; method: string; version: string };

export type UciEnrichDeps = {
  apply: boolean;
  updateEvent: (id: string, revision: string, patch: UciEventPatch, facts: UciEventFact[]) => Promise<string>;
  insertSource: (eventId: string, sourceUrl: string, externalId: string) => Promise<void>;
  saveWebsite: (row: UciCatalogRow, website: string) => Promise<boolean>;
  readRevision: (eventId: string) => Promise<string | null>;
  savePracticalDetails: (eventId: string, revision: string, details: PracticalDetails) => Promise<{ status: string }>;
};

const AGE_FIELDS = ["age_categories", "age_confidence", "audience"];

function canonicalSite(url: string) {
  return url.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

function websiteWouldChange(current: string | null) {
  return !current || /uci\.org|federciclismo|rideandrest|radsport-events|rad-net|pzkol|cyklokros\.cz\/kalendar/i.test(current);
}

function safeWebsiteHost(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Enrich one catalogue row from a matched UCI directory competition and keep the
 * in-memory row snapshot synchronized after each write so later matches in the
 * same run see the updated fields and `public_revision`.
 */
export async function enrichUciCatalogRow(
  r: UciCatalogRow,
  { competition, event }: { competition: UciDirectoryCompetition; event: ParsedEvent },
  deps: UciEnrichDeps,
): Promise<string[]> {
  const locked = new Set(r.overrides?.locked_fields ?? []);
  const changes: string[] = [];
  const update: UciEventPatch = {};
  const uciClass = event.uciClass;
  if (uciClass && !r.uci_class && !locked.has("uci_class")) { update.uci_class = uciClass; changes.push(`třída ${uciClass}`); }
  const level = uciDirectoryLevel(competition.classCode);
  if (!locked.has("level") && level !== r.level && levelAtLeast(level, (r.level ?? "local") as never)) { update.level = level; changes.push(`úroveň ${level}`); }
  const ages = event.ageCategories ?? [];
  const previous = r.age_categories ?? [];
  const { ages: merged, confidence } = uciDirectoryCategoryState(event, r);
  const agesChange = merged.length !== previous.length || merged.some((a) => !previous.includes(a));
  if (ages.length && !AGE_FIELDS.some((f) => locked.has(f)) && (agesChange || confidence !== r.age_confidence)) {
    if (agesChange) { update.age_categories = merged; update.audience = audienceFromAgeCategories(merged); changes.push(`kategorie ${previous.join("/")} → ${merged.join("/")}`); }
    if (confidence !== r.age_confidence) { update.age_confidence = confidence ?? "default"; changes.push(confidence === "explicit" ? "kategorie potvrzené UCI" : "kategorie odhad"); }
  }
  const hasSource = r.sources.some((s) => s.external_id === event.externalId || uciDirectoryId(s.source_url) === competition.id);
  if (!hasSource) changes.push("zdroj UCI");
  const pd = r.practical_details ?? {};
  const labels = (event.categories ?? []).map((c) => c.name);
  const website = event.websiteUrl ?? null;
  const email = uciDirectoryEmail(competition.email);
  const host = website ? safeWebsiteHost(website) : null;
  const needsCategories = labels.length > 0 && !pd.categories;
  const needsOrganizer = Boolean(email && website && host && !pd.organizer);
  if (needsCategories) changes.push("popisky kategorií");
  if (needsOrganizer) changes.push("e-mail pořadatele");
  if (!deps.apply) {
    if (website && websiteWouldChange(r.website_url) && !locked.has("website_url")) changes.push("web");
    return changes;
  }
  if (Object.keys(update).length) {
    const facts: UciEventFact[] = Object.entries(update).map(([field, value]) => ({
      event_id: r.id,
      field,
      value,
      previous: (r as unknown as Record<string, unknown>)[field] ?? null,
      source_url: event.sourceUrl,
      quote: event.evidence!.quote.slice(0, 1500),
      method: "uci_directory",
      version: "uci-directory-v2",
    }));
    const nextRevision = await deps.updateEvent(r.id, r.public_revision, update, facts);
    r.public_revision = nextRevision;
    Object.assign(r, update);
  }
  if (!hasSource) {
    await deps.insertSource(r.id, event.sourceUrl, event.externalId!);
    r.sources.push({ source_url: event.sourceUrl, external_id: event.externalId ?? null });
  }
  // Only a different site: "https://x.cz" and "https://x.cz/" are one, and rewriting it every run bumps the race's revision.
  const sameSite = (x: string | null, y: string | null) => Boolean(x && y) && canonicalSite(x!) === canonicalSite(y!);
  if (website && !sameSite(r.website_url, website) && (await deps.saveWebsite(r, website))) {
    changes.push("web");
    r.website_url = website;
    const afterWebsite = await deps.readRevision(r.id);
    if (afterWebsite) r.public_revision = afterWebsite;
  }
  if (needsCategories || needsOrganizer) {
    const fresh = await deps.readRevision(r.id);
    const checkedAt = new Date().toISOString(), editionYear = Number(event.startDate.slice(0, 4));
    const quote = `UCI Competition Directory: ${competition.name} · ${labels.join(" · ")}${email ? ` · ${email}` : ""}`.slice(0, 1500);
    const details: PracticalDetails = {};
    if (needsCategories) details.categories = { sourceUrl: event.sourceUrl, quote, checkedAt, editionYear, status: "current", value: labels.map((label) => ({ label, sourceUrl: event.sourceUrl, checkedAt })) };
    if (needsOrganizer && host) details.organizer = { sourceUrl: event.sourceUrl, quote, checkedAt, editionYear, status: "current", value: { name: host, url: website!, email: email! } };
    if (fresh && Object.keys(details).length) {
      const saved = await deps.savePracticalDetails(r.id, fresh, details);
      if (saved.status === "saved") {
        r.practical_details = { ...pd, ...details };
        const afterDetails = await deps.readRevision(r.id);
        if (afterDetails) r.public_revision = afterDetails;
      }
    }
  }
  return changes;
}

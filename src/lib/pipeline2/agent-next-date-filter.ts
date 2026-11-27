import { normalizeName } from "@/lib/domain";
import {
  canonicalizeForDedup,
  formatConflict,
  isGarbagePlace,
  nameSimilarity,
  raceFormats,
  roundNumber,
  seriesAliasTokens,
  sharesDisciplineFamily,
  urlsOverlap,
} from "@/lib/dedup";
import { canonicalEventDisciplines, disciplineFamily, inferDisciplines } from "@/lib/taxonomy";

export type NextDateCandidate = {
  id?: string;
  name: string;
  last_date?: string | null;
  date?: string | null;
  place?: string | null;
  municipality?: string | null;
  country?: string | null;
  disciplines?: string[] | null;
  series?: string | null;
  organizer?: string | null;
  website?: string | null;
  registration?: string | null;
  sources?: (string | null | undefined)[] | null;
  pages_we_read?: (string | null | undefined)[] | null;
  found_on?: (string | null | undefined)[] | null;
};

export type ExistingEditionRecord = {
  id: string;
  source: "catalogue" | "pending_proposal";
  name: string;
  start_date: string;
  end_date?: string | null;
  place?: string | null;
  municipality?: string | null;
  country?: string | null;
  disciplines?: string[] | null;
  series?: string | null;
  organizer?: string | null;
  website?: string | null;
  registration?: string | null;
  sources?: (string | null | undefined)[] | null;
};

export type TargetEditionMatch = {
  matched: boolean;
  via?: "catalogue" | "pending_proposal";
  matchedId?: string;
  reason?: string;
};

export type PipelineCandidateRow = {
  id: string;
  source_url: string;
  country?: string | null;
  season?: number | null;
  payload?: Record<string, unknown> | null;
};

/** Aggregator / federation / social hosts shared across unrelated races. */
const AGGREGATOR_HOSTS = new Set([
  "sportsoft.cz",
  "kalendar.sportsoft.cz",
  "enduro.sportsoft.cz",
  "maraton.cz",
  "radsport-events.de",
  "cyclingaustria.at",
  "czechcyclingfederation.com",
  "portal.czechcyclingfederation.com",
  "rad-net.de",
  "uci.org",
  "raceresult.com",
  "my.raceresult.com",
  "mtbs.cz",
  "hynekmusil.cz",
  "sumator.cz",
  "velokal.de",
  "eventivsport.com",
  "mso.swiss",
  "federciclismo.it",
  "cyklistikaszc.sk",
  "pzkol.pl",
  "swiss-cycling.ch",
  "wynikizawodow.eu",
  "race-hub.io",
  "facebook.com",
  "m.facebook.com",
  "instagram.com",
  "youtube.com",
  "strava.com",
]);

/** Generic legal suffixes stripped when comparing organiser names. */
const ORG_NOISE = /\b(z\.?\s*s\.?|s\.?\s*r\.?\s*o\.?|o\.?\s*s\.?|a\.?\s*s\.?|e\.?\s*v\.?|gmbh|asbl|asd|ssd|sp\.?\s*z\s*o\.?\s*o\.?|club|klub|team|cycling|cyklo|radsport|verein)\b/gi;

/** Generic race/title words that carry no round-specific identity. */
const DISTINCTIVE_NOISE =
  /\b(20\d{2}|zavod|race|open|memorial|memoria|uci|c1|c2|c3|hc|xco|xcc|xcm|xce|dh|enduro|gravel|road|mtb|cx|bmx|elite|junior|u23|masters|kids|deti|mladez|cup|pohar|serie|series|liga|tour|trophy|challenge|marathon|maraton|classic|classics|direct|skoda|auto|ozp|galaxy|generali|uniqa|kooperativa|slavia|tipsport|czech|cesky|slovensky|slovak|austria|austrian|german|deutsch|polski|poland|international|internationales|mtb|bike|cycling|rad|rennen|preteky|kolo|round|runda|prova)\b/gi;

const LADY_RE = /\b(ladies|women|donne|žen|zeny|femminile|female)\b/i;

/** Specific MTB & road formats that represent distinct races when both sides name one. */
const DISTINCT_MTB_FORMATS = new Set(["xco", "xcm", "xcc", "xce", "dh", "enduro", "mtbo", "four_cross"]);
const DISTINCT_ROAD_FORMATS = new Set(["tt", "criterium", "hill_climb"]);

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cleanTokens(s: string | null | undefined, minLen = 3): string[] {
  if (!s) return [];
  return fold(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= minLen);
}

function effectiveDisciplines(name: string, disciplines?: string[] | null): string[] {
  const fromArray = canonicalEventDisciplines(disciplines);
  if (fromArray.length) return fromArray;
  return inferDisciplines(name);
}

function specificFormatTokens(name: string, disciplines?: string[] | null): Set<string> {
  const out = new Set<string>();
  for (const fmt of raceFormats(name)) out.add(fmt);
  const discs = canonicalEventDisciplines(disciplines);
  for (const d of discs) {
    if (DISTINCT_MTB_FORMATS.has(d) || DISTINCT_ROAD_FORMATS.has(d)) {
      out.add(d);
    } else if (d === "gravel" || d === "cx" || d === "track" || d === "bmx") {
      out.add(d);
    }
  }
  return out;
}

/**
 * True when two race records describe incompatible disciplines or sub-formats
 * (e.g., XCO vs XCM in Trieb, road vs gravel, TT vs criterium).
 * Generic parent tags ("mtb" vs "xco", "road" vs "gran_fondo") remain compatible.
 */
export function disciplinesConflict(
  a: { name: string; disciplines?: string[] | null },
  b: { name: string; disciplines?: string[] | null },
): boolean {
  if (formatConflict(a.name, b.name)) return true;

  const da = effectiveDisciplines(a.name, a.disciplines);
  const db = effectiveDisciplines(b.name, b.disciplines);
  if (da.length && db.length && !sharesDisciplineFamily(da, db)) {
    return true;
  }

  const fa = specificFormatTokens(a.name, a.disciplines);
  const fb = specificFormatTokens(b.name, b.disciplines);
  if (fa.size && fb.size) {
    const overlap = [...fa].some((f) => fb.has(f));
    if (!overlap) return true;
  }

  return false;
}

/** True when both records have known disciplines that share a family and do not conflict. */
export function hasCompatibleKnownDisciplines(
  a: { name: string; disciplines?: string[] | null },
  b: { name: string; disciplines?: string[] | null },
): boolean {
  if (disciplinesConflict(a, b)) return false;
  const da = effectiveDisciplines(a.name, a.disciplines).filter((d) => disciplineFamily(d) !== "other");
  const db = effectiveDisciplines(b.name, b.disciplines).filter((d) => disciplineFamily(d) !== "other");
  return da.length > 0 && db.length > 0 && sharesDisciplineFamily(da, db);
}

export function countriesConflict(
  a: { country?: string | null },
  b: { country?: string | null },
): boolean {
  const ca = (a.country ?? "").trim().toUpperCase();
  const cb = (b.country ?? "").trim().toUpperCase();
  return ca.length === 2 && cb.length === 2 && ca !== cb;
}

export function genderConflict(aName: string, bName: string): boolean {
  return LADY_RE.test(aName) !== LADY_RE.test(bName);
}

export function roundConflict(aName: string, bName: string): boolean {
  const ra = roundNumber(aName);
  const rb = roundNumber(bName);
  return ra !== null && rb !== null && ra !== rb;
}

function normalizeSeriesLabel(s: string | null | undefined): string {
  if (!s) return "";
  return fold(s)
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\b(direct|skoda\s*auto|ozp|galaxy|generali|uniqa|kooperativa|slavia|tipsport)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function seriesRelation(
  a: { name: string; series?: string | null },
  b: { name: string; series?: string | null },
): "same" | "conflict" | "unknown" {
  const aliasA = seriesAliasTokens(`${a.name} ${a.series ?? ""}`);
  const aliasB = seriesAliasTokens(`${b.name} ${b.series ?? ""}`);
  if (aliasA.length && aliasB.length) {
    return aliasA.some((t) => aliasB.includes(t)) ? "same" : "conflict";
  }

  const sa = normalizeSeriesLabel(a.series);
  const sb = normalizeSeriesLabel(b.series);
  if (sa && sb) {
    if (sa === sb || sa.includes(sb) || sb.includes(sa)) return "same";
    const ta = new Set(sa.split(" ").filter((t) => t.length >= 4));
    const tb = sb.split(" ").filter((t) => t.length >= 4);
    if (ta.size && tb.some((t) => ta.has(t))) return "same";
    return "conflict";
  }

  // One side has explicit series; check if it appears in the other's title.
  const onlySeries = sa || sb;
  if (onlySeries && onlySeries.length >= 5) {
    const otherName = fold(sa ? b.name : a.name).replace(/[^a-z0-9\s]/g, " ");
    if (otherName.includes(onlySeries)) return "same";
  }

  return "unknown";
}

function normalizeOrganizer(s: string | null | undefined): string {
  if (!s) return "";
  return fold(s)
    .replace(ORG_NOISE, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sameOrganizer(
  a: { organizer?: string | null },
  b: { organizer?: string | null },
): boolean {
  const oa = normalizeOrganizer(a.organizer);
  const ob = normalizeOrganizer(b.organizer);
  if (!oa || !ob || oa.length < 3 || ob.length < 3) return false;
  if (oa === ob || oa.includes(ob) || ob.includes(oa)) return true;
  const ta = new Set(oa.split(" ").filter((t) => t.length >= 4));
  const tb = ob.split(" ").filter((t) => t.length >= 4);
  if (!ta.size || !tb.length) return false;
  const shared = tb.filter((t) => ta.has(t)).length;
  return shared >= Math.min(ta.size, tb.length);
}

function collectPlaceText(r: { place?: string | null; municipality?: string | null }): string {
  return [r.municipality, r.place].filter((v): v is string => Boolean(v?.trim())).join(" ");
}

export function placesMatch(
  a: { place?: string | null; municipality?: string | null },
  b: { place?: string | null; municipality?: string | null },
): boolean {
  const pa = fold(collectPlaceText(a)).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const pb = fold(collectPlaceText(b)).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!pa || !pb || isGarbagePlace(pa) || isGarbagePlace(pb)) return false;
  if (pa === pb) return true;
  const ta = pa.split(" ").filter((w) => w.length >= 4);
  const tb = pb.split(" ").filter((w) => w.length >= 4);
  return ta.some((w) => pb.includes(w)) || tb.some((w) => pa.includes(w));
}

function hasUsablePlace(r: { place?: string | null; municipality?: string | null }): boolean {
  const p = collectPlaceText(r);
  return Boolean(p && !isGarbagePlace(p));
}

export function collectUrls(r: {
  website?: string | null;
  registration?: string | null;
  sources?: (string | null | undefined)[] | null;
  pages_we_read?: (string | null | undefined)[] | null;
  found_on?: (string | null | undefined)[] | null;
}): string[] {
  return [
    r.website,
    r.registration,
    ...(r.sources ?? []),
    ...(r.pages_we_read ?? []),
    ...(r.found_on ?? []),
  ].filter((u): u is string => Boolean(u && typeof u === "string" && u.trim()));
}

function nonGenericHost(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (!/^https?:$/.test(u.protocol)) return "";
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host || AGGREGATOR_HOSTS.has(host)) return "";
    return host;
  } catch {
    return "";
  }
}

export function sharedNonGenericHost(urlsA: string[], urlsB: string[]): boolean {
  const hostsA = new Set(urlsA.map(nonGenericHost).filter(Boolean));
  if (!hostsA.size) return false;
  return urlsB.some((u) => {
    const h = nonGenericHost(u);
    return Boolean(h && hostsA.has(h));
  });
}

function distinctiveTokens(name: string, series?: string | null): string[] {
  let s = fold(name);
  const normSeries = normalizeSeriesLabel(series);
  if (normSeries) {
    for (const tok of normSeries.split(" ").filter((t) => t.length >= 3)) {
      s = s.replace(new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), " ");
    }
  }
  s = s
    .replace(DISTINCTIVE_NOISE, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...new Set(s.split(" ").filter((t) => t.length >= 4 && !/^\d+$/.test(t)))];
}

export function sharesDistinctiveToken(
  a: { name: string; series?: string | null; place?: string | null; municipality?: string | null },
  b: { name: string; series?: string | null; place?: string | null; municipality?: string | null },
): boolean {
  const ta = distinctiveTokens(a.name, a.series);
  const tb = distinctiveTokens(b.name, b.series);
  if (ta.some((t) => tb.some((u) => t === u || (t.length >= 5 && u.length >= 5 && (t.includes(u) || u.includes(t)))))) {
    return true;
  }
  // Place of one appears as a distinctive token in the other's title (e.g. "Pálava" in title vs place).
  const pa = cleanTokens(collectPlaceText(a), 4);
  const pb = cleanTokens(collectPlaceText(b), 4);
  if (pa.some((p) => tb.some((u) => u === p || u.includes(p)))) return true;
  if (pb.some((p) => ta.some((u) => u === p || u.includes(p)))) return true;
  return false;
}

/**
 * Converts a `public.pipeline_candidates` row into an `ExistingEditionRecord` for matching.
 * Supports both flat `ParsedEvent` payloads and payloads with a nested `event` object.
 */
export function candidateRowToExistingEdition(row: PipelineCandidateRow): ExistingEditionRecord | null {
  const raw = row.payload ?? {};
  const payload = (raw.event && typeof raw.event === "object" && !Array.isArray(raw.event)
    ? raw.event
    : raw) as Record<string, unknown>;
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const startDate =
    typeof payload.startDate === "string"
      ? payload.startDate
      : typeof payload.start_date === "string"
        ? payload.start_date
        : "";
  if (!name || !startDate) return null;

  const endDate =
    typeof payload.endDate === "string"
      ? payload.endDate
      : typeof payload.end_date === "string"
        ? payload.end_date
        : null;
  const place =
    typeof payload.placeText === "string"
      ? payload.placeText
      : typeof payload.place === "string"
        ? payload.place
        : null;
  const municipality = typeof payload.municipality === "string" ? payload.municipality : null;
  const country =
    (typeof payload.countryHint === "string" ? payload.countryHint : null) ??
    (typeof payload.country === "string" ? payload.country : null) ??
    row.country ??
    null;
  const rawDisc = Array.isArray(payload.discipline)
    ? payload.discipline
    : Array.isArray(payload.disciplines)
      ? payload.disciplines
      : null;
  const disciplines = rawDisc ? rawDisc.filter((d): d is string => typeof d === "string") : null;
  const series =
    typeof payload.seriesName === "string"
      ? payload.seriesName
      : typeof payload.series === "string"
        ? payload.series
        : null;
  const organizer = typeof payload.organizer === "string" ? payload.organizer : null;
  const website =
    typeof payload.websiteUrl === "string"
      ? payload.websiteUrl
      : typeof payload.website_url === "string"
        ? payload.website_url
        : null;
  const registration =
    typeof payload.registrationUrl === "string"
      ? payload.registrationUrl
      : typeof payload.registration_url === "string"
        ? payload.registration_url
        : null;
  const sourceUrl =
    typeof payload.sourceUrl === "string"
      ? payload.sourceUrl
      : typeof payload.source_url === "string"
        ? payload.source_url
        : null;

  return {
    id: row.id,
    source: "pending_proposal",
    name,
    start_date: startDate,
    end_date: endDate,
    place,
    municipality,
    country,
    disciplines,
    series,
    organizer,
    website,
    registration,
    sources: [row.source_url, sourceUrl].filter((u): u is string => Boolean(u)),
  };
}

function matchAgainstEdition(race: NextDateCandidate, item: ExistingEditionRecord): string | null {
  if (countriesConflict(race, item)) return null;
  if (disciplinesConflict(race, item)) return null;
  if (roundConflict(race.name, item.name)) return null;
  if (genderConflict(race.name, item.name)) return null;

  const seriesRel = seriesRelation(race, item);
  if (seriesRel === "conflict") return null;

  const urlsA = collectUrls(race);
  const urlsB = collectUrls(item);
  const sameUrl = urlsOverlap(urlsA, urlsB);
  const sameSite = sharedNonGenericHost(urlsA, urlsB);
  const sameSeries = seriesRel === "same";
  const sameOrg = sameOrganizer(race, item);
  const samePlace = placesMatch(race, item);
  const sharedDistinctive = sharesDistinctiveToken(race, item);

  const na = normalizeName(race.name);
  const nb = normalizeName(item.name);
  const sameNormName = Boolean(na && nb && na === nb && na.length >= 4);
  const canonA = canonicalizeForDedup(race.name);
  const canonB = canonicalizeForDedup(item.name);
  const sameCanon = Boolean(canonA && canonB && canonA === canonB && canonA.length >= 4);
  const sim = nameSimilarity(race.name, item.name);

  const sharedContext = samePlace || sameSite || sameSeries || sameOrg;
  const bothHavePlaces = hasUsablePlace(race) && hasUsablePlace(item);

  // 1. Exact non-generic race URL overlap (guarding against different rounds of the same series).
  if (sameUrl && (!sameSeries || samePlace || sharedDistinctive || sim >= 0.65)) {
    return "same_url";
  }

  // 2. Identical normalized or canonical name (when places don't contradict without shared org/site).
  if ((sameNormName || sameCanon) && (sharedContext || !bothHavePlaces)) {
    return sameNormName ? "same_name" : "same_canonical_name";
  }

  // 3. High canonical name similarity with supporting place/series/organiser/website context.
  if (sim >= 0.85 && sharedContext) {
    return "name_sim_and_context";
  }

  // 4. Shared series, website host, or organiser + matching place or distinctive round token.
  //    (Handles "Road Classics Pálava" vs "Direct Road Classics 2027 – Pálava" while keeping
  //     Pálava, Vysočina, and Ještěd strictly separate from each other.)
  if ((sameSeries || sameSite || sameOrg) && (samePlace || sharedDistinctive)) {
    if (sameSeries) return "same_series_and_identity";
    if (sameSite) return "same_website_and_identity";
    return "same_organizer_and_identity";
  }

  // 5. Same place + moderate name similarity (and compatible discipline, already checked above).
  if (samePlace && (sim >= 0.6 || (sharedDistinctive && sim >= 0.4))) {
    return "same_place_and_name";
  }

  return null;
}

/**
 * Checks whether `race` already has an edition in `wantedYear` in either the published catalogue
 * or pending proposals/candidates. Catalogue matches take precedence over pending proposals.
 */
export function hasTargetEdition(
  race: NextDateCandidate,
  wantedYear: number,
  existing: ExistingEditionRecord[],
): TargetEditionMatch {
  const yearPrefix = `${wantedYear}-`;
  const inYear = existing.filter((item) => item.start_date?.startsWith(yearPrefix));
  const ordered = [
    ...inYear.filter((item) => item.source === "catalogue"),
    ...inYear.filter((item) => item.source === "pending_proposal"),
  ];

  for (const item of ordered) {
    const reason = matchAgainstEdition(race, item);
    if (reason) {
      return {
        matched: true,
        via: item.source,
        matchedId: item.id,
        reason,
      };
    }
  }

  return { matched: false };
}

/**
 * Filters out `find_next_date` cases whose race already has an edition in `wantedYear`
 * in the catalogue or pending proposals.
 */
export function filterExistingNextDateCases<T extends { race: NextDateCandidate }>(
  cases: T[],
  wantedYear: number,
  existing: ExistingEditionRecord[],
): T[] {
  return cases.filter((item) => !hasTargetEdition(item.race, wantedYear, existing).matched);
}

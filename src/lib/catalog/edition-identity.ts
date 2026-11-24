import { raceIdentityName } from "@/lib/race-identity-name";
import { differentInstalment } from "./merge-duplicates";

/**
 * A race's name without the parts that change every year: the year, the
 * edition ("32. ročník", "XXXIX", "#3", "N°1"), the words for "edition".
 * "32. ročník Českopetrovická koolna 2026" and "31. ročník Českopetrovická
 * koolna 2025" are the same race.
 */
export function editionKey(name: string): string {
  return raceIdentityName(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/(?:\b|(?<=[a-z]))(19|20)\d{2}\b(\s*[/-]\s*(19|20)?\d{2}\b)?/g, " ")
    .replace(/[-_]\d{2}\b/g, " ")
    .replace(/#\s*\d+|n[°º]\s*\d+|\b\d+\s*\.\s*(rocnik|edycja|ausgabe|edizione|edition|kolo|zavod|round)?/g, " ")
    .replace(/\b(rocnik|rocniku|edycja|edycji|ausgabe|edizione|edition|jahrgang)\b/g, " ")
    .replace(/\b[ivxlc]{2,}\b/g, " ")
    .replace(/\b\d+(?:st|nd|rd|th|e|er|eme)\b/g, " ")
    .replace(/\b\d+[°ºª](?=\s|$)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DISCIPLINE_FAMILY: Record<string, string> = {
  road: "road",
  road_race: "road",
  gran_fondo: "road",
  criterium: "road",
  tt: "road",
  hill_climb: "road",
  stage_race: "road",
  mtb: "mtb",
  xco: "mtb",
  xcm: "mtb",
  xce: "mtb",
  xcc: "mtb",
  enduro: "mtb",
  dh: "mtb",
  mtbo: "mtb",
};

function compatibleDisciplines(a: readonly string[] | null, b: readonly string[] | null): boolean {
  if (!a?.length || !b?.length) return true;
  const families = new Set(a.map(d => DISCIPLINE_FAMILY[d] ?? d));
  return b.some(d => a.includes(d) || families.has(DISCIPLINE_FAMILY[d] ?? d));
}

const GENERIC_RACE_WORDS = new Set([
  "mtb", "road", "gravel", "xco", "xcm", "xcc", "xce", "cx", "enduro", "dh", "tt", "bmx", "mtbo",
  "uci", "c1", "c2", "c3", "hc", "cup", "race", "tour", "maraton", "marathon", "bike", "cycling",
  "zavod", "cyklozavod", "pohar", "cena", "velka", "gp", "grand", "prix", "trophy", "challenge",
  "classic", "classics", "open", "cross", "radmarathon", "radrennen", "rennen", "puchar", "wyscig",
  "gran", "fondo", "trofeo", "coppa", "giro", "int", "internationale", "internationaler",
  "internationales", "international", "mistrovstvi", "championship", "championships", "series",
  "liga", "memorial", "kriterium", "criterium", "casovka", "hobby", "elite", "junior", "kids",
  "mladez", "nachwuchs", "youngsters", "cz", "sk", "de", "at", "pl", "ch", "it",
  "a", "i", "v", "na", "u", "o", "od", "do", "pro", "the", "of", "and", "by",
  "de", "di", "del", "della", "degli", "delle", "der", "die", "das", "und", "im", "am", "an",
  "in", "zu", "bei", "von", "mit", "fur", "nad", "pod", "pri",
]);

function distinctiveTokens(key: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of key.split(" ")) {
    if (!raw) continue;
    const token = raw.replace(/^(\d+)ka$/, "$1");
    if (token.length < 2 || GENERIC_RACE_WORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

/**
 * Whether two race names refer to the same recurring race despite sponsor
 * prefixes/suffixes, discipline tags ("MTB", "UCI XCO C1"), or minor wording shifts.
 * Always used only after place, country, discipline family and annual date window match.
 */
function similarEditionName(keyA: string, keyB: string, municipalityKey = ""): boolean {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return keyA.length >= 5;
  const shorter = keyA.length <= keyB.length ? keyA : keyB;
  const longer = keyA.length <= keyB.length ? keyB : keyA;
  const tokensA = distinctiveTokens(keyA);
  const tokensB = distinctiveTokens(keyB);
  if (!tokensA.length || !tokensB.length) return false;
  const small = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const large = new Set(tokensA.length <= tokensB.length ? tokensB : tokensA);
  const shared = small.filter(t => large.has(t));
  if (!shared.length) return false;
  // A single shared token that is just the town/municipality name (e.g. "Praha" or "Achensee")
  // is not enough on its own to prove two differently named races are the same edition.
  const placeTokens = new Set(distinctiveTokens(municipalityKey));
  const nonPlaceShared = shared.filter(t => !placeTokens.has(t));
  if (shared.length === 1 && nonPlaceShared.length === 0) return false;
  // Whole-word containment when the shorter name carries distinctive non-place identity.
  if (shorter.length >= 8 && ` ${longer} `.includes(` ${shorter} `)) return true;
  // All distinctive tokens of the shorter name appear in the longer name
  // (e.g. "Krakonošův cyklomaraton" vs "CASIA Krakonošův cyklomaraton").
  if (shared.length === small.length && (shared.length >= 2 || (shared[0]!.length >= 5 && nonPlaceShared.length >= 1))) return true;
  // Strong overlap of at least two distinctive tokens (e.g. "34. Internationale KTM Kamptal Trophy"
  // vs "35. KTM Kamptal Trophy - UCI XCO C1").
  return shared.length >= 2 && shared.length / small.length >= 0.67;
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

export type EditionIdentity = {
  id: string; name: string; start_date: string; series_id: string | null;
  disciplines: string[] | null;
  location: { lat: number | null; lng: number | null; country_code: string | null; municipality: string | null } | null;
};

/** Shared annual identity for inheritance and public edition links. Never merges editions. */
export function findPreviousEdition<T extends EditionIdentity>(event: EditionIdentity, candidates: T[], yearsBack = 1): T | null {
  const here = event.location;
  const key = editionKey(event.name);
  const eligible = candidates.filter(previous => {
    const days = (Date.parse(event.start_date) - Date.parse(previous.start_date)) / 86400_000;
    const there = previous.location;
    const annualOffset = 365 * (yearsBack - 1);
    if (previous.id === event.id || days < 300 + annualOffset || days > 430 + annualOffset) return false;
    if (!here?.country_code || here.country_code !== there?.country_code) return false;
    // Annual edition numbers may change; round and stage numbers may not.
    const withoutEdition = (name: string) => name.replace(/\b\d+\.?\s*(?:ročník|rocnik|edition|edycja|edizione|ausgabe)\b/gi, "");
    if (differentInstalment(withoutEdition(previous.name), withoutEdition(event.name))) return false;
    if (!compatibleDisciplines(previous.disciplines, event.disciplines)) return false;
    return here.lat != null && here.lng != null && there?.lat != null && there.lng != null
      ? km({lat:here.lat,lng:here.lng},{lat:there.lat,lng:there.lng}) <= 15
      : Boolean(here.municipality && there?.municipality && editionKey(here.municipality) === editionKey(there.municipality));
  });
  const byName = key.length >= 5 ? eligible.filter(p => editionKey(p.name) === key) : [];
  if (byName.length) return byName.length === 1 ? byName[0] : null;
  const bySeries = event.series_id && here?.lat != null ? eligible.filter(p => p.series_id === event.series_id && p.location?.lat != null) : [];
  if (bySeries.length) return bySeries.length === 1 ? bySeries[0] : null;
  const placeKey = editionKey(here?.municipality ?? "");
  const bySimilar = eligible.filter(p => similarEditionName(key, editionKey(p.name), placeKey));
  return bySimilar.length === 1 ? bySimilar[0] : null;
}

/** Reverse the same identity check; ambiguous future editions never become links. */
export function findNextEdition<T extends EditionIdentity>(event: EditionIdentity, candidates: T[], yearsAhead = 1): T | null {
  const pool: EditionIdentity[] = candidates.some(row => row.id === event.id) ? candidates : [...candidates, event];
  const offset = 365 * (yearsAhead - 1);
  const key = editionKey(event.name);
  const placeKey = editionKey(event.location?.municipality ?? "");
  const matches = candidates.filter(candidate => {
    const days = (Date.parse(candidate.start_date) - Date.parse(event.start_date)) / 86400_000;
    if (days < 300 + offset || days > 430 + offset) return false;
    // The reverse matcher can select this race by exact/similar name or by series.
    // Reject unrelated candidates before each of them scans the entire pool.
    const candidateKey = editionKey(candidate.name);
    if (!similarEditionName(key, candidateKey, placeKey) && !(candidate.series_id && candidate.series_id === event.series_id)) return false;
    return findPreviousEdition(candidate, pool, yearsAhead)?.id === event.id;
  });
  return matches.length === 1 ? matches[0] : null;
}

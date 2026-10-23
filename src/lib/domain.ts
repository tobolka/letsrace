import ngeohash from "ngeohash";
import {
  DISCIPLINES as TAXONOMY_DISCIPLINES,
  type Discipline,
  type AgeCategory,
} from "@/lib/taxonomy";

export type Audience = "kids" | "youth" | "adults" | "mixed";
export type { Discipline, AgeCategory };
export { TAXONOMY_DISCIPLINES as DISCIPLINES };

export type ParsedCategory = {
  name: string;
  distanceKm?: number;
  ageMin?: number;
  ageMax?: number;
  elevationM?: number;
  gender?: string;
  audience?: Audience;
};

export type ParsedEvent = {
  externalId: string;
  name: string;
  startDate: string;
  endDate?: string;
  placeText: string;
  countryHint?: string;
  discipline?: Discipline[];
  audience?: Audience;
  /**
   * Set only when the source names who may start — a calendar whose event type
   * is "Jedermann" or "RTF" is saying "anyone", in its own words, and that
   * beats anything the classifier can read out of a German race title.
   */
  ageCategories?: AgeCategory[];
  categories?: ParsedCategory[];
  /** Provenance / discovery URL (may be an aggregator page). */
  sourceUrl: string;
  /** Official race website for UI — never an aggregator calendar. */
  websiteUrl?: string;
  registrationUrl?: string;
  /** Official race info / propozice (HTML page or PDF). */
  regulationsUrl?: string;
  /** Official results hub (HTML page or timing provider). */
  resultsUrl?: string;
  /** ISO date the entry list opens / closes, when the source states it. */
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  /**
   * Set only when the source names the kind of event outright — a calendar that
   * distinguishes an RTF from a race knows better than a guess from the title.
   */
  eventType?: import("@/lib/taxonomy").EventType;
  /** Link event into a series (Talent Cup, KPŽ, …) — primary badge. */
  seriesName?: string;
  seriesSlug?: string;
  seriesWebsite?: string;
  /**
   * Extra series that also count this race (ČP Enduro inside Czech Enduro
   * Series, a partner round in two cups, …). Never steals the primary badge.
   */
  alsoSeries?: { name?: string; slug: string; website?: string }[];
  lat?: number;
  lng?: number;
  confidence: number;
  /** Only when a source explicitly states cancellation for this race. */
  status?: "cancelled";
  childUrls?: string[];
  /** Verified extraction evidence, retained in the source snapshot. */
  evidence?: { quote: string; sourceUrl: string; method: string; version: string; model?: string };
};

/** Words that vary between sources for the same race and carry no identity. */
const GENERIC_NAME_TOKENS = /\b(20\d{2}|pdv|jal|cp|xco|xcm|mtb|cup|serie|serié)\b/gi;

/**
 * Comparable form of a race name, and the name half of {@link fingerprint}.
 *
 * Dropping the generic tokens lets "XCO Cup Praha 2026" meet "Praha", but on a
 * name built only from them it left nothing: "ČP MTB" and "XCO Cup 2026" both
 * normalised to the empty string. That was harmless while duplicates were only
 * scored — with a unique index on `fingerprint` it means two unrelated races on
 * one day collide and the second silently adopts the first. Keep the stripped
 * form only when something identifying survives.
 */
export function normalizeName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const stripped = base.replace(GENERIC_NAME_TOKENS, " ").replace(/\s+/g, " ").trim();
  return stripped.length >= 3 ? stripped : base;
}

export function fingerprint(opts: {
  startDate: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
}): string {
  const hash =
    opts.lat != null && opts.lng != null
      ? ngeohash.encode(opts.lat, opts.lng, 5)
      : "nogps";
  return `${opts.startDate}:${hash}:${normalizeName(opts.name)}`;
}

/**
 * Fingerprints that should be treated as the same race when looking an event up.
 *
 * The plain {@link fingerprint} pins the event to one geohash-5 cell, so two
 * sources that geocode the same start line a few hundred metres apart (or land
 * on opposite sides of a cell border) never match. We therefore also accept the
 * eight neighbouring cells, plus the "nogps" variant emitted by sources that
 * ship no coordinates at all. Non-exact hits must still be confirmed by the
 * multi-signal scorer before they are treated as duplicates.
 */
export function fingerprintVariants(opts: {
  startDate: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
}): string[] {
  const norm = normalizeName(opts.name);
  const cells = new Set<string>(["nogps"]);
  if (opts.lat != null && opts.lng != null) {
    const base = ngeohash.encode(opts.lat, opts.lng, 5);
    cells.add(base);
    for (const n of ngeohash.neighbors(base)) cells.add(n);
  }
  return [...cells].map((cell) => `${opts.startDate}:${cell}:${norm}`);
}

/** Letters NFD does not take apart: ł, ß, ø… */
const LATIN_EXTRA: Record<string, string> = { ł: "l", Ł: "l", ß: "ss", ø: "o", Ø: "o", đ: "d", Đ: "d", æ: "ae", Æ: "ae", œ: "oe", Œ: "oe", ı: "i" };

/** Words for a URL: ASCII, lowercase, hyphenated, cut at a word under `max`. */
export function slugWords(text: string, max = 60): string {
  const words = text
    .replace(/[łŁßøØđĐæÆœŒı]/g, (c) => LATIN_EXTRA[c] ?? c)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  let out = "";
  for (const w of words) {
    const next = out ? `${out}-${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  return out || words[0]?.slice(0, max) || "race";
}

/**
 * A race's address, best first: its whole name and the year
 * (`ct-author-cup-2026`); with the place when the name repeats within a year
 * (`zh-cross-5-zlate-hory-2026`); with the date when even that repeats. Years
 * and seasons are taken out of the name so the address names one year, once.
 */
export function eventSlugCandidates(name: string, startDate: string, place?: string | null): string[] {
  const year = startDate.slice(0, 4);
  // Any year or season in the name ("2026", "2026/27") — the address states its own.
  const withoutYear = name.replace(/\b(?:19|20)\d{2}(?:\s*[/-]\s*(?:19|20)?\d{2})?\b/g, " ");
  const base = slugWords(withoutYear);
  const placeWords = place ? slugWords(place, 30) : "";
  const out = [`${base}-${year}`];
  if (placeWords && !base.includes(placeWords)) out.push(`${base}-${placeWords}-${year}`);
  out.push(`${base}-${startDate}`);
  return out;
}

/** The first choice for a new race; inserts fall back through `eventSlugCandidates`. */
export function slugifyEvent(name: string, startDate: string, place?: string | null): string {
  return eventSlugCandidates(name, startDate, place)[0]!;
}

export const AUDIENCES: Audience[] = ["kids", "youth", "adults", "mixed"];

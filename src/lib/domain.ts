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
  /** Link event into a series (Talent Cup, KPŽ, …) */
  seriesName?: string;
  seriesSlug?: string;
  seriesWebsite?: string;
  lat?: number;
  lng?: number;
  confidence: number;
  childUrls?: string[];
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

export function slugifyEvent(name: string, startDate: string): string {
  const base = normalizeName(name).replace(/\s+/g, "-").slice(0, 60);
  return `${base}-${startDate}`.replace(/-+/g, "-");
}

export const AUDIENCES: Audience[] = ["kids", "youth", "adults", "mixed"];

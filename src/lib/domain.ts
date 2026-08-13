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
  /** Link event into a series (Talent Cup, KPŽ, …) */
  seriesName?: string;
  seriesSlug?: string;
  seriesWebsite?: string;
  lat?: number;
  lng?: number;
  confidence: number;
  childUrls?: string[];
};

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(20\d{2}|pdv|jal|cp|xco|xcm|mtb|cup|serie|série)\b/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export function slugifyEvent(name: string, startDate: string): string {
  const base = normalizeName(name).replace(/\s+/g, "-").slice(0, 60);
  return `${base}-${startDate}`.replace(/-+/g, "-");
}

export const AUDIENCES: Audience[] = ["kids", "youth", "adults", "mixed"];

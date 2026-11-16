import type { Discipline, ParsedEvent } from "@/lib/domain";
import { judgeRide } from "@/lib/pipeline2/rides";
import { isRegistrationPlatformUrl } from "@/lib/watcher/registration-url";

/**
 * ENDURE Events (events.endure-cycling.com): a curated calendar of hobby road, gravel and
 * hill-climb events, strongest in Germany and Austria, which it says it checks against the
 * organiser's page every week. It publishes the whole stock as one file, `/events.json`, one
 * object per edition with the organiser's site, the entry link and the start's coordinates.
 *
 * Kept: cycling only (half the file is triathlon), and only dates the calendar marks as
 * confirmed. An entry it files as RTF is an organised ride and is listed as one; the rest go
 * through the same ride/race judgement as every other calendar, on the calendar's own text.
 * The description is the calendar's prose, not the organiser's, so it is used only for that
 * judgement and never shown.
 */
export const ENDURE_EVENTS_URL = "https://events.endure-cycling.com/events.json";

export function isEndureHost(host: string): boolean {
  return host.replace(/^www\./, "") === "events.endure-cycling.com";
}

type EndureEvent = {
  slug?: string;
  name?: string;
  sport?: string;
  categories?: string[];
  country?: string;
  dates?: { start?: string; end?: string; confirmed?: boolean };
  location?: { name?: string; lat?: number; lng?: number; region?: string };
  websiteUrl?: string;
  registrationUrl?: string;
  description?: string;
};

const CATEGORY_DISCIPLINE: Record<string, Discipline[]> = {
  "gran fondo": ["road", "gran_fondo"],
  radmarathon: ["road", "gran_fondo"],
  gravel: ["gravel"],
  berg: ["hill_climb"],
  zeitfahren: ["tt"],
  rundstreckenrennen: ["road"],
  etappenrennen: ["road"],
  rtf: ["road"],
};

/** A mountain-bike event the calendar files under its road headings ("Radmarathon", "Etappenrennen"). */
const MTB_NAME = /\bmtb\b|mountain ?bike|bike[- ]?marathon|ironbike|world games of mountainbiking|alpentour/i;

/** Names that say a ranked race outright. */
const RACE_NAME = /rennen|\brace\b|giro\b|challenge|jedermann|classic|\bcup\b|zeitfahren|velodom|gran ?fondo|gfny/i;

export function endureDisciplines(name: string, categories: string[]): Discipline[] {
  const cats = categories.map((c) => c.trim().toLowerCase());
  if (MTB_NAME.test(name)) return cats.includes("gravel") ? ["mtb", "xcm", "gravel"] : ["mtb", "xcm"];
  const out = new Set<Discipline>();
  for (const cat of cats) for (const d of CATEGORY_DISCIPLINE[cat] ?? []) out.add(d);
  // "Gravel" beside "Radmarathon" is a gravel route on a road event, not a road race on gravel.
  if (out.size === 0) out.add("road");
  return [...out];
}

export function parseEndureEvents(body: string): ParsedEvent[] {
  let rows: unknown;
  try {
    rows = JSON.parse(body);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  const events: ParsedEvent[] = [];
  for (const raw of rows as EndureEvent[]) {
    const slug = raw.slug?.trim();
    const name = raw.name?.replace(/\s+/g, " ").trim();
    const startDate = raw.dates?.start?.slice(0, 10);
    if (!slug || !name || raw.sport !== "cycling") continue;
    if (!startDate || !/^20\d{2}-\d{2}-\d{2}$/.test(startDate)) continue;
    // An unconfirmed date is the calendar's guess from last year.
    if (raw.dates?.confirmed !== true) continue;
    const endDate = raw.dates?.end?.slice(0, 10);
    const categories = raw.categories ?? [];
    const rtf = categories.some((c) => /^rtf$/i.test(c.trim()));
    const judged = judgeRide({ name, eventType: rtf ? "RTF" : null, text: raw.description });
    // In Germany a "Radmarathon" is, in the federation's own terms, a long touring ride without
    // a ranking. Filed under nothing else and named nothing race-like, it is held as a ride until
    // someone reads the organiser's page, rather than published as a race.
    const germanTouring = raw.country?.toUpperCase() === "DE" && judged.why === "no_ride_signal"
      && categories.length > 0 && categories.every((c) => /^radmarathon$/i.test(c.trim()))
      && !RACE_NAME.test(name) && !MTB_NAME.test(name);
    const website = cleanUrl(raw.websiteUrl);
    const registration = cleanUrl(raw.registrationUrl);
    const place = [raw.location?.name, raw.location?.region].filter(Boolean).join(", ");
    events.push({
      externalId: `endure-${slug}`,
      name,
      startDate,
      endDate: endDate && endDate > startDate ? endDate : undefined,
      placeText: place || raw.country || "",
      countryHint: raw.country?.toUpperCase() || undefined,
      discipline: endureDisciplines(name, categories),
      audience: "mixed",
      // Every entry here is an event anyone may enter by paying, not a licensed category.
      ageCategories: ["amateur"],
      sourceUrl: `https://events.endure-cycling.com/events/${slug}/`,
      websiteUrl: website,
      registrationUrl: registration ?? (website && isRegistrationPlatformUrl(website) ? website : undefined),
      eventType: judged.kind === "ride" || (judged.kind === "unsure" && rtf) || germanTouring ? "ride" : undefined,
      sourceWarnings: germanTouring ? ["listed only as Radmarathon in Germany: ranked race or touring ride is unstated"] : undefined,
      lat: typeof raw.location?.lat === "number" ? raw.location.lat : undefined,
      lng: typeof raw.location?.lng === "number" ? raw.location.lng : undefined,
      confidence: 0.85,
    });
  }
  return events;
}

function cleanUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

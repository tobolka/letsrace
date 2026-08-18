import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { geocodeFromGazetteer } from "@/lib/geocode";
import { inferDisciplines, isIngestibleDate } from "@/lib/taxonomy";

const SKIP_SPORT = /^(run|triatlon|triathlon|xc skiing|alpine skiing)$/i;
const CYCLING_SPORT = /^(road cycling|mtb|enduro)$/i;
const SK_PLACE =
  /\b(bratislava|nitra|por[áa][čc]|stupava|dem[äa]nov|gajary|donovaly|bojnice|sne[žz]nica|doma[šs]a|mochovce)\b/i;

function ssDate(raw: string): { start: string; end?: string } | null {
  const t = raw.replace(/\s+/g, " ").trim();
  const range = t.match(
    /^(\d{1,2})\.(\d{1,2})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(20\d{2})$/,
  );
  if (range) {
    const y = range[5]!;
    return {
      start: `${y}-${range[2]!.padStart(2, "0")}-${range[1]!.padStart(2, "0")}`,
      end: `${y}-${range[4]!.padStart(2, "0")}-${range[3]!.padStart(2, "0")}`,
    };
  }
  const one = t.match(/^(\d{1,2})\.(\d{1,2})\.(20\d{2})$/);
  if (!one) return null;
  return { start: `${one[3]}-${one[2]!.padStart(2, "0")}-${one[1]!.padStart(2, "0")}` };
}

function isCyclingRow(sport: string, name: string): boolean {
  if (SKIP_SPORT.test(sport)) return false;
  if (CYCLING_SPORT.test(sport)) return true;
  return /kritérium|kriterium|cyklist|mtb|enduro|\bcup\b|\btour\b|bike/i.test(name);
}

function countryFromPlace(place: string, name: string): string {
  if (SK_PLACE.test(place) || /slovakia|slovensko/i.test(name)) return "SK";
  if (/\bkraj\b/i.test(place)) return "CZ";
  return "CZ";
}

function disciplinesFor(name: string, sport: string): Discipline[] {
  const seed: Discipline[] = /enduro/i.test(sport)
    ? ["enduro"]
    : /road/i.test(sport)
      ? ["road"]
      : /mtb/i.test(sport)
        ? ["mtb"]
        : [];
  const inferred = inferDisciplines(`${name} ${sport}`, seed);
  return inferred.length ? inferred : seed.length ? seed : ["road"];
}

function seriesFromName(name: string): { seriesName: string; seriesSlug: string } | null {
  if (/\bmnd\s*cup\b/i.test(name)) {
    return { seriesName: "MND CUP", seriesSlug: "mnd-cup" };
  }
  return null;
}

function absHref(href: string | undefined, base: string): string | undefined {
  const raw = (href || "").trim();
  if (!raw || raw.startsWith("javascript:") || raw === "#") return undefined;
  try {
    return new URL(raw, base).toString();
  } catch {
    return undefined;
  }
}

function raceIdFromHref(href: string | undefined): string | null {
  const m = (href || "").match(/\/race\/(\d+)/i);
  return m?.[1] ?? null;
}

function pickRegistration(hrefs: string[]): string | undefined {
  return hrefs.find((h) =>
    /registration\.aspx|webregistration\.aspx|startreg\.aspx/i.test(h),
  );
}

/**
 * SportSoft public calendar — cycling rows only (ROAD / MTB / Enduro).
 * Timing hub like RaceResult: source is `/race/{id}`, enter link is registrace.sportsoft.cz.
 */
export function parseKalendarSportsoft(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $("#overview-table tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const $tds = $tr.find("td");
    if ($tds.length < 6) return;
    const $nameLink = $tds.eq(1).find("a[href*='/race/']").first();
    const name = ($nameLink.text() || $tds.eq(1).text()).replace(/\s+/g, " ").trim();
    const sport = $tds.eq(3).text().replace(/\s+/g, " ").trim();
    const dateRaw = $tds.eq(4).text().replace(/\s+/g, " ").trim();
    const place = $tds.eq(5).text().replace(/\s+/g, " ").trim();
    if (!name || !isCyclingRow(sport, name)) return;
    const dates = ssDate(dateRaw);
    if (!dates || !isIngestibleDate(dates.start)) return;
    const raceHref = absHref($nameLink.attr("href"), url);
    const id = raceIdFromHref(raceHref);
    if (!id) return;
    const externalId = `ss-kal-${id}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);
    const hrefs: string[] = [];
    $tr.find("a[href]").each((_, a) => {
      const abs = absHref($(a).attr("href"), url);
      if (abs) hrefs.push(abs);
    });
    const registrationUrl = pickRegistration(hrefs);
    const countryHint = countryFromPlace(place, name);
    const geo = geocodeFromGazetteer(place, countryHint);
    const series = seriesFromName(name);
    const uci = name.match(/\bUCI\s*(C[123]|HC)\b/i)?.[1] || name.match(/\b(C[123]|HC)\b/)?.[1];
    events.push({
      externalId,
      name,
      startDate: dates.start,
      endDate: dates.end && dates.end !== dates.start ? dates.end : undefined,
      placeText: place || name,
      countryHint: geo?.countryCode || countryHint,
      lat: geo?.lat,
      lng: geo?.lng,
      discipline: disciplinesFor(name, sport),
      audience: /detská\s*tour|detska\s*tour|fox\s*grom/i.test(name) ? "kids" : "mixed",
      categories: uci ? [{ name: `UCI ${uci.toUpperCase()}` }] : undefined,
      seriesName: series?.seriesName,
      seriesSlug: series?.seriesSlug,
      sourceUrl: raceHref!,
      registrationUrl,
      confidence: 0.84,
    });
  });
  return events;
}

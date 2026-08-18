import * as cheerio from "cheerio";
import type { Audience, Discipline, ParsedEvent } from "@/lib/domain";
import { geocodeFromGazetteer } from "@/lib/geocode";
import { inferDisciplines, isIngestibleDate } from "@/lib/taxonomy";

const SITE = "https://sport-base.eu";
const TRILOGY_WEB = "https://www.mtbtrilogy.com";

const SKIP =
  /over\s*all|\bbeh\b|\bběh\b|winter\s*run|canicross|triatlon|triathlon|p[uů]lmaraton|orienteer|\bkros\b|lyž|lyz|cani\b/i;
const CYCLING =
  /\bmtb\b|\benduro\b|cyklomaraton|cyklo[\s-]?maraton|\bkujebike\b|\bcyclo\b/i;

function sbDate(raw: string): string | null {
  const m = raw.replace(/\s+/g, " ").trim().match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

function isCycling(name: string): boolean {
  if (SKIP.test(name)) return false;
  return CYCLING.test(name);
}

function slugFromHref(href: string | undefined): string | null {
  const path = (href || "").split("?")[0] || "";
  const m = path.match(/\/competitions\/([^/]+)\/?$/i);
  if (!m) return null;
  const slug = m[1]!;
  if (/^(results|register|start-list)$/i.test(slug)) return null;
  return slug;
}

function abs(href: string | undefined): string | undefined {
  const raw = (href || "").trim();
  if (!raw || raw.startsWith("javascript:") || raw === "#") return undefined;
  try {
    return new URL(raw, SITE).toString();
  } catch {
    return undefined;
  }
}

function cleanPlace(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/teploice/gi, "Teplice")
    .replace(/\s*[-–]\s*Vinice$/i, "")
    .trim();
}

function discOf(name: string): Discipline[] {
  const t = name.toLowerCase();
  const seed: Discipline[] = /\benduro\b/.test(t)
    ? ["enduro"]
    : /cyklomaraton|maraton|xcm/.test(t)
      ? ["xcm"]
      : ["mtb"];
  const inferred = inferDisciplines(name, seed);
  return inferred.length ? inferred : seed;
}

function audienceOf(name: string): Audience {
  return /d[eě]tsk|kids/i.test(name) ? "kids" : "mixed";
}

function seriesOf(name: string): { seriesName: string; seriesSlug: string; seriesWebsite: string } {
  if (/mtb\s*trilogy/i.test(name)) {
    return {
      seriesName: "Kupkolo.cz MTB Trilogy",
      seriesSlug: /\benduro\b/i.test(name) ? "mtb-trilogy-enduro" : "mtb-trilogy",
      seriesWebsite: TRILOGY_WEB,
    };
  }
  if (/decathlon\s*cyklomaraton/i.test(name)) {
    return {
      seriesName: /d[eě]tsk/i.test(name)
        ? "Decathlon Cyklomaraton — děti"
        : "Decathlon Cyklomaraton",
      seriesSlug: /d[eě]tsk/i.test(name) ? "decathlon-cyklomaraton-kids" : "decathlon-cyklomaraton",
      seriesWebsite: SITE,
    };
  }
  if (/kujebike/i.test(name)) {
    return {
      seriesName: "KUJEBIKE",
      seriesSlug: "kujebike",
      seriesWebsite: SITE,
    };
  }
  return {
    seriesName: name.slice(0, 80),
    seriesSlug: "sport-base",
    seriesWebsite: SITE,
  };
}

/**
 * sport:base listing — cycling rows only. The rest is running / winter run.
 * Skip OVER ALL series standings; keep kids loops off the adult pin.
 */
export function parseSportBase(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const $tds = $tr.find("td");
    if ($tds.length < 4) return;
    const name = ($tr.find("[title]").first().attr("title") || $tds.eq(2).text())
      .replace(/\s+/g, " ")
      .trim();
    if (!name || !isCycling(name)) return;
    const startDate = sbDate($tds.eq(1).text());
    if (!startDate || !isIngestibleDate(startDate)) return;
    const place = cleanPlace($tds.eq(3).text());
    if (!place) return;

    const hrefs = $tr
      .find("a[href*='/competitions/']")
      .map((__, a) => $(a).attr("href") || "")
      .get();
    const slug =
      hrefs.map((h) => slugFromHref(h)).find(Boolean) ||
      hrefs
        .map((h) => (h.match(/\/competitions\/([^/]+)/i) || [])[1])
        .find((s) => s && !/results|register|start-list/i.test(s));
    if (!slug) return;
    const externalId = `sportbase-${slug}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const sourceUrl = `${SITE}/competitions/${slug}`;
    const registrationUrl = abs(hrefs.find((h) => /\/register\/?$/i.test(h)));
    const resultsUrl = abs(hrefs.find((h) => /\/results\/?$/i.test(h)));
    const series = seriesOf(name);
    const countryHint = "CZ";
    const geo = geocodeFromGazetteer(place, countryHint);

    events.push({
      externalId,
      name: name.slice(0, 160),
      startDate,
      placeText: place.slice(0, 80),
      countryHint,
      discipline: discOf(name),
      audience: audienceOf(name),
      seriesName: series.seriesName,
      seriesSlug: series.seriesSlug,
      seriesWebsite: series.seriesWebsite,
      sourceUrl,
      websiteUrl: /mtb\s*trilogy/i.test(name) ? TRILOGY_WEB : sourceUrl,
      registrationUrl,
      resultsUrl,
      lat: geo?.lat,
      lng: geo?.lng,
      confidence: 0.86,
    });
  });

  return events;
}

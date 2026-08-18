import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { inferDisciplines } from "@/lib/taxonomy";

const PORTAL_ORIGIN = "https://portal.czechcyclingfederation.com";

const INDOOR_DISC =
  /sálov|salov|krasoj|kolov|cycle[\s-]?ball|indoor|artistic/i;

const DISC_MAP: Record<string, Discipline | "skip"> = {
  cyklokros: "cx",
  cyclocross: "cx",
  "horska kola": "mtb",
  horske: "mtb",
  mtb: "mtb",
  silnice: "road",
  silnicni: "road",
  road: "road",
  gravel: "gravel",
  draha: "track",
  track: "track",
  bikros: "bmx",
  bmx: "bmx",
  handicap: "para",
  trial: "other",
};

export function isCscPortalHost(host: string): boolean {
  return host.replace(/^www\./, "").includes("portal.czechcyclingfederation.com");
}

export function hasCscPublicGrid(html: string): boolean {
  return /table-row-selectable/i.test(html) && /\/RaceDetail\/Race\/\d+/i.test(html);
}

/**
 * ČSC public calendar at portal.czechcyclingfederation.com/Races/Race/Pub.
 * The page is Blazor Server (empty HTML shell) — when the grid is missing we
 * render it, then parse the Blazorise table.
 */
export async function parseCscCalendar(url: string, html: string): Promise<ParsedEvent[]> {
  let pageHtml = html;
  if (!hasCscPublicGrid(pageHtml)) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (isCscPortalHost(host)) {
        const { renderCscPublicCalendar } = await import(
          "@/lib/watcher/extractors/csc-render"
        );
        pageHtml = await renderCscPublicCalendar(url);
      }
    } catch {
      /* keep original html */
    }
  }
  return parseCscPublicGrid(url, pageHtml);
}

export function parseCscPublicGrid(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const origin = originOf(url);

  $("tr.table-row-selectable").each((_, el) => {
    const name = cell($, el, "Race");
    const startDate = parseCscDate(cell($, el, "Start Date"));
    if (!name || name.length < 3 || !startDate) return;

    const disciplineLabel = cell($, el, "Discipline");
    if (INDOOR_DISC.test(disciplineLabel) || INDOOR_DISC.test(name)) return;

    const href = $(el).find('a[href*="/RaceDetail/Race/"]').first().attr("href");
    const raceId = href?.match(/\/RaceDetail\/Race\/(\d+)/i)?.[1];
    const endDate = parseCscDate(cell($, el, "End Date"));
    const place = cell($, el, "RaceDto") || cell($, el, "Location");
    const klass = cell($, el, "RaceDto.RaceClassId");
    const sourceUrl = href
      ? href.startsWith("http")
        ? href
        : new URL(href, origin).toString()
      : url;

    const mapped = mapCscDiscipline(disciplineLabel, name);
    if (!mapped) return;

    events.push({
      externalId: raceId ? `csc-${raceId}` : `csc-${normalizeName(name)}-${startDate}`,
      name: name.slice(0, 160),
      startDate,
      endDate: endDate && endDate !== startDate ? endDate : undefined,
      placeText: place || "Czechia",
      countryHint: "CZ",
      discipline: mapped,
      audience: /žák|junior|kadet|děti|mládež|u1[123]|mlž|stž/i.test(`${name} ${klass}`)
        ? "kids"
        : "mixed",
      sourceUrl,
      confidence: 0.9,
      ...cscSeriesFromName(name),
    });
  });

  return dedupe(events);
}

function cell($: cheerio.CheerioAPI, el: AnyNode, caption: string): string {
  return $(el)
    .find(`td[data-caption="${caption}"]`)
    .first()
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapCscDiscipline(label: string, name: string): Discipline[] | null {
  const key = fold(label);
  if (INDOOR_DISC.test(label)) return null;
  const mapped = key ? DISC_MAP[key] : undefined;
  if (mapped === "skip") return null;
  const inferred = inferDisciplines(
    `${name} ${label}`,
    mapped && mapped !== "other" ? [mapped] : mapped === "other" ? ["other"] : undefined,
  );
  return inferred.length ? inferred : null;
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** English UI is M/D/YYYY; Czech UI is D.M.YYYY. */
export function parseCscDate(raw: string): string | null {
  const t = raw.replace(/\u00a0/g, " ").trim();
  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (us) {
    return `${us[3]}-${us[1]!.padStart(2, "0")}-${us[2]!.padStart(2, "0")}`;
  }
  const cs = t.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (cs) {
    return `${cs[3]}-${cs[2]!.padStart(2, "0")}-${cs[1]!.padStart(2, "0")}`;
  }
  const loose = t.match(/^(\d{1,2})\s+(\d{1,2})\.\s*(20\d{2})/);
  if (loose) {
    return `${loose[3]}-${loose[2]!.padStart(2, "0")}-${loose[1]!.padStart(2, "0")}`;
  }
  const iso = t.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return PORTAL_ORIGIN;
  }
}

function cscSeriesFromName(name: string): Partial<ParsedEvent> {
  const t = fold(name);
  if (/\bmnd\s*cup\b/.test(t)) {
    return {
      seriesName: "MND CUP",
      seriesSlug: "mnd-cup",
      seriesWebsite: "https://www.czechcyclingfederation.com/events/mnd-cup/",
    };
  }
  if (/\bskoda\s*cup\b/.test(t)) {
    return {
      seriesName: "ŠKODA CUP",
      seriesSlug: "skoda-cup",
      seriesWebsite: "https://www.czechcyclingfederation.com/en/events/skoda-cup/",
    };
  }
  return {};
}

/**
 * ČSC marketing cup pages (`/events/mnd-cup/`, `/en/events/skoda-cup/`)
 * publish the live 2026 road calendars as a date/place table.
 */
export function parseCscCupListing(
  url: string,
  html: string,
  kind: "mnd" | "skoda",
): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  $("table tr").each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr
      .find("td")
      .map((__, td) => $(td).text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 3) return;
    const startDate = parseCscDate(cells[0]!);
    if (!startDate) return;
    const place = cells[1]!.slice(0, 80);
    const title = cells[2]!.replace(/&#8211;/g, "–").replace(/\s+/g, " ").trim();
    if (!place || place.length < 2) return;
    const name =
      kind === "mnd" ? `MND CUP — ${title || place}` : `ŠKODA CUP — ${title || place}`;
    const id = `${kind}-${startDate}-${normalizeName(place)}`;
    if (seen.has(id)) return;
    seen.add(id);
    const pdf = $tr.find("a[href$='.pdf']").first().attr("href");
    let regulationsUrl: string | undefined;
    if (pdf) {
      try {
        regulationsUrl = new URL(pdf, url).toString();
      } catch {
        /* keep */
      }
    }
    events.push({
      externalId: `csc-cup-${id}`,
      name: name.slice(0, 160),
      startDate,
      placeText: place,
      countryHint: "CZ",
      discipline: /časovka|casovka|ezf/i.test(`${title} ${place}`) ? ["tt"] : ["road"],
      audience: kind === "mnd" ? "youth" : "mixed",
      seriesName: kind === "mnd" ? "MND CUP" : "ŠKODA CUP",
      seriesSlug: kind === "mnd" ? "mnd-cup" : "skoda-cup",
      seriesWebsite: url.split("?")[0]!,
      sourceUrl: url.split("?")[0]!,
      websiteUrl: url.split("?")[0]!,
      regulationsUrl,
      confidence: 0.9,
    });
  });
  return events;
}

function dedupe(events: ParsedEvent[]): ParsedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const k = e.externalId;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

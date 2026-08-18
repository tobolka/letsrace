import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

function parseChDate(raw: string): { start: string; end?: string } | null {
  const t = raw.replace(/\s+/g, " ").trim();
  const range = t.match(
    /(\d{1,2})\.(\d{1,2})\.(20\d{2})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(20\d{2})/,
  );
  if (range) {
    return {
      start: `${range[3]}-${range[2]!.padStart(2, "0")}-${range[1]!.padStart(2, "0")}`,
      end: `${range[6]}-${range[5]!.padStart(2, "0")}-${range[4]!.padStart(2, "0")}`,
    };
  }
  const one = t.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (!one) return null;
  return {
    start: `${one[3]}-${one[2]!.padStart(2, "0")}-${one[1]!.padStart(2, "0")}`,
  };
}

function mapDisc(raw: string): Discipline[] {
  const t = raw.toLowerCase();
  if (/\benduro\b/.test(t)) return ["enduro"];
  if (/\bdh\b|downhill/.test(t)) return ["dh"];
  if (/\bxcm|marathon/.test(t)) return ["xcm"];
  if (/\bxcc/.test(t)) return ["xcc"];
  if (/\bxco/.test(t)) return ["xco"];
  if (/\bgravel/.test(t)) return ["gravel"];
  return ["mtb"];
}

function swissSeriesFields(name: string): Partial<ParsedEvent> {
  const t = name.toLowerCase();
  if (/swiss bike cup|škoda swiss|skoda swiss/.test(t)) {
    return {
      seriesName: "Škoda Swiss Bike Cup",
      seriesSlug: "skoda-swiss-bike-cup",
      seriesWebsite: "https://www.swissbikecup.ch/",
      audience: /kids/i.test(t) ? "kids" : "mixed",
    };
  }
  if (/vittoria/.test(t)) {
    return {
      seriesName: "Vittoria-Fischer MTB-Cup",
      seriesSlug: "vittoria-fischer-mtb-cup",
      seriesWebsite: "https://www.swiss-cycling.ch/",
    };
  }
  if (/kids bike trophy/.test(t)) {
    return {
      seriesName: "Kids Bike Trophy",
      seriesSlug: "kids-bike-trophy",
      audience: "kids",
    };
  }
  return {};
}

/**
 * Swiss Cycling MTB calendar table
 * (`swiss-cycling.ch/de/veranstaltungen/kalender/?discipline=mtb`).
 */
export function parseSwissCycling(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("table tbody tr[id^='id-']").each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.find("td");
    if (cells.length < 4) return;
    const dates = parseChDate($(cells[0]).text());
    if (!dates) return;
    const name = $(cells[1]).text().replace(/\s+/g, " ").trim();
    if (!name || /achtung:/i.test(name) || /talentsichtung|training|d[eé]tection|selezione dei talenti/i.test(name)) return;
    const place = $(cells[2]).text().replace(/\s+/g, " ").trim() || "Switzerland";
    const discRaw = $(cells[3]).text() + " " + ($(cells[4]).text() || "");

    const href = $(cells[1]).find("a").attr("href");
    let websiteUrl = url;
    if (href) {
      try {
        websiteUrl = new URL(href, url).toString();
      } catch {
        /* keep */
      }
    }

    const id = $tr.attr("id")?.replace(/^id-/, "") || normalizeName(name);
    const externalId = `swiss-${id}-${dates.start}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const series = swissSeriesFields(name);
    const raceUrl = websiteUrl;
    events.push({
      externalId,
      name,
      startDate: dates.start,
      endDate: dates.end,
      placeText: place,
      countryHint: "CH",
      discipline: mapDisc(discRaw + " " + name),
      audience: series.audience ?? (/kids|u9|u11|u13|jugend/i.test(name + discRaw) ? "kids" : "mixed"),
      sourceUrl: raceUrl,
      websiteUrl: raceUrl,
      confidence: 0.86,
      ...series,
    });
  });

  return events;
}

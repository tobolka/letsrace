import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Audience, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

const NL_MON: Record<string, string> = {
  januari: "01",
  februari: "02",
  maart: "03",
  april: "04",
  mei: "05",
  juni: "06",
  juli: "07",
  augustus: "08",
  september: "09",
  oktober: "10",
  november: "11",
  december: "12",
};

function dmy(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cells($: cheerio.CheerioAPI, tr: AnyNode): string[] {
  return $(tr)
    .find("td")
    .toArray()
    .map((td) => $(td).text().replace(/\s+/g, " ").trim());
}

function namedNlDate(text: string, year: string): string | null {
  const m = text.match(
    /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)/i,
  );
  if (!m) return null;
  return dmy(m[1]!, NL_MON[m[2]!.toLowerCase()]!, year);
}

function yearOf(html: string, fallback = "2026"): string {
  return html.match(/KALENDER\s+(20\d{2})/i)?.[1] || fallback;
}

function parseRange(raw: string): { start: string; end?: string } | null {
  const span = raw.match(/(\d{1,2})-(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (span) {
    return {
      start: dmy(span[1]!, span[3]!, span[4]!),
      end: dmy(span[2]!, span[3]!, span[4]!),
    };
  }
  const one = raw.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (!one) return null;
  return { start: dmy(one[1]!, one[2]!, one[3]!) };
}

const CC_TAG: Record<string, string> = { NED: "NL", BEL: "BE", GER: "DE" };

export function parse3NationsCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  $("table tr").each((_, tr) => {
    const c = cells($, tr);
    if (c.length < 2) return;
    const range = parseRange(c[0]!);
    const placeRaw = c[1] || "";
    if (!range || !/\((NED|BEL|GER)\)/i.test(placeRaw)) return;
    const tag = placeRaw.match(/\((NED|BEL|GER)\)/i)?.[1]?.toUpperCase() || "BE";
    const place = placeRaw.replace(/\s*\((NED|BEL|GER)\)/i, "").trim();
    const placeText = /vam/i.test(place) ? "Wijster" : place;
    const id = `3nations-${range.start}-${normalizeName(placeText)}`;
    if (seen.has(id)) return;
    seen.add(id);
    events.push({
      externalId: id,
      name: `3 Nations Cup — ${placeText}`,
      startDate: range.start,
      endDate: range.end && range.end !== range.start ? range.end : undefined,
      placeText,
      countryHint: CC_TAG[tag] || "BE",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "3 Nations Cup",
      seriesSlug: "3-nations-cup",
      seriesWebsite: "https://www.belgiancycling.be/disciplines/mtb/competities-m/mtb-3-nations-cup/kalender/",
      sourceUrl,
      websiteUrl: sourceUrl,
      confidence: 0.9,
    });
  });
  return events;
}

function parseVlaanderenTable(
  url: string,
  html: string,
  kind: "xco" | "kids",
): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  const kids = kind === "kids";
  const seriesName = kids ? "Cycling Vlaanderen MTB Kids Series" : "Cycling Vlaanderen MTB XCO Series";
  const seriesSlug = kids ? "vlaanderen-mtb-kids" : "vlaanderen-mtb-xco";
  $("table tr").each((_, tr) => {
    const c = cells($, tr);
    if (c.length < 2) return;
    const startDate = namedNlDate(c[0]!, c[0]!.match(/(20\d{2})/)?.[1] || "2026");
    const place = c[1]!;
    if (!startDate || place.length < 3) return;
    const extra = c.slice(2).join(" ");
    if (!kids && /3\s*nations/i.test(extra)) return;
    const id = `${seriesSlug}-${startDate}-${normalizeName(place)}`;
    if (seen.has(id)) return;
    seen.add(id);
    events.push({
      externalId: id,
      name: `${kids ? "MTB Kids Series" : "MTB XCO Series"} — ${place}`,
      startDate,
      placeText: place,
      countryHint: "BE",
      discipline: ["xco"],
      audience: (kids ? "kids" : "mixed") as Audience,
      seriesName,
      seriesSlug,
      seriesWebsite: sourceUrl,
      sourceUrl,
      websiteUrl: sourceUrl,
      confidence: 0.9,
    });
  });
  return events;
}

export function parseVlaanderenXco(url: string, html: string): ParsedEvent[] {
  return parseVlaanderenTable(url, html, "xco");
}

export function parseVlaanderenKids(url: string, html: string): ParsedEvent[] {
  return parseVlaanderenTable(url, html, "kids");
}

export function parseOostNederland(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  const year = yearOf(html);
  $("table tr").each((_, tr) => {
    const c = cells($, tr);
    if (c.length < 2) return;
    if (/zomerstop|datum/i.test(c[0]!)) return;
    const startDate = namedNlDate(c[0]!, year);
    const place = c[1]!;
    if (!startDate || place.length < 3) return;
    const id = `oost-nl-${startDate}-${normalizeName(place)}`;
    if (seen.has(id)) return;
    seen.add(id);
    events.push({
      externalId: id,
      name: `MTB Cup Oost-Nederland — ${place}`,
      startDate,
      placeText: place,
      countryHint: "NL",
      discipline: ["xco"],
      audience: "mixed",
      seriesName: "MTB Cup Oost-Nederland",
      seriesSlug: "mtb-cup-oost-nederland",
      seriesWebsite: sourceUrl,
      sourceUrl,
      websiteUrl: sourceUrl,
      confidence: 0.88,
    });
  });
  return events;
}

export function parseStreetrace(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const year = text.match(/streetrace[-\s]*competitie\s+(20\d{2})/i)?.[1] || "2026";
  const rounds: { re: RegExp; place: string; mo: string }[] = [
    { re: /(\d{1,2})\s+juni in Ruinen/i, place: "Ruinen", mo: "06" },
    { re: /(\d{1,2})\s+juni en \d{1,2}\s+juni.{0,90}Nijeveen/i, place: "Nijeveen", mo: "06" },
    { re: /\d{1,2}\s+juni en (\d{1,2})\s+juni.{0,90}Ruinerwold/i, place: "Ruinerwold", mo: "06" },
    { re: /(\d{1,2})\s+augustus.{0,80}De Wijk/i, place: "De Wijk", mo: "08" },
    { re: /(\d{1,2})\s+augustus.{0,80}Sleen/i, place: "Sleen", mo: "08" },
  ];
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  for (const r of rounds) {
    const m = text.match(r.re);
    if (!m) continue;
    const startDate = dmy(m[1]!, r.mo, year);
    const id = `streetrace-${startDate}-${normalizeName(r.place)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    events.push({
      externalId: id,
      name: `MTB Streetrace — ${r.place}`,
      startDate,
      placeText: r.place,
      countryHint: "NL",
      discipline: ["mtb"],
      audience: "mixed",
      seriesName: "MTB Streetrace Competitie",
      seriesSlug: "mtb-streetrace",
      seriesWebsite: "https://mtbstreetracecompetitie.nl/",
      sourceUrl,
      websiteUrl: "https://mtbstreetracecompetitie.nl/",
      confidence: 0.86,
    });
  }
  return events;
}

export function parseNkMtb(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const m = text.match(
    /(\d{1,2}),\s*(\d{1,2})\s+en\s+(\d{1,2})\s+juli\s+(20\d{2}).{0,120}Honselersdijk/i,
  );
  if (!m) return [];
  const startDate = dmy(m[1]!, "07", m[4]!);
  const endDate = dmy(m[3]!, "07", m[4]!);
  return [
    {
      externalId: `nk-mtb-${startDate}`,
      name: "NK Mountainbike XCO/XCC",
      startDate,
      endDate,
      placeText: "Honselersdijk",
      countryHint: "NL",
      discipline: ["xco", "xcc"],
      audience: "mixed",
      seriesName: "NK Mountainbike",
      seriesSlug: "nk-mountainbike",
      seriesWebsite: "https://nkmtb2026.nl/",
      sourceUrl: url.split("?")[0]!,
      websiteUrl: "https://nkmtb2026.nl/",
      confidence: 0.9,
    },
  ];
}

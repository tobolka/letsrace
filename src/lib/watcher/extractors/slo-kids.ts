import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "");
}

function dmy(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cellText($: cheerio.CheerioAPI, el: AnyNode): string {
  return $(el)
    .text()
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/\s+/g, " ")
    .trim();
}

function firstRaceHref($: cheerio.CheerioAPI, tr: AnyNode, base: string): string {
  const hrefs = $(tr)
    .find("a[href]")
    .map((_, a) => $(a).attr("href") || "")
    .get();
  for (const href of hrefs) {
    if (!href || /\.pdf($|\?)/i.test(href)) continue;
    try {
      return new URL(href, base).toString().split("?")[0]!;
    } catch {
      /* skip */
    }
  }
  return base.split("?")[0]!;
}

function parseDmy(text: string): string | null {
  const m = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (!m) return null;
  return dmy(m[1]!, m[2]!, m[3]!);
}

function xcDiscipline(name: string): Discipline[] {
  const n = fold(name);
  if (/\bxce\b|eliminator/.test(n)) return ["xce"];
  if (/\bxcc\b/.test(n)) return ["xcc"];
  return ["xco"];
}

const DH_VENUES: { re: RegExp; place: string }[] = [
  { re: /poseka/, place: "Ravne na Koroškem" },
  { re: /pohorje/, place: "Maribor" },
  { re: /sor.?ca/, place: "Soriška planina" },
  { re: /kranjska\s*gora/, place: "Kranjska Gora" },
  { re: /sotejska/, place: "Dolenjske Toplice" },
];

export function parseSloXcup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  $("table tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .toArray()
      .map((td) => cellText($, td));
    if (cells.length < 3) return;
    const startDate = parseDmy(cells[0]!);
    const name = cells[1]!;
    const place = cells[2]!;
    const cup = cells[3] || "";
    if (!startDate || !name || name.length < 4) return;
    if (!/xce|xco|xcc|\bxc\b|eliminator/i.test(name)) return;
    const id = `sloxcup-${startDate}-${normalizeName(name)}`;
    if (seen.has(id)) return;
    seen.add(id);
    const mladi = /mladi|pokal mladih/i.test(`${name} ${cup}`);
    events.push({
      externalId: id,
      name,
      startDate,
      placeText: place || name,
      countryHint: /samobor/i.test(place) ? "HR" : "SI",
      discipline: xcDiscipline(name),
      audience: mladi ? "kids" : "mixed",
      seriesName: "SloXcup",
      seriesSlug: "sloxcup",
      seriesWebsite: "https://www.sloxcup.com/",
      sourceUrl,
      websiteUrl: firstRaceHref($, tr, url),
      confidence: 0.9,
    });
  });
  return events;
}

export function parseSloveniaDhCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  $("table tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .toArray()
      .map((td) => cellText($, td));
    if (cells.length < 2) return;
    const name = cells[0]!;
    const startDate = parseDmy(cells[1]!);
    if (!startDate || !/^DH\b/i.test(name)) return;
    const id = `slovenia-dh-${startDate}-${normalizeName(name)}`;
    if (seen.has(id)) return;
    seen.add(id);
    const folded = fold(name);
    const venue = DH_VENUES.find((v) => v.re.test(folded));
    events.push({
      externalId: id,
      name,
      startDate,
      placeText: venue?.place || name.replace(/^DH\s+/i, ""),
      countryHint: "SI",
      discipline: ["dh"],
      audience: "mixed",
      seriesName: "Slovenia Downhill Cup",
      seriesSlug: "slovenia-downhill-cup",
      seriesWebsite: "https://www.sloveniadownhillcup.si/",
      sourceUrl,
      websiteUrl: firstRaceHref($, tr, url),
      confidence: 0.9,
    });
  });
  return events;
}

import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

const DE_MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  marz: "03",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

function foldDe(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");
}

function parseGermanDate(raw: string): string | null {
  const m = raw
    .replace(/\s+/g, " ")
    .trim()
    .match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/);
  if (!m) return null;
  const key = m[2]!.toLowerCase();
  const mon = DE_MONTHS[key] || DE_MONTHS[foldDe(key)];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[1]!.padStart(2, "0")}`;
}

function mapVelokalDiscipline(badges: string[]): Discipline[] {
  const t = badges.join(" ").toLowerCase();
  if (/\bmtb\b|mountain/.test(t)) return ["xc"];
  if (/\bgravel\b/.test(t)) return ["gravel"];
  if (/\bcyclo|quer/.test(t)) return ["cx"];
  if (/\bzeitfahren\b|\btt\b/.test(t)) return ["tt"];
  if (/gran.?fondo|jedermann|strada|\broad\b|rennen/.test(t)) return ["road"];
  return ["road"];
}

function countryFromTag(raw: string): string {
  const m = raw.match(/\b([A-Z]{2})\b/);
  return m?.[1] || "DE";
}

/** velokal.de — server-rendered event cards. */
export function parseVelokal(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const origin = "https://velokal.de";

  $("article.card").each((_, el) => {
    const $card = $(el);
    const href =
      $card.find("a.card-overlay").attr("href") ||
      $card.find('a[href*="/event/"]').attr("href");
    if (!href) return;

    const id = href.match(/\/event\/(\d+)/)?.[1];
    const name =
      $card.find("a.card-overlay").attr("aria-label")?.trim() ||
      $card.find(".card-title").text().replace(/\s+/g, " ").trim();
    if (!name) return;

    const dateRaw = $card.find(".card-datum").text().replace(/\s+/g, " ").trim();
    const startDate = parseGermanDate(dateRaw);
    if (!startDate) return;

    const metaText = $card.find(".card-meta").text().replace(/\s+/g, " ").trim();
    // "Siena IT 139 km 2000 hm"
    const placeMatch = metaText.match(/^(.+?)\s+([A-Z]{2})\b/);
    const placeText = placeMatch?.[1]?.trim() || metaText.split(/\d+\s*km/)[0]?.trim() || "Germany";
    const country = placeMatch?.[2] || countryFromTag(metaText);
    const badges = $card
      .find(".badge")
      .map((__, b) => $(b).text().replace(/\s+/g, " ").trim())
      .get();
    const km = metaText.match(/(\d+(?:[.,]\d+)?)\s*km/i)?.[1];
    const abs = href.startsWith("http") ? href : `${origin}${href}`;

    events.push({
      externalId: `velokal-${id || normalizeName(name)}-${startDate}`,
      name,
      startDate,
      placeText: placeText.slice(0, 80),
      countryHint: country,
      discipline: mapVelokalDiscipline(badges),
      audience: /kids|jugend|nachwuchs|u1[0-9]/i.test(`${name} ${badges.join(" ")}`)
        ? "youth"
        : "mixed",
      categories: km
        ? [{ name: `${km.replace(",", ".")} km`, distanceKm: Number(km.replace(",", ".")) }]
        : undefined,
      sourceUrl: abs,
      confidence: 0.86,
    });
  });

  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.externalId)) return false;
    seen.add(e.externalId);
    return true;
  });
}

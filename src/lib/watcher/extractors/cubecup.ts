import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

function mapType(raw: string): Discipline[] {
  const t = raw.toLowerCase();
  if (/\bxcm\b|marathon/.test(t)) return ["xcm"];
  if (/\bxco\b|cross.?country/.test(t)) return ["xco"];
  return ["xco"];
}

function seasonYear(html: string, $: cheerio.CheerioAPI): number {
  const h1 = $("h1").first().text();
  const m = h1.match(/20\d{2}/) || html.match(/CUBE\s*Cup\s*(20\d{2})/i);
  if (m) return Number(m[1] ?? m[0]);
  return new Date().getFullYear();
}

/**
 * CUBE Cup / CUBE Kids Cup (Webflow) — homepage event table.
 * Rows: `.event-link` → date DD.MM, type (XCO/XCM), place name.
 */
export function parseCubeCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const year = seasonYear(html, $);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("a.event-link[href*='/rennen-detail/']").each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href");
    const place = $a.find(".event-name").text().replace(/\s+/g, " ").trim();
    const typeRaw = $a.find(".event-type").text().replace(/\s+/g, " ").trim();
    const dateRaw = $a.find(".event-date").text().replace(/\s+/g, "").trim();
    if (!href || !place || !dateRaw) return;
    if (/ehrung|siegerehrung|archiv/i.test(place) || /ehrung/i.test(typeRaw)) return;

    const dm = dateRaw.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (!dm) return;
    const startDate = `${year}-${dm[2]!.padStart(2, "0")}-${dm[1]!.padStart(2, "0")}`;

    let abs: string;
    try {
      abs = new URL(href, url).toString();
    } catch {
      return;
    }
    const slug = abs.replace(/\/$/, "").split("/").pop() || normalizeName(place);
    const externalId = `cube-cup-${slug}-${startDate}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const shortPlace = place.split(",")[0]!.replace(/\s*\(.*$/, "").trim();
    const name = `CUBE Cup — ${shortPlace}`;

    events.push({
      externalId,
      name,
      startDate,
      placeText: shortPlace,
      countryHint: "DE",
      discipline: mapType(typeRaw),
      audience: "kids",
      seriesName: "CUBE Cup",
      seriesSlug: "cube-cup",
      seriesWebsite: "https://cup.cube.eu/",
      sourceUrl: abs,
      websiteUrl: abs,
      registrationUrl: "https://cup.cube.eu/anmeldung",
      confidence: 0.9,
    });
  });

  return events;
}

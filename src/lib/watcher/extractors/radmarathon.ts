import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

const COVERED_COUNTRIES = new Set(["AT", "DE", "CH", "IT", "CZ", "SK", "PL", "SI", "HR", "HU", "FR", "ES"]);

function parseDeDateRange(raw: string): { start: string; end?: string } | null {
  const clean = raw.replace(/\s+/g, " ").trim();
  const range = clean.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (range) {
    return {
      start: `${range[3]}-${range[2]!.padStart(2, "0")}-${range[1]!.padStart(2, "0")}`,
      end: `${range[6]}-${range[5]!.padStart(2, "0")}-${range[4]!.padStart(2, "0")}`,
    };
  }
  const one = clean.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (!one) return null;
  return { start: `${one[3]}-${one[2]!.padStart(2, "0")}-${one[1]!.padStart(2, "0")}` };
}

function mapRadmarathonDiscipline(meta: string, name: string): Discipline[] | null {
  const code = meta.match(/-\s*([A-Z]{2})\s*$/)?.[1]?.toUpperCase();
  const isOffroad = /offroad/i.test(meta);
  const text = `${meta} ${name}`.toLowerCase();
  // Skip triathlon/duathlon/running ("TA") and non-race tours.
  if (code === "TA" || /triathlon|duathlon|wintertriathlon|lauf\b/i.test(name)) return null;
  if (code === "CC" || /cyclocross|radquer|\bcx\b/.test(text)) return ["cx"];
  if (code === "GR" || /gravel/.test(text)) return ["gravel"];
  if (code === "EN" || /enduro/.test(text)) return ["enduro"];
  if (code === "DH" || /downhill/.test(text)) return ["dh"];
  if (code === "KR" || /kriterium/.test(text)) return ["criterium"];
  if (code === "EZ" || code === "ZF" || code === "BZ" || /zeitfahren|bergzeitfahren/.test(text)) return ["tt"];
  if (code === "RR") return ["road_race"];
  if (code === "XC") return ["xco"];
  if (code === "MA") return isOffroad ? ["xcm"] : ["gran_fondo"];
  if (code === "SR") return isOffroad ? ["mtb"] : ["road"];
  if (code === "UC" || code === "BP") return isOffroad ? ["gravel"] : ["road"];
  if (code === "PT") return ["other"];
  return isOffroad ? ["mtb"] : ["road"];
}

export function isRadmarathonHost(host: string): boolean {
  return /(^|\.)radmarathon\.at$/i.test(host);
}

/**
 * radmarathon.at/termine/ — major Central European cycling calendar covering
 * AT, DE, CH, IT, CZ, SK, PL (marathons, MTB, gravel, CX, road, TT, enduro).
 */
export function parseRadmarathon(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("li.menu > a[href*='detail_event.php']").each((_, el) => {
    const a = $(el);
    const href = a.attr("href")?.trim();
    if (!href) return;
    const id = href.match(/[?&]id=(\d+)/)?.[1];
    const titleAttr = a.attr("title")?.trim() ?? "";
    const [attrName, attrPlace] = titleAttr.split("|").map((s) => s.trim());

    const dateSpans = a.find("span.newslistdate");
    const dateRaw = dateSpans.first().text();
    const metaRaw = dateSpans.length > 1 ? dateSpans.last().text() : "";
    const dates = parseDeDateRange(dateRaw);
    if (!dates) return;

    const flagSrc = a.find("img.terminlist").attr("src") ?? "";
    const countryCode = flagSrc.match(/\/([a-z]{2})\.gif$/i)?.[1]?.toUpperCase();
    if (countryCode && !COVERED_COUNTRIES.has(countryCode)) return;

    const name = attrName || a.find("span.blacktitle").contents().eq(1).text().trim();
    if (!name || name.length < 3) return;

    const discipline = mapRadmarathonDiscipline(metaRaw, name);
    if (!discipline) return;

    let absUrl: string;
    try {
      absUrl = new URL(href, url).toString();
    } catch {
      return;
    }

    const externalId = `radmarathon-${id || normalizeName(name)}-${dates.start}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const placeText = attrPlace || undefined;
    events.push({
      externalId,
      name,
      startDate: dates.start,
      endDate: dates.end && dates.end !== dates.start ? dates.end : undefined,
      placeText,
      countryHint: countryCode,
      discipline,
      audience: /kids|jugend|youngsters|junior|nachwuchs/i.test(name) ? "youth" : "mixed",
      sourceUrl: absUrl,
      confidence: 0.85,
      evidence: {
        sourceUrl: url,
        quote: `${dateRaw.trim()} ${name} ${placeText ?? ""} ${metaRaw.trim()}`.replace(/\s+/g, " ").trim().slice(0, 300),
        method: "radmarathon_at_list",
        version: "radmarathon-v1",
      },
    });
  });

  return events;
}

import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

const CYCLING_SPORT = /\b(?:cykl|mtb|kolo|kola|gravel|silni[cč]|bike|bajk|bmx|enduro|downhill|časovk|casovk|cyklokros|xco|xcm)\b/i;
const EXCLUDED_SPORT = /\b(?:b[eě]h|b[eě][zž]k|triatlon|duatlon|plav|canicros|orient|ch[uů]z|pochod|nordic|ly[zž]|skialp|skyrace)\b/i;

function parseCzDate(raw: string): { start: string; end?: string } | null {
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

function mapStopnitoDiscipline(text: string): Discipline[] {
  const t = text.toLowerCase();
  if (/cyklokros|cyclocross|\bcx\b/.test(t)) return ["cx"];
  if (/gravel/.test(t)) return ["gravel"];
  if (/enduro/.test(t)) return ["enduro"];
  if (/downhill|\bdh\b/.test(t)) return ["dh"];
  if (/časovk|casovk|\btt\b/.test(t)) return ["tt"];
  if (/marat[oó]n|\bxcm\b/.test(t) && /mtb|bike|bajk|kol/.test(t)) return ["xcm"];
  if (/silni[cč]|road|gran\s*fondo/.test(t)) return ["road"];
  return ["mtb"];
}

export function isStopnitoHost(host: string): boolean {
  return /(^|\.)stopnito\.cz$/i.test(host);
}

/**
 * stopnito.cz/zavody — Czech/Slovak timing portal. Strictly filters to cycling
 * events so running, cross-country skiing and triathlon races are never imported.
 */
export function parseStopnito(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length < 4) return;
    const link = $(cells[0]).find('a[href*="/detail-zavodu/"]').first();
    const href = link.attr("href")?.trim();
    const name = link.text().replace(/\s+/g, " ").trim();
    if (!href || !name || name.length < 3) return;

    const dateRaw = $(cells[1]).text().trim();
    const placeText = $(cells[2]).text().replace(/\s+/g, " ").trim();
    const sportText = $(cells[3]).text().replace(/\s+/g, " ").trim();
    const combined = `${name} ${sportText}`;

    if (EXCLUDED_SPORT.test(sportText) || !CYCLING_SPORT.test(combined)) return;

    const dates = parseCzDate(dateRaw);
    if (!dates) return;

    const id = href.match(/\/detail-zavodu\/(\d+)/)?.[1];
    let absUrl: string;
    try {
      absUrl = new URL(href, url).toString();
    } catch {
      return;
    }

    const externalId = `stopnito-${id || normalizeName(name)}-${dates.start}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    events.push({
      externalId,
      name,
      startDate: dates.start,
      endDate: dates.end && dates.end !== dates.start ? dates.end : undefined,
      placeText: placeText || undefined,
      countryHint: "CZ",
      discipline: mapStopnitoDiscipline(combined),
      audience: /d[eě]t|kids|junior|ml[aá]de[zž]/i.test(name) ? "youth" : "mixed",
      sourceUrl: absUrl,
      confidence: 0.86,
      evidence: {
        sourceUrl: url,
        quote: `${name} | ${dateRaw} | ${placeText} | ${sportText}`.slice(0, 300),
        method: "stopnito_table",
        version: "stopnito-v1",
      },
    });
  });

  return events;
}

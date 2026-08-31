import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { inferDisciplines } from "@/lib/taxonomy";
import { fetchText } from "@/lib/watcher/http";
import { isPolishYouthRace } from "@/lib/watcher/extractors/pl-shared";

const ORIGIN = "https://pzkol.pl";

/** Cycle-ball / artistic cycling live on the same calendar and are not road sport. */
const INDOOR = /kolarstw\w* halow|kolarstw\w* artystyczn|\bradball\b|\bhalowe\b/i;

export function isPzkolHost(host: string): boolean {
  return host.replace(/^www\./, "").endsWith("pzkol.pl");
}

/**
 * The public calendar page renders only a ten-item upcoming widget; the season
 * table lives behind the filter widget's own `?v=l&season=YYYY` request. Watch
 * the plain calendar URL and let this pull the current and next season, so the
 * source keeps working across the turn of the year.
 */
export async function parsePzkolSeasons(url: string, html: string): Promise<ParsedEvent[]> {
  if (/[?&]v=l\b/.test(url)) return parsePzkolCalendar(url, html);

  const year = new Date().getUTCFullYear();
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  for (const season of [year, year + 1]) {
    const seasonUrl = `${ORIGIN}/kalendarz?v=l&season=${season}`;
    const page = await fetchText(seasonUrl, { timeoutMs: 20_000 });
    if (!page.ok || !page.text) continue;
    for (const ev of parsePzkolCalendar(seasonUrl, page.text)) {
      if (seen.has(ev.externalId)) continue;
      seen.add(ev.externalId);
      events.push(ev);
    }
  }
  return events;
}

/**
 * PZKol publishes the whole season as one HTML table behind `?v=l&season=YYYY`
 * — the page's own filter widget posts to it. Columns are date, name, place,
 * rank, region. Discipline is not a column, so it comes from the name.
 */
export function parsePzkolCalendar(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("tr").each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < 5) return;

    const cell = (i: number) =>
      $(tds[i])
        .text()
        .replace(/ /g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const range = parsePzkolDateRange(cell(0));
    const name = cell(1);
    if (!range || !name || name.length < 3) return;
    if (INDOOR.test(name)) return;

    const href = $(tds[0]).find("a[href]").first().attr("href") ?? "";
    const raceId = href.match(/\/kalendarz\/(\d+),/)?.[1];
    const sourceUrl = href
      ? href.startsWith("http")
        ? href
        : new URL(href, ORIGIN).toString()
      : url;

    const externalId = raceId
      ? `pzkol-${raceId}`
      : `pzkol-${normalizeName(name)}-${range.startDate}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const place = cell(2);
    const discipline = inferDisciplines(name);

    events.push({
      externalId,
      name: name.slice(0, 160),
      startDate: range.startDate,
      endDate: range.endDate,
      placeText: place || "Poland",
      countryHint: countryFromRegion(cell(4)),
      discipline: discipline.length ? discipline : undefined,
      audience: isPolishYouthRace(name) ? "kids" : "mixed",
      sourceUrl,
      confidence: 0.9,
    });
  });

  return events;
}

/**
 * The date cell is one of `3.01.2026`, `21-22.02.2026` (same month) or
 * `30.04-3.05.2026` (across months). Every form carries a single year.
 */
export function parsePzkolDateRange(
  raw: string,
): { startDate: string; endDate?: string } | null {
  const t = raw.replace(/ /g, " ").replace(/\s+/g, "").trim();

  const crossMonth = t.match(/^(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(20\d{2})$/);
  if (crossMonth) {
    const [, d1, m1, d2, m2, y] = crossMonth;
    return range(iso(y!, m1!, d1!), iso(y!, m2!, d2!));
  }

  const sameMonth = t.match(/^(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(20\d{2})$/);
  if (sameMonth) {
    const [, d1, d2, m, y] = sameMonth;
    return range(iso(y!, m!, d1!), iso(y!, m!, d2!));
  }

  const single = t.match(/^(\d{1,2})\.(\d{1,2})\.(20\d{2})$/);
  if (single) {
    const [, d, m, y] = single;
    return range(iso(y!, m!, d!));
  }

  return null;
}

function range(startDate: string | null, endDate?: string | null) {
  if (!startDate) return null;
  return { startDate, endDate: endDate && endDate !== startDate ? endDate : undefined };
}

function iso(y: string, m: string, d: string): string | null {
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Column 5 is a three-letter country code; regional rounds all read POL. */
function countryFromRegion(code: string): string {
  const map: Record<string, string> = {
    POL: "PL",
    CZE: "CZ",
    SVK: "SK",
    GER: "DE",
    AUT: "AT",
    LTU: "LT",
    UKR: "UA",
    BLR: "BY",
  };
  return map[code.toUpperCase()] ?? "PL";
}

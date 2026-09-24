import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { fetchText } from "@/lib/watcher/http";
import { mapPool } from "@/lib/watcher/pool";

const IT_MONTHS: Record<string, string> = {
  gennaio: "01",
  febbraio: "02",
  marzo: "03",
  aprile: "04",
  maggio: "05",
  giugno: "06",
  luglio: "07",
  agosto: "08",
  settembre: "09",
  ottobre: "10",
  novembre: "11",
  dicembre: "12",
};

/** Safety cap per watch invocation (≈20 races/page). */
const MAX_PAGES_PER_RUN = 80;
/** How many calendar months to cover in one daily run. */
const MONTHS_PER_RUN = 3;
/** Look ahead far enough to cover the following calendar year. */
const HORIZON_MONTHS = 16;

function parseItalianDate(raw: string): string | null {
  const m = raw
    .replace(/\s+/g, " ")
    .trim()
    .match(/(\d{1,2})\s+([A-Za-zàèéìòù]+)\s+(\d{4})/i);
  if (!m) return null;
  const mon = IT_MONTHS[m[2]!.toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[1]!.padStart(2, "0")}`;
}

export function mapFciDiscipline(text: string): Discipline[] {
  const t = text.toLowerCase();
  if (/ciclocross|cyclo[- ]?cross/.test(t)) return ["cx"];
  if (/downhill|discesa|\bdh\b/.test(t)) return ["dh"];
  if (/enduro/.test(t)) return ["enduro"];
  if (/cross.?country|\bxco\b/.test(t)) return ["xco"];
  if (/fuoristrada|mtb|mountain/.test(t)) return ["mtb"];
  if (/pista|track/.test(t)) return ["track"];
  if (/gravel/.test(t)) return ["gravel"];
  if (/strada|road|gran.?premio|amatoriale/.test(t)) return ["road"];
  return ["road"];
}

function fmtIt(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function monthStartUtc(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function monthEndUtc(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

/**
 * Rotate which months we crawl so successive cron runs cover the full horizon
 * without downloading ~180 pages every time. Skips empty months in-run.
 */
export function fciWindowsForRun(now = new Date()): { start: Date; end: Date }[] {
  const base = monthStartUtc(now.getUTCFullYear(), now.getUTCMonth());
  // Daily cron must advance by a whole run. A 2-hour slot advanced by 12
  // between runs and repeatedly skipped the same future months.
  const day = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
  const startOffset = (day * MONTHS_PER_RUN) % HORIZON_MONTHS;
  const windows: { start: Date; end: Date }[] = [];
  for (let i = 0; i < HORIZON_MONTHS; i++) {
    const off = (startOffset + i) % HORIZON_MONTHS;
    const t = new Date(base);
    t.setUTCMonth(t.getUTCMonth() + off);
    windows.push({
      start: monthStartUtc(t.getUTCFullYear(), t.getUTCMonth()),
      end: monthEndUtc(t.getUTCFullYear(), t.getUTCMonth()),
    });
  }
  return windows;
}

function buildListUrl(start: Date, end: Date, page: number): string {
  const q = new URLSearchParams({
    sectorId: "0",
    StartDt: fmtIt(start),
    EndDt: fmtIt(end),
    page: String(page),
  });
  return `https://members.federciclismo.it/race?${q.toString()}`;
}

function detectMaxPage(html: string): number {
  const $ = cheerio.load(html);
  let max = 1;
  $("ul.pagination a[href*='page=']").each((_, a) => {
    const href = $(a).attr("href") || "";
    try {
      const abs = href.startsWith("http")
        ? href
        : `https://members.federciclismo.it${href.startsWith("/") ? "" : "/"}${href}`;
      const p = Number(new URL(abs).searchParams.get("page") || 0);
      if (p > max) max = p;
    } catch {
      /* ignore */
    }
  });
  return max;
}

function parseFciPage(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const origin = new URL(url).origin;

  $("ul.GareList > li").each((_, el) => {
    const $li = $(el);
    const a = $li.find('a[href*="/race/detail/"]').first();
    const href = a.attr("href");
    if (!href) return;

    const id = href.match(/\/race\/detail\/(\d+)/)?.[1];
    const dateRaw = a.find(".calData").text().replace(/\s+/g, " ").trim();
    const startDate = parseItalianDate(dateRaw);
    if (!startDate) return;

    const name =
      a.find("h3").text().replace(/\s+/g, " ").trim() ||
      a.text().replace(/\s+/g, " ").trim().slice(0, 120);
    if (!name || name.length < 3) return;

    const spans = a
      .find("span")
      .not(".calData")
      .map((__, s) => $(s).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);
    const placeText = spans[0] || "Italia";
    const tipo = spans[1] || a.find("h4").text();
    const abs = href.startsWith("http") ? href : `${origin}${href}`;

    events.push({
      externalId: `fci-${id || normalizeName(name)}-${startDate}`,
      name: name
        .replace(/^Pista\s*-\s*/i, "")
        .replace(/^Strada\s*-\s*/i, "")
        .replace(/^Fuoristrada\s*-\s*/i, "")
        .replace(/^Giovanile\s*-\s*/i, "")
        .replace(/^Amatoriale\s*-\s*/i, "")
        .trim(),
      startDate,
      placeText: placeText.slice(0, 100),
      countryHint: "IT",
      discipline: mapFciDiscipline(`${name} ${tipo}`),
      audience: /giovanile|junior|esordienti|allieve|allievi|ragazzi|giovanissimi/i.test(
        `${name} ${tipo}`,
      )
        ? "youth"
        : "mixed",
      sourceUrl: abs.replace(/\/$/, ""),
      confidence: 0.82,
    });
  });

  return events;
}

async function fetchPages(
  start: Date,
  end: Date,
  maxPages: number,
): Promise<ParsedEvent[]> {
  const page1Url = buildListUrl(start, end, 1);
  const first = await fetchText(page1Url, { timeoutMs: 20_000 });
  if (!first.ok || !first.text) return [];

  const byKey = new Map<string, ParsedEvent>();
  for (const ev of parseFciPage(page1Url, first.text)) {
    byKey.set(ev.externalId, ev);
  }

  const lastPage = Math.min(detectMaxPage(first.text), maxPages);
  if (lastPage <= 1) return [...byKey.values()];

  const pageNums = Array.from({ length: lastPage - 1 }, (_, i) => i + 2);
  const pages = await mapPool(pageNums, 4, async (page) => {
    const pageUrl = buildListUrl(start, end, page);
    // Slightly looser: skipGate false still rate-limits via fetchText
    const res = await fetchText(pageUrl, { timeoutMs: 20_000 });
    if (!res.ok || !res.text) return [] as ParsedEvent[];
    return parseFciPage(pageUrl, res.text);
  });

  for (const batch of pages) {
    for (const ev of batch) byKey.set(ev.externalId, ev);
  }
  return [...byKey.values()];
}

/**
 * Italian FCI race calendar.
 * Default site UI is only ~1 month; we query StartDt/EndDt and paginate fully
 * across rotating months so the following year fills in over successive daily crons.
 */
export async function parseFederciclismo(_url: string, _html: string): Promise<ParsedEvent[]> {
  void _url;
  void _html;
  const windows = fciWindowsForRun();
  const pageBudget = Math.floor(MAX_PAGES_PER_RUN / MONTHS_PER_RUN);
  const byKey = new Map<string, ParsedEvent>();
  let filled = 0;

  // Empty windows do not consume the per-run page budget.
  for (const { start, end } of windows) {
    if (filled >= MONTHS_PER_RUN) break;
    const events = await fetchPages(start, end, pageBudget);
    if (!events.length) continue;
    for (const ev of events) byKey.set(ev.externalId, ev);
    filled += 1;
  }

  return [...byKey.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

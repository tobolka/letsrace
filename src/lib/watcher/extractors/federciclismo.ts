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
/** How many calendar months to cover in one run (rotated across crons). */
const MONTHS_PER_RUN = 3;
/** Look-ahead from the current month (rest of season + a bit). */
const HORIZON_MONTHS = 8;

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

function mapFciDiscipline(text: string): Discipline[] {
  const t = text.toLowerCase();
  if (/fuoristrada|mtb|mountain|cross.?country|enduro|downhill/.test(t)) return ["xco"];
  if (/pista|track/.test(t)) return ["other"];
  if (/ciclocross|cyclo/.test(t)) return ["cx"];
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
  // Slot changes about every 2h (matches vercel cron)
  const slot = Math.floor(Date.now() / (2 * 60 * 60 * 1000));
  const startOffset = (slot * MONTHS_PER_RUN) % HORIZON_MONTHS;
  const windows: { start: Date; end: Date }[] = [];
  for (let i = 0; i < HORIZON_MONTHS && windows.length < MONTHS_PER_RUN; i++) {
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
 * across rotating 2-month windows so the whole season fills in over successive crons.
 */
export async function parseFederciclismo(_url: string, _html: string): Promise<ParsedEvent[]> {
  const base = monthStartUtc(new Date().getUTCFullYear(), new Date().getUTCMonth());
  const slot = Math.floor(Date.now() / (2 * 60 * 60 * 1000));
  const startOffset = (slot * MONTHS_PER_RUN) % HORIZON_MONTHS;
  const pageBudget = Math.floor(MAX_PAGES_PER_RUN / MONTHS_PER_RUN);
  const byKey = new Map<string, ParsedEvent>();
  let filled = 0;

  // Walk horizon from rotated offset; keep going past empty months until we fill MONTHS_PER_RUN
  for (let i = 0; i < HORIZON_MONTHS && filled < MONTHS_PER_RUN; i++) {
    const off = (startOffset + i) % HORIZON_MONTHS;
    const t = new Date(base);
    t.setUTCMonth(t.getUTCMonth() + off);
    const start = monthStartUtc(t.getUTCFullYear(), t.getUTCMonth());
    const end = monthEndUtc(t.getUTCFullYear(), t.getUTCMonth());
    const events = await fetchPages(start, end, pageBudget);
    if (!events.length) continue;
    for (const ev of events) byKey.set(ev.externalId, ev);
    filled += 1;
  }

  return [...byKey.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

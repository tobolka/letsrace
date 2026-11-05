import { join } from "node:path";
import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { readJson, writeJsonAtomic } from "@/lib/catalog/local-source-cache";
import { fetchText } from "@/lib/watcher/http";
import { sleep } from "@/lib/watcher/pool";

const CALENDAR = "https://www.trevisomtb.it/Calendario.aspx";
const FIELD = "ctl00$ContenitorePrincipale$";
const NEXT_PAGE = `${FIELD}DataPagerEventi$ctl00$ctl01`;
/** The site is one small server: a single request at a time, well spaced. */
const PAUSE_MS = 2_500;
/** A local worker that stays silent longer gets replaced; what is left waits for the next read. */
const READ_BUDGET_MS = 200_000;
const MAX_PAGES_A_MONTH = 6;
/** A finished month changes rarely, so it is asked again only this seldom. */
const PAST_MONTH_FRESH_MS = 30 * 86_400_000;
/** Coming months daily at most, so a read that has places left to find can get to them. */
const COMING_MONTH_FRESH_MS = 20 * 3_600_000;

export function isTrevisoMtbHost(host: string): boolean {
  return host.replace(/^www\./, "") === "trevisomtb.it";
}

export type TrevisoRow = { id: string; name: string; startDate: string; activity: string; summary: string };
type Saved = { months: Record<string, { at: number; rows: TrevisoRow[] }>; places: Record<string, string> };

/** The cards of one calendar page. The dot says what kind of event it is. */
export function parseTrevisoCards(html: string): TrevisoRow[] {
  const $ = cheerio.load(html);
  const rows: TrevisoRow[] = [];
  $(".singolaNewsHomePage").each((_, card) => {
    const dot = $(card).find('img[src*="PallinoAttivita"]').first();
    const activity = /PallinoAttivita(\d+)/.exec(dot.attr("src") ?? "")?.[1];
    const date = /(\d{2})\/(\d{2})\/(\d{4})/.exec(dot.parent().text());
    const id = /IDEvento=(\d+)/.exec($(card).find('a[href*="IDEvento="]').first().attr("href") ?? "")?.[1];
    const name = $(card).find(".titoloNewsHomePage").first().text().replace(/\s+/g, " ").trim();
    if (!activity || !date || !id || name.length < 3) return;
    const summary = $(card).find(".testoAbstractNewsElenco").first().text().replace(/\s+/g, " ").trim();
    rows.push({ id, name, startDate: `${date[3]}-${date[2]}-${date[1]}`, activity, summary });
  });
  return rows;
}

/** "01/11/2026 - 6° TROFEO CITTÀ DI FIRENZE - Mugello (Fi) - TrevisoMTB" names the place last. */
export function placeFromTitle(html: string): string | null {
  const title = cheerio.load(html)("title").first().text().replace(/\s+/g, " ").trim();
  const parts = title.split(" - ").map(part => part.trim());
  if (parts.length < 4 || !/^trevisomtb$/i.test(parts.at(-1) ?? "")) return null;
  const place = parts.at(-2)!;
  return place.length >= 2 && !/^\d/.test(place) ? place : null;
}

/** MTB, children's MTB, cyclo-cross and road. The site's other dots are running, rallies and notices. */
export function trevisoEvent(row: TrevisoRow, place: string): ParsedEvent | null {
  const text = `${row.name} ${row.summary}`.toLowerCase();
  let discipline: Discipline[];
  if (row.activity === "05") discipline = ["cx"];
  else if (row.activity === "02") discipline = ["road"];
  else if (row.activity === "01" || row.activity === "03") {
    // The site files some cyclo-cross under its MTB dot; the name says which it is.
    if (/ciclocross|\bcx\b/.test(text)) discipline = ["cx"];
    else if (/\benduro\b/.test(text)) discipline = ["enduro"];
    else if (/\bdownhill\b|\bdh\b/.test(text)) discipline = ["dh"];
    else if (/\bgravel\b/.test(text)) discipline = ["gravel"];
    else if (/marathon|maratona|granfondo|gran fondo|\bxcm\b/.test(text)) discipline = ["xcm"];
    else discipline = ["xco"];
  } else return null;
  return {
    externalId: `trevisomtb-${row.id}-${row.startDate}`,
    name: row.name,
    startDate: row.startDate,
    placeText: `${place}, Italia`,
    countryHint: "IT",
    discipline,
    ...(row.activity === "01" ? { ageCategories: ["kids"] } : {}),
    sourceUrl: `https://www.trevisomtb.it/Raggruppamenti.aspx?IDEvento=${row.id}`,
    confidence: 0.8,
  };
}

const hiddenFields = (html: string) => {
  const $ = cheerio.load(html), fields: Record<string, string> = {};
  $('input[type="hidden"]').each((_, input) => { const name = $(input).attr("name"); if (name) fields[name] = $(input).attr("value") ?? ""; });
  return fields;
};
const hasNextPage = (html: string) => html.includes(NEXT_PAGE) && !/DataPagerEventi[^>]*disabled/i.test(html);

/** Future months soonest first, then this year's past months, latest first. */
export function trevisoMonths(now: Date): { year: number; month: number; past: boolean }[] {
  const year = now.getUTCFullYear(), month = now.getUTCMonth() + 1, out: { year: number; month: number; past: boolean }[] = [];
  for (let m = month; m <= 12; m++) out.push({ year, month: m, past: false });
  for (let m = 1; m <= 12; m++) out.push({ year: year + 1, month: m, past: false });
  for (let m = month - 1; m >= 1; m--) out.push({ year, month: m, past: true });
  return out;
}

export async function parseTrevisoMtb(now = new Date()): Promise<ParsedEvent[]> {
  const deadline = Date.now() + READ_BUDGET_MS;
  const directory = process.env.SOURCE_DOCUMENT_CACHE_DIR;
  const file = directory ? join(directory, "trevisomtb.json") : null;
  const saved: Saved = (file ? await readJson<Saved>(file) : null) ?? { months: {}, places: {} };
  const read = async (body?: string) => {
    await sleep(PAUSE_MS);
    const page = await fetchText(CALENDAR, body ? { method: "POST", body, contentType: "application/x-www-form-urlencoded", timeoutMs: 40_000 } : { timeoutMs: 40_000 });
    if (!page.ok || !page.text) throw new Error(`trevisomtb_calendar_http_${page.status}`);
    return page.text;
  };
  let html = await read();
  let shownYear = now.getUTCFullYear();
  const post = (target: string, year: number, month: number) => read(new URLSearchParams({
    ...hiddenFields(html), __EVENTTARGET: target, __EVENTARGUMENT: "",
    [`${FIELD}cmbAnno`]: String(year), [`${FIELD}cmbMese`]: String(month), [`${FIELD}cmbRaggruppamento`]: "0", [`${FIELD}chkGare`]: "on",
  }).toString());
  for (const { year, month, past } of trevisoMonths(now)) {
    if (Date.now() > deadline) break;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (saved.months[key] && Date.now() - saved.months[key]!.at < (past ? PAST_MONTH_FRESH_MS : COMING_MONTH_FRESH_MS)) continue;
    if (year !== shownYear) { html = await post(`${FIELD}cmbAnno`, year, month); shownYear = year; }
    html = await post(`${FIELD}cmbMese`, year, month);
    const rows = parseTrevisoCards(html);
    for (let page = 1; page < MAX_PAGES_A_MONTH && rows.length % 10 === 0 && rows.length && hasNextPage(html) && Date.now() <= deadline; page++) {
      html = await post(NEXT_PAGE, year, month);
      const more = parseTrevisoCards(html);
      if (!more.length || more.every(row => rows.some(known => known.id === row.id))) break;
      rows.push(...more);
    }
    saved.months[key] = { at: Date.now(), rows };
    if (file) await writeJsonAtomic(file, saved);
  }
  const today = now.toISOString().slice(0, 10);
  const all = Object.values(saved.months).flatMap(month => month.rows).sort((a, b) => Number(a.startDate < today) - Number(b.startDate < today) || a.startDate.localeCompare(b.startDate));
  const events: ParsedEvent[] = [];
  for (const row of all) {
    if (!["01", "02", "03", "05"].includes(row.activity)) continue;
    if (!saved.places[row.id] && Date.now() <= deadline) {
      await sleep(PAUSE_MS);
      const page = await fetchText(`https://www.trevisomtb.it/Raggruppamenti.aspx?IDEvento=${row.id}`, { timeoutMs: 40_000 }).catch(() => null);
      const place = page?.ok ? placeFromTitle(page.text) : null;
      if (place) { saved.places[row.id] = place; if (file) await writeJsonAtomic(file, saved); }
    }
    const place = saved.places[row.id];
    // Without its place a race would be held anyway; the next read asks again.
    const event = place ? trevisoEvent(row, place) : null;
    if (event) events.push(event);
  }
  return events;
}

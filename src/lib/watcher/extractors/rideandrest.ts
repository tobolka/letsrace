import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import type { EventType } from "@/lib/taxonomy";
import { fetchText } from "@/lib/watcher/http";

const ORIGIN = "https://rideandrest.net";
const MONTHS_AHEAD = 12;

export function isRideAndRestHost(host: string): boolean {
  return host.replace(/^www\./, "").endsWith("rideandrest.net");
}

/** What the "Tipo" label says about the ground and the format. */
function disciplineOf(tipo: string, pill: string): Discipline[] {
  const t = `${tipo} ${pill}`.toLowerCase();
  if (/ciclocross/.test(t)) return ["cx"];
  if (/downhill/.test(t)) return ["dh"];
  if (/enduro/.test(t)) return ["enduro"];
  if (/crosscountry/.test(t)) return ["xco"];
  if (/\bbmx\b/.test(t)) return ["bmx"];
  if (/\bpista\b/.test(t)) return ["track"];
  if (/gravel/.test(t)) return ["gravel"];
  if (/fuoristrada|mountain bike|mtb/.test(t)) return ["mtb"];
  if (/trial|handbike|fisdir/.test(t)) return ["other"];
  return ["road"];
}

function eventTypeOf(tipo: string, pill: string): EventType | undefined {
  const t = `${tipo} ${pill}`.toLowerCase();
  if (/granfondo|gran fondo|mediofondo/.test(t)) return "gran_fondo";
  if (/pedalata|raduno|cicloturistic|ciclostorica|randonn|non comp|non competitive/.test(t)) return "ride";
  return undefined;
}

const MONTH_NUMBER: Record<string, number> = { gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12 };
const shiftMonth = (ym: string, by: number) => {
  const date = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
/**
 * A month's page also lists what is still running from the month before, under the day it began:
 * "30 · fino al 2 Maggio" on May's page began on 30 April, not on 30 May.
 */
export function spanOf(ym: string, day: string, until: string): { startDate: string; endDate?: string } {
  const start = day.padStart(2, "0");
  const match = /fino al\s+(\d{1,2})\s+([a-zà-ú]+)/i.exec(until);
  const month = match ? MONTH_NUMBER[match[2]!.toLowerCase()] : undefined;
  if (!match || !month) return { startDate: `${ym}-${start}` };
  const endDay = match[1]!.padStart(2, "0"), endMonth = String(month).padStart(2, "0");
  const pageMonth = Number(ym.slice(5, 7));
  const began = month === pageMonth && Number(day) > Number(endDay) ? shiftMonth(ym, -1) : ym;
  // A span into next year is named by its month alone.
  const endYear = month < Number(began.slice(5, 7)) ? Number(began.slice(0, 4)) + 1 : Number(began.slice(0, 4));
  return { startDate: `${began}-${start}`, endDate: `${endYear}-${endMonth}-${endDay}` };
}

/**
 * One month of rideandrest.net's calendar: every Italian race the federation
 * lists, with the day, the town, the length and the kind. The page names no
 * organiser site, so the row carries only what it states; the detail page is
 * kept as the source.
 */
export function parseRideAndRestMonth(html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const month = html.match(/\?mese=(\d{4})-(\d{2})/);
  const ym = month ? `${month[1]}-${month[2]}` : null;
  if (!ym) return [];
  const out: ParsedEvent[] = [];
  $("ul.rr-cal-elenco > li").each((_, li) => {
    const day = $(li).find(".rr-cal-gg").first().clone().children().remove().end().text().trim();
    const a = $(li).find(".rr-cal-corpo > a").first();
    const href = a.attr("href") ?? "";
    const name = a.text().replace(/\s+/g, " ").trim();
    const slug = href.match(/\/manifestazione\/([^/]+)\/?$/)?.[1];
    if (!/^\d{1,2}$/.test(day) || !slug || name.length < 3) return;
    const meta = $(li).find(".rr-cal-meta").first();
    const pill = meta.find(".rr-cal-pillola").text().trim();
    const parts = meta
      .clone()
      .children()
      .remove()
      .end()
      .text()
      .split("·")
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const place = parts[0] ?? "";
    const tipo = parts[parts.length - 1] ?? "";
    const { startDate, endDate } = spanOf(ym, day, meta.find("strong").first().text());
    out.push({
      externalId: `rideandrest-${slug}-${startDate}`,
      name,
      startDate,
      ...(endDate ? { endDate } : {}),
      placeText: place ? `${place}, Italia` : "Italia",
      countryHint: "IT",
      discipline: disciplineOf(tipo, pill),
      eventType: eventTypeOf(tipo, pill),
      sourceUrl: href,
      confidence: 0.8,
    });
  });
  return out;
}

/** The coming months, one page each. */
export async function parseRideAndRest(): Promise<ParsedEvent[]> {
  const now = new Date();
  const byId = new Map<string, ParsedEvent>();
  for (let i = 0; i < MONTHS_AHEAD; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const page = await fetchText(`${ORIGIN}/eventi/?mese=${ym}`, { timeoutMs: 25_000 });
    if (!page.ok || !page.text) continue;
    const today = now.toISOString().slice(0, 10);
    for (const ev of parseRideAndRestMonth(page.text)) {
      if (ev.startDate >= today) byId.set(ev.externalId, ev);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return [...byId.values()];
}

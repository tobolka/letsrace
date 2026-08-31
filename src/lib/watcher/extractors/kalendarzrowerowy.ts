import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { inferDisciplines } from "@/lib/taxonomy";
import { fetchText } from "@/lib/watcher/http";
import { isPolishYouthRace } from "@/lib/watcher/extractors/pl-shared";

const ORIGIN = "https://kalendarzrowerowy.pl";
/** A season plus the shoulder of the next one. */
const MONTHS_AHEAD = 14;

const BAR_DISCIPLINE: Record<string, Discipline> = {
  "cal-bar-gravel": "gravel",
  "cal-bar-szosa": "road",
  "cal-bar-mtb": "mtb",
};

type Pin = { title: string; slug: string; url?: string; lat?: number; lng?: number; bar?: string };

export function isKalendarzRowerowyHost(host: string): boolean {
  return host.replace(/^www\./, "").endsWith("kalendarzrowerowy.pl");
}

/**
 * The calendar renders a month at a time. Each day cell names the races running
 * that day, and the month's pins carry the coordinates, so the two together give
 * a dated, placed race without a detail fetch.
 */
export async function parseKalendarzRowerowy(url: string, html: string): Promise<ParsedEvent[]> {
  const byTitle = new Map<string, { pin: Pin; days: Set<string> }>();
  const start = new Date();

  for (let i = 0; i < MONTHS_AHEAD; i += 1) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthUrl = `${ORIGIN}/kalendarz/?miesiac=${month}`;
    const body = i === 0 && url.includes("/kalendarz") ? html : await fetchPage(monthUrl);
    if (!body) continue;
    collectMonth(body, byTitle);
  }

  const events: ParsedEvent[] = [];
  for (const { pin, days } of byTitle.values()) {
    const ev = toEvent(pin, days);
    if (ev) events.push(ev);
  }
  return events;
}

async function fetchPage(url: string): Promise<string | null> {
  const res = await fetchText(url, { timeoutMs: 20_000 });
  return res.ok && res.text ? res.text : null;
}

export function collectMonth(
  html: string,
  into: Map<string, { pin: Pin; days: Set<string> }>,
): void {
  const $ = cheerio.load(html);

  for (const pin of monthPins($)) {
    const key = pin.title;
    if (!into.has(key)) into.set(key, { pin, days: new Set() });
  }

  $("[data-day]").each((_, cell) => {
    const day = $(cell).attr("data-day");
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    $(cell)
      .find(".home-month__bar[title]")
      .each((_i, bar) => {
        const title = ($(bar).attr("title") ?? "").trim();
        const entry = into.get(title);
        if (entry) entry.days.add(day);
      });
  });
}

/** The month's pins ride along in a JSON array on the calendar container. */
function monthPins($: cheerio.CheerioAPI): Pin[] {
  const pins: Pin[] = [];
  $("[x-data]").each((_, el) => {
    for (const attr of Object.values($(el).attr() ?? {})) {
      if (typeof attr !== "string" || !attr.trimStart().startsWith("[{")) continue;
      try {
        for (const p of JSON.parse(attr) as Pin[]) {
          if (p?.title && p?.slug) pins.push(p);
        }
      } catch {
        /* not the pin array */
      }
    }
  });
  return pins;
}

export function toEvent(pin: Pin, days: Set<string>): ParsedEvent | null {
  if (!days.size) return null;
  const sorted = [...days].sort();
  const startDate = sorted[0]!;
  const endDate = sorted[sorted.length - 1]!;

  // Titles carry the season in brackets; the dates already say which year it is.
  const name = pin.title.replace(/\s*\((?:19|20)\d{2}\)\s*$/, "").trim();
  if (name.length < 3) return null;

  const fromBar = pin.bar ? BAR_DISCIPLINE[pin.bar] : undefined;
  const discipline = inferDisciplines(name, fromBar ? [fromBar] : undefined);

  return {
    externalId: `kalrow-${pin.slug}`,
    name: name.slice(0, 160),
    startDate,
    endDate: endDate !== startDate ? endDate : undefined,
    placeText: "",
    countryHint: "PL",
    discipline: discipline.length ? discipline : fromBar ? [fromBar] : undefined,
    audience: isPolishYouthRace(name) ? "kids" : "mixed",
    sourceUrl: pin.url ? new URL(pin.url, ORIGIN).toString() : `${ORIGIN}/wydarzenie/${pin.slug}/`,
    lat: typeof pin.lat === "number" ? pin.lat : undefined,
    lng: typeof pin.lng === "number" ? pin.lng : undefined,
    confidence: 0.8,
  };
}

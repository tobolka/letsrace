import { load } from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";

export const SZC_CALENDARS: { url: string; discipline: Discipline }[] = [
  { url: "https://www.cyklistikaszc.sk/sk/cestna-cyklistika/kalendar", discipline: "road" },
  { url: "https://www.cyklistikaszc.sk/sk/mtb-cross-country/kalendar", discipline: "xco" },
  { url: "https://www.cyklistikaszc.sk/sk/mtb-downhill-fourcross/kalendar", discipline: "dh" },
  { url: "https://www.cyklistikaszc.sk/sk/cyklokros/kalendar", discipline: "cx" },
  { url: "https://www.cyklistikaszc.sk/sk/drahova-cyklistika/kalendar", discipline: "track" },
  { url: "https://www.cyklistikaszc.sk/sk/bmx-racing/kalendar", discipline: "bmx" },
  { url: "https://www.cyklistikaszc.sk/sk/cyklistika-pre-vsetkych/kalendar", discipline: "road" },
];

export type SzcCalendarRow = {
  title: string;
  startDate: string;
  endDate: string | null;
  place: string;
  discipline: Discipline;
  sourceUrl: string;
  registrationUrl: string | null;
  regulationsUrl: string | null;
  resultsUrl: string | null;
  rawQuote: string;
};

function parseSkDates(raw: string): { startDate: string; endDate: string | null } | null {
  const full = [...raw.matchAll(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/g)];
  if (!full.length) return null;
  if (full.length >= 2) {
    const s = `${full[0]![3]}-${full[0]![2]!.padStart(2, "0")}-${full[0]![1]!.padStart(2, "0")}`;
    const e = `${full[1]![3]}-${full[1]![2]!.padStart(2, "0")}-${full[1]![1]!.padStart(2, "0")}`;
    return { startDate: s, endDate: e !== s ? e : null };
  }
  // Range like "16.-20.9.2026"
  const range = raw.match(/(\d{1,2})\.\s*[-–]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (range) {
    const s = `${range[4]}-${range[3]!.padStart(2, "0")}-${range[1]!.padStart(2, "0")}`;
    const e = `${range[4]}-${range[3]!.padStart(2, "0")}-${range[2]!.padStart(2, "0")}`;
    return { startDate: s, endDate: e !== s ? e : null };
  }
  const s = `${full[0]![3]}-${full[0]![2]!.padStart(2, "0")}-${full[0]![1]!.padStart(2, "0")}`;
  return { startDate: s, endDate: null };
}

function resolveHref(href: string | undefined, base: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:")) return null;
  try { return new URL(trimmed, base).toString(); } catch { return null; }
}

function refineDiscipline(base: Discipline, title: string): Discipline {
  if (/gravel/i.test(title)) return "gravel";
  if (/cyklokros|cyclocross/i.test(title)) return "cx";
  if (/xcm|marat[oó]n/i.test(title) && /mtb|horsk/i.test(title)) return "xcm";
  if (/xco|cross\s*country/i.test(title)) return "xco";
  if (/enduro/i.test(title)) return "enduro";
  if (/downhill|zjazd/i.test(title)) return "dh";
  if (/4x|fourcross/i.test(title)) return "four_cross";
  if (/bmx/i.test(title)) return "bmx";
  return base;
}

/** Parses one discipline calendar table on cyklistikaszc.sk. */
export function parseSzcCalendar(html: string, sourceUrl: string, defaultDiscipline: Discipline): SzcCalendarRow[] {
  const $ = load(html);
  const rows: SzcCalendarRow[] = [];
  $("table tr").each((_, tr) => {
    const td1 = $(tr).find("td.td1").text().replace(/\s+/g, " ").trim();
    const dates = parseSkDates(td1);
    if (!dates) return;
    const td2 = $(tr).find("td.td2");
    const title = (td2.find("strong").first().text() || td2.text()).replace(/\s+/g, " ").trim();
    const place = $(tr).find("td.td3").text().replace(/\s+/g, " ").trim();
    if (!title || !place) return;
    if (/školenie|rozhodc|sústredenie|valné zhromaždenie/i.test(title)) return;
    const registrationUrl = resolveHref($(tr).find("td.td4 a").first().attr("href"), sourceUrl);
    const regulationsUrl = resolveHref($(tr).find("td.td6 a").first().attr("href"), sourceUrl);
    const resultsUrl = resolveHref($(tr).find("td.td7 a").first().attr("href"), sourceUrl);
    rows.push({
      title,
      startDate: dates.startDate,
      endDate: dates.endDate,
      place,
      discipline: refineDiscipline(defaultDiscipline, title),
      sourceUrl,
      registrationUrl,
      regulationsUrl,
      resultsUrl,
      rawQuote: `${td1} ${title} ${place}`.replace(/\s+/g, " ").trim().slice(0, 280),
    });
  });
  return rows;
}

export function szcParsedEvent(row: SzcCalendarRow): ParsedEvent {
  const slug = row.title.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return {
    externalId: `szc:${row.startDate}:${slug}`,
    name: row.title,
    startDate: row.startDate,
    ...(row.endDate ? { endDate: row.endDate } : {}),
    placeText: row.place,
    countryHint: "SK",
    discipline: [row.discipline],
    sourceUrl: row.sourceUrl,
    ...(row.registrationUrl ? { registrationUrl: row.registrationUrl } : {}),
    ...(row.regulationsUrl ? { regulationsUrl: row.regulationsUrl } : {}),
    ...(row.resultsUrl ? { resultsUrl: row.resultsUrl } : {}),
    confidence: 0.9,
    evidence: {
      quote: row.rawQuote,
      sourceUrl: row.sourceUrl,
      method: "szc_calendar",
      version: "szc-v1",
    },
  };
}

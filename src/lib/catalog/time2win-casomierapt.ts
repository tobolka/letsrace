import { load } from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";

export type Time2WinRaw = {
  Date: string;
  Name: string;
  EventTypeName?: string;
  Location?: string;
  LinkEvent?: string;
};

export type Time2WinEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  place: string;
  countryCode: string;
  discipline: Discipline;
  detailUrl: string;
  websiteUrl: string | null;
};

const T2W_CYCLING = /\b(?:radsport|mtb|gravel|radrennen|radmarathon|bike|cyclocross)\b/i;
const T2W_NOT_CYCLING = /\b(?:triathlon|duathlon|lauf|run|trail|ocr|hybrid|swim|ski)\b/i;

function mapT2wDiscipline(typeName: string, title: string): Discipline {
  const hay = `${typeName} ${title}`;
  if (/gravel/i.test(hay)) return "gravel";
  if (/cyclocross|cross\b/i.test(hay)) return "cx";
  if (/mtb|alpentour|mountainbike/i.test(hay)) return "xcm";
  return "road";
}

/** Parses the embedded JSON array on https://www.time2win.at/events and groups multi-day events by LinkEvent. */
export function parseTime2WinEvents(html: string): Time2WinEvent[] {
  const m = html.match(/\[\{"Date":"[^"]+[\s\S]*?\}\]/);
  if (!m) return [];
  let raw: Time2WinRaw[];
  try { raw = JSON.parse(m[0]); } catch { return []; }

  const grouped = new Map<string, { rows: Time2WinRaw[]; dates: string[] }>();
  for (const row of raw) {
    if (!row.Date || !row.Name || !row.LinkEvent) continue;
    const typeName = row.EventTypeName ?? "";
    if (!T2W_CYCLING.test(typeName) || T2W_NOT_CYCLING.test(typeName) || /\b(?:triathlon|duathlon)\b/i.test(row.Name)) continue;
    const key = row.LinkEvent;
    const entry = grouped.get(key) ?? { rows: [], dates: [] };
    entry.rows.push(row);
    if (!entry.dates.includes(row.Date)) entry.dates.push(row.Date);
    grouped.set(key, entry);
  }

  const out: Time2WinEvent[] = [];
  for (const [link, { rows, dates }] of grouped) {
    dates.sort();
    const first = rows[0]!;
    const id = link.match(/\/event\/(\d+)/)?.[1] ?? link;
    out.push({
      id,
      title: first.Name.trim(),
      startDate: dates[0]!,
      endDate: dates.length > 1 ? dates[dates.length - 1]! : null,
      place: (first.Location ?? "").trim(),
      countryCode: "AT",
      discipline: mapT2wDiscipline(first.EventTypeName ?? "", first.Name),
      detailUrl: `https://www.time2win.at${link}`,
      websiteUrl: null,
    });
  }
  return out;
}

/** Enriches a Time2WinEvent from its /event/<id> detail page (country & official website). */
export function enrichTime2WinFromDetail(ev: Time2WinEvent, html: string): Time2WinEvent {
  const $ = load(html);
  const text = $.text();
  let countryCode = ev.countryCode;
  if (/\bGermany\b|\bDeutschland\b/i.test(text)) countryCode = "DE";
  else if (/\bSwitzerland\b|\bSchweiz\b/i.test(text)) countryCode = "CH";
  else if (/\bItaly\b|\bItalien\b/i.test(text)) countryCode = "IT";
  else if (/\bAustria\b|\bÖsterreich\b/i.test(text)) countryCode = "AT";

  let websiteUrl: string | null = null;
  $("a[href^='http']").each((_, a) => {
    const href = $(a).attr("href")?.trim() ?? "";
    if (!href || /time2win\.at|google\.|facebook\.|instagram\.|openstreetmap|leaflet|jquery|bootstrapcdn|fontawesome|w3\.org/i.test(href)) return;
    if (!websiteUrl) websiteUrl = href;
  });
  return { ...ev, countryCode, websiteUrl };
}

export function time2WinParsedEvent(ev: Time2WinEvent, textQuote: string): ParsedEvent {
  return {
    externalId: `time2win:${ev.id}`,
    name: ev.title,
    startDate: ev.startDate,
    ...(ev.endDate ? { endDate: ev.endDate } : {}),
    placeText: ev.place,
    countryHint: ev.countryCode,
    discipline: [ev.discipline],
    sourceUrl: ev.detailUrl,
    ...(ev.websiteUrl ? { websiteUrl: ev.websiteUrl } : {}),
    registrationUrl: ev.detailUrl,
    confidence: 0.85,
    evidence: {
      quote: textQuote.slice(0, 280),
      sourceUrl: ev.detailUrl,
      method: "time2win",
      version: "time2win-v1",
    },
  };
}

export type TribeApiEvent = {
  id: number;
  title: string;
  url: string;
  start_date: string;
  end_date?: string;
  venue?: { venue?: string; city?: string; country?: string };
  categories?: { name?: string; slug?: string }[];
};

const SK_CYCLING = /\b(?:cyklo\w*|mtb|bike\w*|bicyk\w*|gravel|xco|xcm|enduro|cestn[aá]\s+cyklistik)/i;
const SK_NOT_CYCLING = /\b(?:beh\b|bežeck|run\b|triatlon|duatlon|polmarat[oó]n|nordic)/i;

export function parseCasomieraPtCycling(events: TribeApiEvent[]): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  for (const e of events) {
    const catText = (e.categories ?? []).map(c => `${c.name ?? ""} ${c.slug ?? ""}`).join(" ");
    const hay = `${e.title} ${catText}`;
    if (!SK_CYCLING.test(hay) || SK_NOT_CYCLING.test(hay)) continue;
    const startDate = e.start_date?.slice(0, 10);
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) continue;
    const endRaw = e.end_date?.slice(0, 10);
    const endDate = endRaw && endRaw !== startDate ? endRaw : undefined;
    const place = (e.venue?.city || e.venue?.venue || "").trim();
    if (!place) continue;
    const disc: Discipline = /gravel/i.test(hay) ? "gravel" : /cyklokros|cross/i.test(hay) ? "cx" : /mtb|marat[oó]n/i.test(hay) ? "xcm" : "road";
    out.push({
      externalId: `casomierapt:${e.id}`,
      name: e.title.replace(/&#8211;|&ndash;/g, "–").replace(/&amp;/g, "&").trim(),
      startDate,
      ...(endDate ? { endDate } : {}),
      placeText: place,
      countryHint: "SK",
      discipline: [disc],
      sourceUrl: e.url,
      registrationUrl: e.url,
      confidence: 0.85,
      evidence: {
        quote: `${e.title} ${startDate}${endDate ? ` - ${endDate}` : ""} ${place}`.slice(0, 280),
        sourceUrl: e.url,
        method: "casomierapt",
        version: "casomierapt-v1",
      },
    });
  }
  return out;
}

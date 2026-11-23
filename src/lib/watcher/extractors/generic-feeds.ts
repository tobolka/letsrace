import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { fetchText } from "@/lib/watcher/http";

const NON_RACE_NOISE =
  /\b(?:sch[uů]ze|valn[aá]\s+hromada|brig[aá]da|tr[eé]nink|training|soust[rř]ed[eě]n[ií]|kemp|camp|v[yý]ro[cč]n[ií]|ples|ve[cč][ií]rek|b[eě]h\b|b[eě]žeck|running|maraton\s+b[eě]h|triatlon|triathlon|duatlon|duathlon|plav[aá]n[ií]|swim|turistik|pochod|p[eě][sš][ií]|v[yý]let|vyj[ií][zž][dď]k|ausfahrt|radtour|rtf\b|brevet|meeting|versammlung)\b/i;

const CYCLING_HINT =
  /\b(?:cyklo|cyklist|kolo|kola|mtb|xco|xcm|xcc|xc\b|gravel|silni[cč]|bmx|enduro|downhill|\bdh\b|bike|biker|bajk|časovk|casovk|krit[eé]rium|kriterium|poh[aá]r|tour|radrennen|radmarathon|radquer|cyclocross|wy[sś]cig|rower|kolar|preteky|gara|ciclismo|gran\s*fondo|velodrom)\b/i;

function inferDiscipline(text: string): Discipline[] {
  const t = text.toLowerCase();
  if (/cyklokros|cyclocross|radquer|\bcx\b/.test(t)) return ["cx"];
  if (/downhill|\bdh\b/.test(t)) return ["dh"];
  if (/enduro/.test(t)) return ["enduro"];
  if (/\bbmx\b/.test(t)) return ["bmx"];
  if (/short\s*track|\bxcc\b/.test(t)) return ["xcc"];
  if (/cross\s*country|\bxco\b/.test(t)) return ["xco"];
  if (/marat[oó]n|\bxcm\b/.test(t) && /mtb|bike|bajk|horsk/.test(t)) return ["xcm"];
  if (/\bmtb\b|horsk[aáéyý]\s+kol|bajk/.test(t)) return ["mtb"];
  if (/gravel/.test(t)) return ["gravel"];
  if (/časovk|casovk|zeitfahren|time\s*trial|\btt\b/.test(t)) return ["tt"];
  if (/krit[eé]rium|\bcrit\b/.test(t)) return ["criterium"];
  if (/dr[aá]h|velodrom|\bbahn\b|\bpista\b/.test(t)) return ["track"];
  if (/gran\s*fondo|silni[cč]|cestn[aá]|strasse|szos/.test(t)) return ["road"];
  return ["mtb"];
}

function countryFromHost(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const tld = host.split(".").at(-1);
    if (tld && ["cz", "sk", "pl", "de", "at", "ch", "it"].includes(tld)) return tld.toUpperCase();
  } catch { /* ignore */ }
  return undefined;
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIcsDate(raw: string): { iso: string; allDay: boolean } | null {
  const clean = raw.trim();
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T\d{6}Z?)?$/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return { iso, allDay: clean.length === 8 };
}

function minusOneDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Parse an RFC 5545 iCalendar (`.ics`) feed — e.g. public Google Calendar or
 * WordPress/club `.ics` export — into normalized cycling race events.
 */
export function parseIcsEvents(sourceUrl: string, icsText: string): ParsedEvent[] {
  if (!/BEGIN:VEVENT/i.test(icsText)) return [];
  const unfolded = icsText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const blocks = unfolded.split(/BEGIN:VEVENT/i).slice(1);
  const countryHint = countryFromHost(sourceUrl);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const body = block.split(/END:VEVENT/i)[0] ?? "";
    const fields = new Map<string, string>();
    for (const line of body.split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).split(";")[0]!.toUpperCase().trim();
      const val = line.slice(idx + 1).trim();
      if (key && val && !fields.has(key)) fields.set(key, val);
    }

    const name = unescapeIcs(fields.get("SUMMARY") ?? "");
    const dtStart = parseIcsDate(fields.get("DTSTART") ?? "");
    if (!name || name.length < 3 || !dtStart) continue;

    const description = unescapeIcs(fields.get("DESCRIPTION") ?? "");
    const location = unescapeIcs(fields.get("LOCATION") ?? "");
    const combined = `${name} ${description}`;
    if (NON_RACE_NOISE.test(name) || (!CYCLING_HINT.test(combined) && !CYCLING_HINT.test(sourceUrl))) {
      continue;
    }

    const dtEndRaw = parseIcsDate(fields.get("DTEND") ?? "");
    let endDate: string | undefined;
    if (dtEndRaw) {
      // RFC 5545 all-day DTEND is exclusive (e.g. Saturday 20270515 -> DTEND 20270516).
      const candidate = dtEndRaw.allDay && dtEndRaw.iso > dtStart.iso ? minusOneDay(dtEndRaw.iso) : dtEndRaw.iso;
      if (candidate > dtStart.iso) endDate = candidate;
    }

    const uid = (fields.get("UID") ?? normalizeName(name)).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    const externalId = `ics-${uid}-${dtStart.iso}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const rawUrl = fields.get("URL")?.trim();
    const websiteUrl = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : undefined;

    events.push({
      externalId,
      name,
      startDate: dtStart.iso,
      endDate,
      placeText: location || "",
      countryHint,
      discipline: inferDiscipline(combined),
      audience: /d[eě]t|kids|ml[aá]de[zž]|junior|u\d{1,2}|sch[uü]ler|jugend/i.test(combined) ? "mixed" : "mixed",
      websiteUrl,
      sourceUrl,
      confidence: 0.78,
      evidence: {
        sourceUrl,
        quote: `${name} | ${dtStart.iso}${location ? ` | ${location}` : ""}`.slice(0, 300),
        method: "ics_calendar",
        version: "ics-v1",
      },
    });
  }
  return events;
}

type TribeEvent = {
  id?: number | string;
  title?: string;
  url?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  venue?: {
    venue?: string;
    city?: string;
    country?: string;
    geo_lat?: number;
    geo_lng?: number;
  };
  categories?: { name?: string }[];
};

const stripHtml = (html: string | undefined) =>
  (html ?? "").replace(/<[^>]+>/g, " ").replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, "–").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/**
 * Parse WordPress "The Events Calendar" REST API (`/wp-json/tribe/events/v1/events`)
 * JSON payload into normalized cycling race events.
 */
export function parseTribeEventsJson(sourceUrl: string, payload: unknown): ParsedEvent[] {
  const rows = (payload as { events?: TribeEvent[] } | null)?.events;
  if (!Array.isArray(rows) || !rows.length) return [];
  const defaultCountry = countryFromHost(sourceUrl);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const name = stripHtml(row.title);
    const startDate = row.start_date?.slice(0, 10);
    if (!name || name.length < 3 || !startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) continue;

    const cats = (row.categories ?? []).map((c) => c.name ?? "").join(" ");
    const desc = stripHtml(row.description);
    const combined = `${name} ${cats} ${desc}`;
    if (NON_RACE_NOISE.test(name) || (!CYCLING_HINT.test(combined) && !CYCLING_HINT.test(sourceUrl))) {
      continue;
    }

    const endRaw = row.end_date?.slice(0, 10);
    const endDate = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) && endRaw > startDate ? endRaw : undefined;
    const externalId = `tribe-${row.id ?? normalizeName(name)}-${startDate}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const placeParts = [row.venue?.venue, row.venue?.city].filter(Boolean);
    const placeText = placeParts.length ? placeParts.join(", ") : "";
    const lat = typeof row.venue?.geo_lat === "number" && Number.isFinite(row.venue.geo_lat) ? row.venue.geo_lat : undefined;
    const lng = typeof row.venue?.geo_lng === "number" && Number.isFinite(row.venue.geo_lng) ? row.venue.geo_lng : undefined;

    events.push({
      externalId,
      name,
      startDate,
      endDate,
      placeText,
      countryHint: defaultCountry,
      lat,
      lng,
      discipline: inferDiscipline(combined),
      websiteUrl: row.url && /^https?:\/\//i.test(row.url) ? row.url : undefined,
      sourceUrl: row.url && /^https?:\/\//i.test(row.url) ? row.url : sourceUrl,
      confidence: 0.82,
      evidence: {
        sourceUrl,
        quote: `${name} | ${startDate}${placeText ? ` | ${placeText}` : ""}`.slice(0, 300),
        method: "wp_tribe_events",
        version: "tribe-v1",
      },
    });
  }
  return events;
}

/** Detect an `.ics` link (Google Calendar or direct feed) in an HTML page. */
export function findIcsLinks(url: string, html: string): string[] {
  const $ = cheerio.load(html);
  const found = new Set<string>();
  const add = (raw: string | undefined) => {
    if (!raw) return;
    try {
      const abs = new URL(raw.trim(), url).toString();
      if (/^https?:\/\//i.test(abs)) found.add(abs);
    } catch { /* ignore */ }
  };
  $('link[rel="alternate"][type*="calendar"], link[href$=".ics"]').each((_, el) => add($(el).attr("href")));
  $('a[href*=".ics"], a[href*="calendar.google.com/calendar/ical/"]').each((_, el) => add($(el).attr("href")));
  return [...found].slice(0, 2);
}

/** Detect whether an HTML page uses WordPress "The Events Calendar" (Tribe Events). */
export function hasTribeEvents(html: string): boolean {
  return /\/wp-json\/tribe\/events\/v1|tribe-events|tribe_events_cat|tribe-common/i.test(html);
}

/**
 * Zero-AI generic feed extractor for small club and race websites:
 * 1) Direct `.ics` response body
 * 2) Linked `.ics` / Google Calendar feeds inside HTML
 * 3) WordPress The Events Calendar JSON API (`/wp-json/tribe/events/v1/events`)
 */
export async function extractGenericFeeds(
  url: string,
  body: string,
): Promise<{ events: ParsedEvent[]; strategy: string } | null> {
  if (/BEGIN:VCALENDAR/i.test(body.slice(0, 500))) {
    const events = parseIcsEvents(url, body);
    if (events.length) return { events, strategy: "feed:ics" };
  }

  if (hasTribeEvents(body)) {
    try {
      const origin = new URL(url).origin;
      const today = new Date().toISOString().slice(0, 10);
      const apiUrl = `${origin}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`;
      const res = await fetchText(apiUrl, { timeoutMs: 12_000 });
      if (res.ok && res.text) {
        const events = parseTribeEventsJson(apiUrl, JSON.parse(res.text));
        if (events.length) return { events, strategy: "feed:wp-tribe" };
      }
    } catch { /* fall through */ }
  }

  for (const icsUrl of findIcsLinks(url, body)) {
    try {
      const res = await fetchText(icsUrl, { timeoutMs: 12_000 });
      if (res.ok && res.text && /BEGIN:VEVENT/i.test(res.text)) {
        const events = parseIcsEvents(icsUrl, res.text);
        if (events.length) return { events, strategy: "feed:ics" };
      }
    } catch { /* try next */ }
  }

  return null;
}

import type { Discipline, ParsedEvent } from "@/lib/domain";
import { isIngestibleDate } from "@/lib/taxonomy";
import { fetchText } from "@/lib/watcher/http";

/** Cycling group on my.raceresult.com/events: Cycling, Bike Tour, MTB, CX, BMX. */
export const RR_CYCLING_TYPES = [11, 22, 2, 20, 13] as const;

/** Czech Republic, Germany, Slovakia, Austria, Poland. */
export const RR_COUNTRY_IDS = [203, 276, 703, 40, 616] as const;

const RR_TYPE_DISC: Record<number, Discipline[]> = {
  11: ["road"],
  22: ["gran_fondo"],
  2: ["mtb"],
  20: ["cx"],
  13: ["bmx"],
};

const RR_ALLOWED_CC = new Set(["CZ", "DE", "SK", "AT", "PL"]);

type RrEvent = {
  id?: number;
  name?: string;
  dateFrom?: string;
  dateTo?: string;
  location?: string;
  region?: string;
  countryCode?: string;
  eventType?: number;
  eventTypeName?: string;
  lat?: number;
  lng?: number;
  distances?: string;
};

type RrSection = {
  Mode?: string;
  Label?: string;
  HasMore?: boolean;
  Events?: RrEvent[];
};

function rrListUrl(opts: {
  modes: string;
  limit: number;
  dateFrom: string;
  dateTo: string;
}): string {
  const u = new URL("https://my.raceresult.com/RREvents/list");
  u.searchParams.set("type", RR_CYCLING_TYPES.join(","));
  u.searchParams.set("country", RR_COUNTRY_IDS.join(","));
  u.searchParams.set("dateFrom", opts.dateFrom);
  u.searchParams.set("dateTo", opts.dateTo);
  u.searchParams.set("modes", opts.modes);
  u.searchParams.set("limit", String(opts.limit));
  u.searchParams.set("lang", "en");
  return u.toString();
}

function windowDates(now = new Date()): { dateFrom: string; dateTo: string } {
  const y = now.getFullYear();
  return { dateFrom: `${y - 1}-01-01`, dateTo: `${y + 1}-12-31` };
}

async function fetchMode(modes: string, window: { dateFrom: string; dateTo: string }) {
  const rows: RrEvent[] = [];
  let limit = 500;
  for (let i = 0; i < 12; i++) {
    const res = await fetchText(rrListUrl({ modes, limit, ...window }), {
      timeoutMs: 45_000,
      accept: "application/json",
    });
    if (!res.ok) break;
    let payload: RrSection[] = [];
    try {
      payload = JSON.parse(res.text) as RrSection[];
    } catch {
      break;
    }
    const sec = payload.find((s) => (s.Mode || modes) === modes) ?? payload[0];
    const events = sec?.Events ?? [];
    rows.length = 0;
    rows.push(...events);
    if (!sec?.HasMore) break;
    limit = events.length + 400;
  }
  return rows;
}

export async function fetchRaceresultFilteredList(now = new Date()): Promise<RrSection[]> {
  const window = windowDates(now);
  const [last, next] = await Promise.all([fetchMode("last", window), fetchMode("next", window)]);
  return [
    { Mode: "last", Label: "Last Events", HasMore: false, Events: last },
    { Mode: "next", Label: "Next Events", HasMore: false, Events: next },
  ];
}

function mapDisc(row: RrEvent): Discipline[] {
  const fromType = RR_TYPE_DISC[row.eventType ?? -1];
  const blob = `${row.name ?? ""} ${row.eventTypeName ?? ""} ${row.distances ?? ""}`.toLowerCase();
  if (/\bcyclocross|\bcx\b|querfeldein/.test(blob)) return ["cx"];
  if (/\bbmx\b/.test(blob)) return ["bmx"];
  if (/\bdownhill|\bdh\b/.test(blob)) return ["dh"];
  if (/\benduro\b/.test(blob)) return ["enduro"];
  if (/\bgravel\b/.test(blob)) return ["gravel"];
  if (/\bxcm|marathon|bike[\s-]?marathon/.test(blob)) return ["xcm"];
  if (/\bxco|cross[\s-]?country/.test(blob)) return ["xco"];
  return fromType ?? ["mtb"];
}

export function parseRaceresultListPayload(data: unknown, _sourceUrl: string): ParsedEvent[] {
  const sections = Array.isArray(data) ? (data as RrSection[]) : [];
  const seen = new Set<number>();
  const out: ParsedEvent[] = [];
  for (const sec of sections) {
    for (const row of sec.Events ?? []) {
      const id = Number(row.id);
      if (!id || seen.has(id)) continue;
      const name = (row.name || "").replace(/\s+/g, " ").trim();
      const start = (row.dateFrom || "").slice(0, 10);
      if (!name || !isIngestibleDate(start)) continue;
      const cc = (row.countryCode || "").toUpperCase();
      if (cc && !RR_ALLOWED_CC.has(cc)) continue;
      seen.add(id);
      const place = [row.location, row.region].filter(Boolean).join(", ");
      const end = (row.dateTo || "").slice(0, 10);
      const href = `https://my.raceresult.com/${id}/`;
      const lat = typeof row.lat === "number" && row.lat !== 0 ? row.lat : undefined;
      const lng = typeof row.lng === "number" && row.lng !== 0 ? row.lng : undefined;
      out.push({
        externalId: `rr-${id}`,
        name,
        startDate: start,
        endDate: end && end !== start ? end : undefined,
        placeText: place || cc,
        countryHint: cc || undefined,
        discipline: mapDisc(row),
        audience: "mixed",
        sourceUrl: href,
        websiteUrl: href,
        registrationUrl: href,
        lat,
        lng,
        confidence: 0.84,
      });
    }
  }
  return out;
}

/** Listing at https://my.raceresult.com/events/ — cycling in CZ/DE/SK/AT/PL. */
export async function parseRaceresultEvents(url: string, html: string): Promise<ParsedEvent[]> {
  const trimmed = html.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      return parseRaceresultListPayload(JSON.parse(trimmed), url);
    } catch {
      /* fetch live list */
    }
  }
  const payload = await fetchRaceresultFilteredList();
  return parseRaceresultListPayload(payload, url);
}

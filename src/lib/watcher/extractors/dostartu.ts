import type { ParsedEvent } from "@/lib/domain";
import { inferDisciplines } from "@/lib/taxonomy";
import { fetchText } from "@/lib/watcher/http";
import { isPolishYouthRace } from "@/lib/watcher/extractors/pl-shared";

const API = "https://api.dostartu.pl/competitions";
const SITE = "https://dostartu.pl";
const MAX_PAGES = 12;
const PER_PAGE = 100;

/**
 * dostartu.pl is a multi-sport entry platform; `types_31`/`types_36` in its own
 * message catalogue are the two cycling sports (road and MTB). Everything else
 * on the platform is running, triathlon, skating and the like.
 */
const CYCLING_TYPES = new Set([31, 36]);
const TYPE_FALLBACK: Record<number, "road" | "mtb"> = { 31: "road", 36: "mtb" };

type ApiCompetition = {
  id?: number;
  name?: string | null;
  type?: number | null;
  startedTime?: string | null;
  endDate?: string | null;
  location?: string | null;
  locationLat?: number | string | null;
  locationLng?: number | string | null;
  permaLink?: string | null;
  websitePl?: string | null;
};

export function isDostartuHost(host: string): boolean {
  return host.replace(/^www\./, "").endsWith("dostartu.pl");
}

/**
 * The listing page is a Vue shell, so read the JSON its own client reads. The
 * feed carries coordinates and the organiser's site, which spares us a geocode
 * and gives the race a real link instead of a platform page.
 */
export async function parseDostartu(): Promise<ParsedEvent[]> {
  const since = new Date().toISOString();
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${API}?dateSince=${encodeURIComponent(since)}&page=${page}&itemsPerPage=${PER_PAGE}`;
    const res = await fetchText(url, { accept: "application/json", timeoutMs: 20_000 });
    if (!res.ok || !res.text) break;

    let rows: ApiCompetition[];
    try {
      rows = (JSON.parse(res.text) as { competitions?: ApiCompetition[] }).competitions ?? [];
    } catch {
      break;
    }
    if (!rows.length) break;

    for (const row of rows) {
      const ev = toEvent(row);
      if (!ev || seen.has(ev.externalId)) continue;
      seen.add(ev.externalId);
      events.push(ev);
    }
    if (rows.length < PER_PAGE) break;
  }

  return events;
}

export function toEvent(row: ApiCompetition): ParsedEvent | null {
  const type = Number(row.type);
  if (!CYCLING_TYPES.has(type)) return null;

  const name = (row.name ?? "").replace(/\s+/g, " ").trim();
  const startDate = isoDay(row.startedTime);
  if (!name || name.length < 3 || !row.id || !startDate) return null;

  const endDate = isoDay(row.endDate);
  const discipline = inferDisciplines(name);
  const website = normalizeWebsite(row.websitePl);

  return {
    externalId: `dostartu-${row.id}`,
    name: name.slice(0, 160),
    startDate,
    endDate: endDate && endDate !== startDate ? endDate : undefined,
    placeText: (row.location ?? "").replace(/\s+/g, " ").trim() || "Poland",
    countryHint: "PL",
    discipline: discipline.length ? discipline : [TYPE_FALLBACK[type]!],
    audience: isPolishYouthRace(name) ? "kids" : "mixed",
    sourceUrl: `${SITE}${row.permaLink ?? `/permalink-v${row.id}`}`,
    ...(website ? { websiteUrl: website } : {}),
    registrationUrl: `${SITE}${row.permaLink ?? `/permalink-v${row.id}`}`,
    lat: coord(row.locationLat),
    lng: coord(row.locationLng),
    confidence: 0.85,
  };
}

function isoDay(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : undefined;
}

function coord(raw: number | string | null | undefined): number | undefined {
  const n = typeof raw === "string" ? Number.parseFloat(raw) : raw;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/** Organisers type their site by hand, so half of them arrive without a scheme. */
function normalizeWebsite(raw: string | null | undefined): string | undefined {
  const t = (raw ?? "").trim();
  if (!t || t.length < 4) return undefined;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    // Organisers type "brak" or "-" into the field as often as a real address.
    if (!u.hostname.includes(".") || isDostartuHost(u.hostname)) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

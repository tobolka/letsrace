import type { Discipline, ParsedEvent } from "@/lib/domain";

type ApiEvent = {
  id: number;
  title: string;
  description?: string | null;
  city?: string | null;
  address?: string | null;
  bundesland?: string | null;
  country?: string | null;
  eventDate?: string | null;
  endDate?: string | null;
  category?: string | null;
  secondaryCategories?: string[] | null;
  eventType?: string | null;
  organizerUrl?: string | null;
  cancelled?: boolean;
  active?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  distances?: { distanceKm?: number | null; elevationMeters?: number | null; label?: string | null }[];
};

type ApiPage = {
  content: ApiEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

function mapCategory(cat?: string | null, secondary?: string[] | null, eventType?: string | null): Discipline[] {
  const blob = [cat, ...(secondary ?? []), eventType].filter(Boolean).join(" ").toUpperCase();
  const out = new Set<Discipline>();
  if (/MTB|XCO|XCM|MOUNTAIN/.test(blob)) out.add(/XCM|MARATHON/.test(blob) ? "xcm" : "xco");
  if (/GRAVEL/.test(blob)) out.add("gravel");
  if (/CX|CYCLO|QUER/.test(blob)) out.add("cx");
  if (/TT|ZEITFAHREN/.test(blob)) out.add("tt");
  if (/ROAD|RENNRAD|RADMARATHON|JEDERMANN|GRAN.?FONDO|RTF/.test(blob)) out.add("road");
  if (/DH|DOWNHILL/.test(blob)) out.add("dh");
  if (/ENDURO/.test(blob)) out.add("enduro");
  if (!out.size) out.add("road");
  return [...out];
}

function countryHint(code?: string | null, bundesland?: string | null): string {
  const c = (code || "").toUpperCase();
  if (c.length === 2) return c;
  if (/schweiz|switzerland/i.test(bundesland || "")) return "CH";
  if (/österreich|austria|oesterreich/i.test(bundesland || "")) return "AT";
  return "DE";
}

function toParsed(ev: ApiEvent): ParsedEvent | null {
  if (!ev.title || !ev.eventDate) return null;
  if (ev.cancelled || ev.active === false) return null;
  const startDate = ev.eventDate.slice(0, 10);
  const place =
    ev.city ||
    ev.address ||
    ev.bundesland ||
    "Germany";
  const cats = (ev.distances ?? [])
    .filter((d) => d.distanceKm != null)
    .map((d) => ({
      name: d.label || `${d.distanceKm} km`,
      distanceKm: Number(d.distanceKm),
      elevationM: d.elevationMeters != null ? Number(d.elevationMeters) : undefined,
    }));

  const detailUrl = `https://radsport-events.de/events/${ev.id}`;
  const organizer = (ev.organizerUrl || "").trim() || undefined;

  return {
    externalId: `radsport-${ev.id}-${startDate}`,
    name: ev.title.trim(),
    startDate,
    endDate: ev.endDate?.slice(0, 10) || undefined,
    placeText: place.slice(0, 100),
    countryHint: countryHint(ev.country, ev.bundesland),
    discipline: mapCategory(ev.category, ev.secondaryCategories, ev.eventType),
    audience: /kids|jugend|nachwuchs|u1[0-9]|schüler|schueler/i.test(ev.title)
      ? "youth"
      : "mixed",
    categories: cats.length ? cats : undefined,
    sourceUrl: detailUrl,
    websiteUrl: organizer,
    registrationUrl: organizer,
    lat: ev.latitude ?? undefined,
    lng: ev.longitude ?? undefined,
    confidence: 0.9,
  };
}

async function fetchPage(page: number, size: number): Promise<ApiPage | null> {
  const url = `https://api.radsport-events.de/api/v1/events?page=${page}&size=${size}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "LetsRaceBot/0.1 (+https://letsrace.cz; race calendar aggregator)",
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) return null;
  return (await res.json()) as ApiPage;
}

/** radsport-events.de — SPA backed by public JSON API. */
export async function parseRadsportEvents(_url: string, _html?: string): Promise<ParsedEvent[]> {
  const byId = new Map<string, ParsedEvent>();
  const size = 50;
  // First page to learn totalPages, then crawl a bounded window of upcoming races
  const first = await fetchPage(0, size);
  if (!first?.content?.length) return [];

  for (const row of first.content) {
    const p = toParsed(row);
    if (p) byId.set(p.externalId, p);
  }

  const maxPages = Math.min(first.totalPages || 1, 6); // ~300 events
  for (let page = 1; page < maxPages; page++) {
    const data = await fetchPage(page, size);
    if (!data?.content?.length) break;
    for (const row of data.content) {
      const p = toParsed(row);
      if (p) byId.set(p.externalId, p);
    }
  }

  return [...byId.values()]
    .filter((e) => e.startDate >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

import type { Discipline, ParsedEvent } from "@/lib/domain";
import { isRegistrationPlatformUrl } from "@/lib/watcher/registration-url";

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
  locationName?: string | null;
  postalCode?: string | null;
  registrationStatus?: string | null;
  tentative?: boolean;
  status?: string | null;
  distances?: { distanceKm?: number | null; elevationMeters?: number | null; label?: string | null }[];
};

type ApiPage = {
  content: ApiEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

/**
 * `eventType` is the precise field — `category` only says ROAD / MTB / GRAVEL.
 * RTF (Radtouristikfahrt) and CTF (Country-Tour-Fahrt) are organised rides, not
 * races; they are a fifth of this calendar and belong on the map labelled as
 * what they are.
 */
const EVENT_TYPE_DISCIPLINE: Record<string, Discipline[]> = {
  CROSSCOUNTRY: ["xco"],
  MTB_MARATHON: ["xcm"],
  MTB_RACE: ["xco"],
  DOWNHILL: ["dh"],
  ENDURO: ["enduro"],
  CYCLOCROSS: ["cx"],
  GRAVEL_RACE: ["gravel"],
  GRAVEL_TOUR: ["gravel"],
  RADMARATHON: ["road", "gran_fondo"],
  JEDERMANN: ["road", "gran_fondo"],
  BERGZEITFAHREN: ["hill_climb", "tt"],
  ZEITFAHREN: ["tt"],
  KRITERIUM: ["criterium"],
  STRASSENRENNEN: ["road_race"],
  RTF: ["road"],
  CTF: ["mtb"],
  BAHN: ["track"],
  BMX: ["bmx"],
};

/** Event types that are rides or tours rather than competition. */
const RIDE_EVENT_TYPES = new Set([
  "RTF",
  "CTF",
  "GRAVEL_TOUR",
  "TOUR",
  "AUSFAHRT",
  "RADTOURISTIK",
]);

function mapCategory(
  cat?: string | null,
  secondary?: string[] | null,
  eventType?: string | null,
): Discipline[] {
  const type = (eventType || "").toUpperCase().replace(/[\s-]+/g, "_");
  const fromType = EVENT_TYPE_DISCIPLINE[type];
  if (fromType) return [...fromType];

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

/** Start line as the source states it: venue, town, postcode. */
function placeOf(ev: ApiEvent): string {
  const parts = [ev.locationName, ev.city].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  const seen = new Set<string>();
  const place = parts
    .filter((p) => {
      const k = p.toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(", ");
  return (place || ev.address || ev.bundesland || "Germany").slice(0, 100);
}

function toParsed(ev: ApiEvent): ParsedEvent | null {
  if (!ev.title || !ev.eventDate) return null;
  if (ev.cancelled || ev.active === false) return null;
  if (ev.status && ev.status.toUpperCase() !== "PUBLISHED") return null;
  const startDate = ev.eventDate.slice(0, 10);
  const cats = (ev.distances ?? [])
    .filter((d) => d.distanceKm != null)
    .map((d) => ({
      name: d.label || `${d.distanceKm} km`,
      distanceKm: Number(d.distanceKm),
      elevationM: d.elevationMeters != null ? Number(d.elevationMeters) : undefined,
    }));

  const detailUrl = `https://radsport-events.de/events/${ev.id}`;
  const organizer = (ev.organizerUrl || "").trim() || undefined;
  const type = (ev.eventType || "").toUpperCase().replace(/[\s-]+/g, "_");

  return {
    externalId: `radsport-${ev.id}-${startDate}`,
    name: ev.title.trim(),
    startDate,
    endDate: ev.endDate?.slice(0, 10) || undefined,
    placeText: placeOf(ev),
    countryHint: countryHint(ev.country, ev.bundesland),
    discipline: mapCategory(ev.category, ev.secondaryCategories, ev.eventType),
    audience: /kids|jugend|nachwuchs|u1[0-9]|schüler|schueler/i.test(ev.title)
      ? "youth"
      : "mixed",
    categories: cats.length ? cats : undefined,
    // The listing is the provenance; the organiser's own page is the link a
    // rider wants. radsport-events.de is a dump host, so `publicRaceUrl` keeps
    // it out of the website slot and it stands in only as the listing.
    sourceUrl: detailUrl,
    websiteUrl: organizer,
    // An organiser homepage is not an entry form. Offer it as "Register" only
    // when it actually is one, or the card grows a button that goes nowhere.
    registrationUrl: organizer && isRegistrationPlatformUrl(organizer) ? organizer : undefined,
    // RTF and CTF are organised rides, a fifth of this calendar. The source
    // says so outright, which beats inferring it from a German title.
    eventType: RIDE_EVENT_TYPES.has(type) ? "ride" : undefined,
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

/**
 * radsport-events.de — SPA backed by a public JSON API.
 *
 * The crawl used to stop after six pages of fifty, so 300 of 640 races were
 * simply never seen. The API caps `size` at 100, so walk every page it reports;
 * `MAX_API_PAGES` is a runaway guard, not a budget.
 */
const MAX_API_PAGES = 40;

export async function parseRadsportEvents(_url: string, _html?: string): Promise<ParsedEvent[]> {
  const byId = new Map<string, ParsedEvent>();
  const size = 100;
  const first = await fetchPage(0, size);
  if (!first?.content?.length) return [];

  const collect = (rows: ApiEvent[]) => {
    for (const row of rows) {
      const parsed = toParsed(row);
      if (parsed) byId.set(parsed.externalId, parsed);
    }
  };
  collect(first.content);

  const pages = Math.min(first.totalPages || 1, MAX_API_PAGES);
  for (let page = 1; page < pages; page++) {
    const data = await fetchPage(page, size);
    if (!data?.content?.length) break;
    collect(data.content);
  }

  return [...byId.values()]
    .filter((e) => e.startDate >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

import { isPublicMapWorthy } from "@/lib/event-visibility";
import { isListedCountry } from "@/lib/geo/europe";
import { createServerSupabase } from "@/lib/supabase/server";

export type MissingFlag =
  | "coords"
  | "place"
  | "website"
  | "registration"
  | "disciplines"
  | "bad_place";

export type IncompleteEvent = {
  id: string;
  name: string;
  startDate: string;
  audience: string;
  disciplines: string[];
  websiteUrl: string | null;
  registrationUrl: string | null;
  level: string | null;
  placeName: string | null;
  municipality: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  locationId: string | null;
  geocodeStatus: string | null;
  missing: MissingFlag[];
};

export type DataQualitySummary = Record<MissingFlag | "total" | "incomplete", number>;

const BAD_PLACE_RE =
  /^(unknown|uci(\s+(c1|c2|c3|cn))?|cn|silnice|—|-|\d{1,2}\.\d{1,2}\.\d{4})$/i;

function isBadPlace(raw: string | null | undefined): boolean {
  const t = (raw || "").replace(/,\s*[A-Z]{2}\s*$/, "").trim();
  if (!t) return true;
  if (BAD_PLACE_RE.test(t)) return true;
  if (/^https?:/i.test(t)) return true;
  return false;
}

export function computeMissing(row: {
  location_id: string | null;
  website_url: string | null;
  registration_url: string | null;
  disciplines: string[] | null;
  location: {
    name: string | null;
    municipality: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
}): MissingFlag[] {
  const missing: MissingFlag[] = [];
  const place =
    row.location?.municipality || row.location?.name || null;

  if (!row.location_id || !place) missing.push("place");
  else if (isBadPlace(place)) missing.push("bad_place");

  if (row.location_id && (row.location?.lat == null || row.location?.lng == null)) {
    missing.push("coords");
  }
  if (!row.location_id) missing.push("coords");

  if (!row.website_url?.trim()) missing.push("website");
  if (!row.registration_url?.trim()) missing.push("registration");
  if (!row.disciplines?.length) missing.push("disciplines");

  return missing;
}

/** Completeness queue: races that can actually appear on the public map. */
export function isWorkQueueEvent(event: {
  websiteUrl?: string | null;
  registrationUrl?: string | null;
  countryCode?: string | null;
}): boolean {
  if (event.countryCode && !isListedCountry(event.countryCode)) return false;
  return isPublicMapWorthy({
    websiteUrl: event.websiteUrl,
    registrationUrl: event.registrationUrl,
    location: { countryCode: event.countryCode },
  });
}

export async function listIncompleteEvents(opts?: {
  upcomingOnly?: boolean;
  limit?: number;
}): Promise<{ summary: DataQualitySummary; events: IncompleteEvent[] }> {
  const supabase = createServerSupabase();
  const upcomingOnly = opts?.upcomingOnly ?? true;
  const limit = opts?.limit ?? 400;
  const today = new Date().toISOString().slice(0, 10);

  const rows: {
    id: string;
    name: string;
    start_date: string;
    audience: string;
    disciplines: string[] | null;
    website_url: string | null;
    registration_url: string | null;
    level: string | null;
    location_id: string | null;
    location:
      | {
          id: string;
          name: string | null;
          municipality: string | null;
          country_code: string | null;
          lat: number | null;
          lng: number | null;
          geocode_status: string | null;
        }
      | {
          id: string;
          name: string | null;
          municipality: string | null;
          country_code: string | null;
          lat: number | null;
          lng: number | null;
          geocode_status: string | null;
        }[]
      | null;
  }[] = [];

  for (let from = 0; from < 6000; from += 1000) {
    let query = supabase
      .from("events")
      .select(
        `id, name, start_date, audience, disciplines, website_url, registration_url, level, location_id,
         location:locations(id, name, municipality, country_code, lat, lng, geocode_status)`,
      )
      .eq("visibility", "public")
      .neq("status", "cancelled")
      .order("start_date", { ascending: true })
      .range(from, from + 999);
    if (upcomingOnly) query = query.gte("start_date", today);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) break;
  }

  const summary: DataQualitySummary = {
    total: 0,
    incomplete: 0,
    coords: 0,
    place: 0,
    website: 0,
    registration: 0,
    disciplines: 0,
    bad_place: 0,
  };

  const events: IncompleteEvent[] = [];

  for (const row of rows) {
    const loc = Array.isArray(row.location) ? row.location[0] : row.location;
    if (
      !isWorkQueueEvent({
        websiteUrl: row.website_url,
        registrationUrl: row.registration_url,
        countryCode: loc?.country_code,
      })
    ) {
      continue;
    }
    summary.total += 1;

    const missing = computeMissing({
      location_id: row.location_id,
      website_url: row.website_url,
      registration_url: row.registration_url,
      disciplines: row.disciplines,
      location: loc
        ? {
            name: loc.name,
            municipality: loc.municipality,
            lat: loc.lat,
            lng: loc.lng,
          }
        : null,
    });

    for (const m of missing) summary[m] += 1;
    if (missing.length === 0) continue;
    summary.incomplete += 1;

    events.push({
      id: row.id,
      name: row.name,
      startDate: row.start_date,
      audience: row.audience,
      disciplines: row.disciplines ?? [],
      websiteUrl: row.website_url,
      registrationUrl: row.registration_url,
      level: row.level,
      placeName: loc?.name ?? null,
      municipality: loc?.municipality ?? null,
      countryCode: loc?.country_code ?? null,
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
      locationId: row.location_id,
      geocodeStatus: loc?.geocode_status ?? null,
      missing,
    });
  }

  // Prioritize map-breaking issues first
  const rank: Record<MissingFlag, number> = {
    coords: 0,
    place: 1,
    bad_place: 2,
    disciplines: 3,
    website: 4,
    registration: 5,
  };
  events.sort((a, b) => {
    const ra = Math.min(...a.missing.map((m) => rank[m]));
    const rb = Math.min(...b.missing.map((m) => rank[m]));
    if (ra !== rb) return ra - rb;
    return a.startDate.localeCompare(b.startDate);
  });

  return { summary, events: events.slice(0, limit) };
}

export const MISSING_LABELS: Record<MissingFlag, string> = {
  coords: "No map pin",
  place: "No place",
  bad_place: "Bad place",
  website: "No website",
  registration: "No registration",
  disciplines: "No discipline",
};

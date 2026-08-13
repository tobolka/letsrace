import { createServerSupabase } from "@/lib/supabase/server";
import {
  fingerprint,
  normalizeName,
  slugifyEvent,
  type Audience,
  type Discipline,
} from "@/lib/domain";
import { publicRaceUrl } from "@/lib/watcher/public-url";

export type EventListItem = {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string | null;
  disciplines: string[];
  audience: string;
  ageCategories: string[];
  status: string;
  websiteUrl: string | null;
  registrationUrl: string | null;
  sourceKind: string;
  level: string;
  classLabel: string | null;
  uciClass: string | null;
  location: {
    id: string;
    name: string;
    municipality: string | null;
    countryCode: string;
    lat: number | null;
    lng: number | null;
  } | null;
  series: { id: string; name: string; slug: string } | null;
  categories?: {
    id: string;
    name: string;
    ageMin: number | null;
    ageMax: number | null;
    distanceKm: number | null;
    audience?: string | null;
  }[];
};

export type EventFilters = {
  q?: string;
  audience?: string[];
  disciplines?: string[];
  levels?: string[];
  ageCategories?: string[];
  seriesSlug?: string;
  dateFrom?: string;
  dateTo?: string;
  west?: number;
  south?: number;
  east?: number;
  north?: number;
  /** GeoJSON Polygon coordinates [lng,lat][] ring */
  polygon?: [number, number][];
};

export async function listEvents(filters: EventFilters = {}): Promise<EventListItem[]> {
  const supabase = createServerSupabase();
  const { expandDisciplineFilter } = await import("@/lib/taxonomy");
  let query = supabase
    .from("events")
    .select(
      `id, slug, name, start_date, end_date, disciplines, audience, age_categories, status, website_url, registration_url, source_kind, level, class_label, uci_class,
       location:locations(id, name, municipality, country_code, lat, lng),
       series:series(id, name, slug),
       categories:event_categories(id, name, age_min, age_max, distance_km, audience)`,
    )
    .order("start_date", { ascending: true })
    .limit(300);

  if (filters.dateFrom) query = query.gte("start_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("start_date", filters.dateTo);
  if (filters.audience?.length === 1) {
    query = query.eq("audience", filters.audience[0]);
  } else if (filters.audience && filters.audience.length > 1) {
    query = query.in("audience", filters.audience);
  }
  if (filters.disciplines?.length) {
    query = query.overlaps("disciplines", expandDisciplineFilter(filters.disciplines));
  }
  if (filters.levels?.length) {
    query = query.in("level", filters.levels);
  }
  if (filters.ageCategories?.length) {
    query = query.overlaps("age_categories", filters.ageCategories);
  }
  if (filters.seriesSlug) {
    const { data: series } = await supabase
      .from("series")
      .select("id")
      .eq("slug", filters.seriesSlug)
      .maybeSingle();
    if (series?.id) {
      query = query.eq("series_id", series.id);
    } else {
      return [];
    }
  }
  if (filters.q) {
    query = query.ilike("name", `%${filters.q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []).map(mapEventRow);

  if (
    filters.west != null &&
    filters.south != null &&
    filters.east != null &&
    filters.north != null
  ) {
    rows = rows.filter((e) => {
      const lat = e.location?.lat;
      const lng = e.location?.lng;
      if (lat == null || lng == null) return false;
      return (
        lng >= filters.west! &&
        lng <= filters.east! &&
        lat >= filters.south! &&
        lat <= filters.north!
      );
    });
  }

  if (filters.polygon && filters.polygon.length >= 3) {
    const { booleanPointInPolygon } = await import("@turf/boolean-point-in-polygon");
    const { polygon, point } = await import("@turf/helpers");
    const ring = [...filters.polygon];
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push(ring[0]);
    }
    const poly = polygon([ring]);
    rows = rows.filter((e) => {
      if (e.location?.lat == null || e.location?.lng == null) return false;
      return booleanPointInPolygon(point([e.location.lng, e.location.lat]), poly);
    });
  }

  return rows;
}

export async function listSeries(): Promise<{ id: string; name: string; slug: string; eventCount: number }[]> {
  const supabase = createServerSupabase();
  const { data: series, error } = await supabase
    .from("series")
    .select("id, name, slug")
    .order("name");
  if (error) throw new Error(error.message);
  const { data: counts } = await supabase.from("events").select("series_id").not("series_id", "is", null);
  const tally = new Map<string, number>();
  for (const row of counts ?? []) {
    const id = row.series_id as string;
    tally.set(id, (tally.get(id) ?? 0) + 1);
  }
  return (series ?? [])
    .map((s) => ({
      id: s.id as string,
      name: s.name as string,
      slug: s.slug as string,
      eventCount: tally.get(s.id as string) ?? 0,
    }))
    .filter((s) => s.eventCount > 0);
}

export async function getEventById(id: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("events")
    .select(
      `*, location:locations(*), series:series(*), categories:event_categories(*),
       overrides:event_overrides(*), sources:event_sources(*)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getEventBySlug(slug: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("events")
    .select(
      `*, location:locations(*), series:series(*), categories:event_categories(*),
       overrides:event_overrides(*), sources:event_sources(*)`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function mapEventRow(row: Record<string, unknown>): EventListItem {
  const location = row.location as Record<string, unknown> | null;
  const series = row.series as Record<string, unknown> | null;
  const categories = row.categories as Record<string, unknown>[] | null;
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : null,
    disciplines: (row.disciplines as string[]) ?? [],
    audience: String(row.audience),
    ageCategories: (row.age_categories as string[]) ?? [],
    status: String(row.status),
    websiteUrl: publicRaceUrl(row.website_url as string | null),
    registrationUrl: publicRaceUrl(row.registration_url as string | null),
    sourceKind: String(row.source_kind ?? "scraped"),
    level: String(row.level ?? "local"),
    classLabel: (row.class_label as string) ?? null,
    uciClass: (row.uci_class as string) ?? null,
    location: location
      ? {
          id: String(location.id),
          name: String(location.name),
          municipality: (location.municipality as string) ?? null,
          countryCode: String(location.country_code),
          lat: (location.lat as number) ?? null,
          lng: (location.lng as number) ?? null,
        }
      : null,
    series: series
      ? {
          id: String(series.id),
          name: String(series.name),
          slug: String(series.slug),
        }
      : null,
    categories: (categories ?? []).map((c) => ({
      id: String(c.id),
      name: String(c.name),
      ageMin: (c.age_min as number) ?? null,
      ageMax: (c.age_max as number) ?? null,
      distanceKm: (c.distance_km as number) ?? null,
      audience: (c.audience as string) ?? null,
    })),
  };
}

export type ManualEventInput = {
  name: string;
  startDate: string;
  endDate?: string;
  placeName: string;
  municipality?: string;
  countryCode: string;
  lat?: number;
  lng?: number;
  disciplines?: Discipline[];
  audience?: Audience;
  websiteUrl?: string;
  registrationUrl?: string;
  status?: string;
  notes?: string;
  categories?: { name: string; distanceKm?: number; ageMin?: number; ageMax?: number }[];
  lockFields?: boolean;
};

export async function upsertManualEvent(input: ManualEventInput, eventId?: string) {
  const supabase = createServerSupabase();
  const fp = fingerprint({
    startDate: input.startDate,
    name: input.name,
    lat: input.lat,
    lng: input.lng,
  });
  const slug = slugifyEvent(input.name, input.startDate);

  let locationId: string | null = null;
  if (input.placeName) {
    const locPayload: Record<string, unknown> = {
      name: input.placeName,
      municipality: input.municipality ?? input.placeName,
      country_code: input.countryCode,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      geocode_status: input.lat != null && input.lng != null ? "ok" : "pending",
      geocode_query: `${input.placeName}, ${input.countryCode}`,
      updated_at: new Date().toISOString(),
    };
    if (input.lat != null && input.lng != null) {
      // geog set via raw SQL if needed; lat/lng enough for map MVP
    }
    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .insert(locPayload)
      .select("id")
      .single();
    if (locErr) throw new Error(locErr.message);
    locationId = loc.id;
    if (input.lat != null && input.lng != null) {
      await supabase.rpc("set_location_geog", {
        loc_id: locationId,
        lng: input.lng,
        lat: input.lat,
      }).maybeSingle();
    }
  }

  const eventPayload = {
    slug: eventId ? undefined : slug,
    name: input.name,
    name_normalized: normalizeName(input.name),
    location_id: locationId,
    start_date: input.startDate,
    end_date: input.endDate ?? input.startDate,
    disciplines: input.disciplines ?? [],
    audience: input.audience ?? "mixed",
    status: input.status ?? "scheduled",
    website_url: input.websiteUrl ?? null,
    registration_url: input.registrationUrl ?? null,
    fingerprint: fp,
    source_kind: "manual",
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };

  let id = eventId;
  if (eventId) {
    const { error } = await supabase.from("events").update(eventPayload).eq("id", eventId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...eventPayload, slug })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
  }

  if (input.categories?.length && id) {
    await supabase.from("event_categories").delete().eq("event_id", id);
    await supabase.from("event_categories").insert(
      input.categories.map((c) => ({
        event_id: id,
        name: c.name,
        distance_km: c.distanceKm ?? null,
        age_min: c.ageMin ?? null,
        age_max: c.ageMax ?? null,
        audience: input.audience ?? null,
      })),
    );
  }

  if (input.lockFields && id) {
    await supabase.from("event_overrides").upsert(
      {
        event_id: id,
        fields: {
          name: input.name,
          start_date: input.startDate,
          website_url: input.websiteUrl,
          audience: input.audience,
          disciplines: input.disciplines,
        },
        locked_fields: [
          "name",
          "start_date",
          "website_url",
          "audience",
          "disciplines",
          "location_id",
        ],
        updated_by: "admin",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    );
  }

  if (input.websiteUrl) {
    await supabase.from("watched_urls").upsert(
      {
        url: input.websiteUrl,
        kind: "race",
        status: "active",
        added_by: "manual-event",
        next_poll_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "url" },
    );
  }

  return id!;
}

export async function updateEventFields(
  eventId: string,
  fields: Partial<{
    name: string;
    startDate: string;
    endDate: string;
    audience: string;
    disciplines: string[];
    websiteUrl: string;
    registrationUrl: string;
    status: string;
  }>,
  lock = true,
) {
  const supabase = createServerSupabase();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name != null) {
    payload.name = fields.name;
    payload.name_normalized = normalizeName(fields.name);
  }
  if (fields.startDate != null) payload.start_date = fields.startDate;
  if (fields.endDate != null) payload.end_date = fields.endDate;
  if (fields.audience != null) payload.audience = fields.audience;
  if (fields.disciplines != null) payload.disciplines = fields.disciplines;
  if (fields.websiteUrl != null) payload.website_url = fields.websiteUrl;
  if (fields.registrationUrl != null) payload.registration_url = fields.registrationUrl;
  if (fields.status != null) payload.status = fields.status;

  const { error } = await supabase.from("events").update(payload).eq("id", eventId);
  if (error) throw new Error(error.message);

  if (lock) {
    await supabase.from("event_overrides").upsert(
      {
        event_id: eventId,
        fields: payload,
        locked_fields: Object.keys(payload).filter((k) => k !== "updated_at"),
        updated_by: "admin",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    );
  }
}

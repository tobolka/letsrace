import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  fingerprint,
  normalizeName,
  slugifyEvent,
  type Audience,
  type Discipline,
} from "@/lib/domain";
import { publicRaceUrl, resolveEventOutboundUrls } from "@/lib/watcher/public-url";
import { canonicalEventDisciplines } from "@/lib/taxonomy";

export type EventListItem = {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string | null;
  disciplines: string[];
  formats: string[];
  audience: string;
  ageCategories: string[];
  status: string;
  visibility: string;
  eventType: string;
  competitionType: string;
  season: string | null;
  websiteUrl: string | null;
  registrationUrl: string | null;
  regulationsUrl: string | null;
  listingUrl: string | null;
  sourceKind: string;
  level: string;
  classLabel: string | null;
  uciClass: string | null;
  lastSeenAt: string | null;
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
  countryCodes?: string[];
  season?: string;
  eventTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
  west?: number;
  south?: number;
  east?: number;
  north?: number;
  /** GeoJSON Polygon coordinates [lng,lat][] ring */
  polygon?: [number, number][];
};

const EVENT_LIST_COLUMNS = `id, slug, name, start_date, end_date, disciplines, formats, audience, age_categories, status, visibility, event_type, competition_type, season, website_url, registration_url, regulations_url, source_kind, level, class_label, uci_class, last_seen_at, updated_at`;

export async function listEvents(filters: EventFilters = {}): Promise<EventListItem[]> {
  const supabase = createServerSupabase();
  const { expandDisciplineFilter, matchesDisciplineFilter } = await import("@/lib/taxonomy");
  const { PUBLIC_COUNTRY_CODES, isListedCountry } = await import("@/lib/geo/europe");

  const hasBbox =
    filters.west != null &&
    filters.south != null &&
    filters.east != null &&
    filters.north != null;
  const bySeries = Boolean(filters.seriesSlug);
  const byCountry = Boolean(filters.countryCodes?.length);
  // Without bbox, unfiltered Europe is huge — keep a higher cap but prefer bbox queries.
  const limit = bySeries ? 400 : hasBbox || byCountry ? 1200 : 800;
  const locationSelect = bySeries
    ? "location:locations(id, name, municipality, country_code, lat, lng)"
    : "location:locations!inner(id, name, municipality, country_code, lat, lng)";

  let query = supabase
    .from("events")
    .select(
      `${EVENT_LIST_COLUMNS},
       ${locationSelect},
       series:series(id, name, slug, visibility, website_url, age_categories),
       sources:event_sources(source_url)`,
    )
    .order("start_date", { ascending: true })
    .limit(limit);

  if (!bySeries) {
    query = query.in("location.country_code", [...PUBLIC_COUNTRY_CODES]);
  }

  // Apply map viewport in SQL *before* the limit so off-map races can't starve the list
  if (hasBbox) {
    query = query
      .gte("location.lat", filters.south!)
      .lte("location.lat", filters.north!)
      .gte("location.lng", filters.west!)
      .lte("location.lng", filters.east!)
      .not("location.lat", "is", null)
      .not("location.lng", "is", null);
  }

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
    const { expandAgeCategoryFilter } = await import("@/lib/taxonomy");
    const expanded = expandAgeCategoryFilter(filters.ageCategories);
    if (!filters.q) {
      const parts = [`age_categories.ov.{${expanded.join(",")}}`];
      if (filters.ageCategories.includes("kids")) parts.push("audience.eq.kids");
      if (filters.ageCategories.includes("youth")) parts.push("audience.eq.youth");
      query = parts.length > 1 ? query.or(parts.join(",")) : query.overlaps("age_categories", expanded);
    }
  }
  if (filters.seriesSlug) {
    const { data: series } = await supabase
      .from("series")
      .select("id, visibility")
      .eq("slug", filters.seriesSlug)
      .maybeSingle();
    if (series?.id && series.visibility !== "hidden") {
      query = query.eq("series_id", series.id);
    } else {
      return [];
    }
  }
  if (filters.countryCodes?.length) {
    const allowed = filters.countryCodes.filter((c) => isListedCountry(c));
    if (!allowed.length) return [];
    query = query.in("location.country_code", allowed);
  }
  if (filters.season) {
    query = query.eq("season", filters.season);
  }
  if (filters.eventTypes?.length) {
    query = query.in("event_type", filters.eventTypes);
  }
  if (filters.q) {
    const q = filters.q.trim().replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim();
    if (q) {
      const { data: seriesHits } = await supabase
        .from("series")
        .select("id")
        .eq("visibility", "public")
        .ilike("name", `%${q}%`);
      const seriesIds = (seriesHits ?? []).map((s) => s.id as string);
      if (seriesIds.length) {
        query = query.or(`name.ilike.%${q}%,series_id.in.(${seriesIds.join(",")})`);
      } else {
        query = query.ilike("name", `%${q}%`);
      }
    }
  }

  // Public explore: races only (hide camps, cancelled, manually hidden)
  const {
    PUBLIC_EVENT_STATUSES,
    PUBLIC_VISIBILITY,
    shouldHideFromMap,
    isPublicMapWorthy,
  } = await import("@/lib/event-visibility");
  query = query.in("status", [...PUBLIC_EVENT_STATUSES]).eq("visibility", PUBLIC_VISIBILITY);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? [])
    .map(mapEventRow)
    .filter((e) => {
      if (shouldHideFromMap(e.name, e.status, e.visibility)) return false;
      if (!bySeries && !isPublicMapWorthy(e)) return false;
      if (!e.location?.countryCode) return bySeries;
      return isListedCountry(e.location.countryCode);
    });

  if (filters.ageCategories?.length) {
    const { matchesAgeCategoryFilter } = await import("@/lib/taxonomy");
    rows = rows.filter((e) => matchesAgeCategoryFilter(e, filters.ageCategories!));
  }

  if (filters.disciplines?.length) {
    rows = rows.filter((e) => matchesDisciplineFilter(e.disciplines, filters.disciplines!));
  }

  if (
    filters.west != null &&
    filters.south != null &&
    filters.east != null &&
    filters.north != null
  ) {
    // Keep as safety net if nested PostgREST geo filters are ignored
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

export type SeriesListItem = {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
  description: string | null;
  websiteUrl: string | null;
  countryCode: string | null;
  disciplines: string[];
  ageCategories: string[];
  seriesType: string;
  level: string;
  competitionType: string;
  season: string | null;
  eventCount: number;
};

function mapSeriesRow(row: Record<string, unknown>, eventCount = 0): SeriesListItem {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    shortName: (row.short_name as string) ?? null,
    description: (row.description as string) ?? null,
    websiteUrl: publicRaceUrl(row.website_url as string | null),
    countryCode: (row.country_code as string) ?? null,
    disciplines: (row.disciplines as string[]) ?? [],
    ageCategories: (row.age_categories as string[]) ?? [],
    seriesType: String(row.series_type ?? "other"),
    level: String(row.level ?? "local"),
    competitionType: String(row.competition_type ?? "other"),
    season: row.season ? String(row.season) : null,
    eventCount,
  };
}

const SERIES_PUBLIC_COLUMNS =
  "id, name, slug, short_name, description, website_url, country_code, disciplines, age_categories, series_type, level, competition_type, season";

export async function listSeries(filters: EventFilters = {}): Promise<SeriesListItem[]> {
  const supabase = createServerSupabase();
  const { PUBLIC_EVENT_STATUSES, PUBLIC_VISIBILITY } = await import("@/lib/event-visibility");
  const { expandDisciplineFilter, expandAgeCategoryFilter, matchesAgeCategoryFilter, matchesDisciplineFilter } =
    await import("@/lib/taxonomy");
  const { isListedCountry } = await import("@/lib/geo/europe");

  const { data: series, error } = await supabase
    .from("series")
    .select(SERIES_PUBLIC_COLUMNS)
    .eq("visibility", "public")
    .order("name");
  if (error) throw new Error(error.message);

  let query = supabase
    .from("events")
    .select("series_id, audience, age_categories, disciplines")
    .not("series_id", "is", null)
    .eq("visibility", PUBLIC_VISIBILITY)
    .in("status", [...PUBLIC_EVENT_STATUSES])
    .limit(20_000);

  if (filters.dateFrom) query = query.gte("start_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("start_date", filters.dateTo);
  if (filters.disciplines?.length) {
    query = query.overlaps("disciplines", expandDisciplineFilter(filters.disciplines));
  }
  if (filters.levels?.length) {
    query = query.in("level", filters.levels);
  }
  if (filters.ageCategories?.length) {
    const expanded = expandAgeCategoryFilter(filters.ageCategories);
    const parts = [`age_categories.ov.{${expanded.join(",")}}`];
    if (filters.ageCategories.includes("kids")) parts.push("audience.eq.kids");
    if (filters.ageCategories.includes("youth")) parts.push("audience.eq.youth");
    query =
      parts.length > 1 ? query.or(parts.join(",")) : query.overlaps("age_categories", expanded);
  }

  const { data: counts } = await query;
  const tally = new Map<string, number>();
  for (const row of counts ?? []) {
    if (
      filters.disciplines?.length &&
      !matchesDisciplineFilter((row.disciplines as string[]) ?? [], filters.disciplines)
    ) {
      continue;
    }
    if (
      filters.ageCategories?.length &&
      !matchesAgeCategoryFilter(
        {
          audience: row.audience as string,
          ageCategories: (row.age_categories as string[]) ?? [],
        },
        filters.ageCategories,
      )
    ) {
      continue;
    }
    const id = row.series_id as string;
    tally.set(id, (tally.get(id) ?? 0) + 1);
  }
  return (series ?? [])
    .map((s) => mapSeriesRow(s as Record<string, unknown>, tally.get(s.id as string) ?? 0))
    .filter((s) => s.eventCount > 0)
    .filter((s) => !s.countryCode || isListedCountry(s.countryCode))
    .sort((a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name, "cs"));
}

export async function getSeriesBySlug(
  slug: string,
): Promise<{ series: SeriesListItem; events: EventListItem[] } | null> {
  const supabase = createServerSupabase();
  const { PUBLIC_COUNTRY_CODES } = await import("@/lib/geo/europe");
  const { data: row, error } = await supabase
    .from("series")
    .select(SERIES_PUBLIC_COLUMNS)
    .eq("slug", slug)
    .eq("visibility", "public")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const { data: eventRows, error: eventError } = await supabase
    .from("events")
    .select(
      `${EVENT_LIST_COLUMNS},
       location:locations!inner(id, name, municipality, country_code, lat, lng),
       series:series(id, name, slug, visibility, website_url, age_categories),
       sources:event_sources(source_url)`,
    )
    .eq("series_id", row.id)
    .eq("visibility", "public")
    .in("location.country_code", [...PUBLIC_COUNTRY_CODES])
    .order("start_date", { ascending: true })
    .limit(200);
  if (eventError) throw new Error(eventError.message);

  const events = (eventRows ?? []).map((e) => mapEventRow(e as Record<string, unknown>));
  return {
    series: mapSeriesRow(row as Record<string, unknown>, events.length),
    events,
  };
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

/** Public race by slug for SEO pages and deep links. */
export const getPublicEventBySlug = cache(async function getPublicEventBySlug(
  slug: string,
): Promise<EventListItem | null> {
  const supabase = createServerSupabase();
  const { PUBLIC_EVENT_STATUSES, PUBLIC_VISIBILITY, shouldHideFromMap } = await import(
    "@/lib/event-visibility"
  );
  const { data, error } = await supabase
    .from("events")
    .select(
      `${EVENT_LIST_COLUMNS},
       location:locations(id, name, municipality, country_code, lat, lng),
       series:series(id, name, slug, visibility, website_url, age_categories),
       sources:event_sources(source_url)`,
    )
    .eq("slug", slug)
    .eq("visibility", PUBLIC_VISIBILITY)
    .in("status", [...PUBLIC_EVENT_STATUSES])
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const event = mapEventRow(data as Record<string, unknown>);
  if (shouldHideFromMap(event.name, event.status, event.visibility)) return null;
  const { isListedCountry } = await import("@/lib/geo/europe");
  const cc = event.location?.countryCode;
  if (cc && !isListedCountry(cc)) return null;
  return event;
});

/** Upcoming public races for sitemap (capped). */
export async function listSitemapEvents(limit = 4000): Promise<
  { slug: string; startDate: string; updatedAt: string | null }[]
> {
  const supabase = createServerSupabase();
  const { PUBLIC_EVENT_STATUSES, PUBLIC_VISIBILITY, isPublicMapWorthy } =
    await import("@/lib/event-visibility");
  const { isListedCountry } = await import("@/lib/geo/europe");
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("events")
    .select(
      "slug, start_date, updated_at, website_url, registration_url, location:locations(country_code)",
    )
    .eq("visibility", PUBLIC_VISIBILITY)
    .in("status", [...PUBLIC_EVENT_STATUSES])
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((row) => {
      const loc = row.location as { country_code?: string } | { country_code?: string }[] | null;
      const countryCode = Array.isArray(loc) ? loc[0]?.country_code : loc?.country_code;
      if (countryCode && !isListedCountry(countryCode)) return false;
      return isPublicMapWorthy({
        websiteUrl: row.website_url as string | null,
        registrationUrl: row.registration_url as string | null,
        location: countryCode ? { countryCode } : null,
      });
    })
    .map((row) => ({
      slug: String(row.slug),
      startDate: String(row.start_date),
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    }));
}

function sourceUrlsFromRow(row: Record<string, unknown>): string[] {
  const sources = row.sources as { source_url?: string | null }[] | null;
  if (!sources?.length) return [];
  return sources.map((s) => s.source_url).filter((u): u is string => Boolean(u));
}

function mapEventRow(row: Record<string, unknown>): EventListItem {
  const location = row.location as Record<string, unknown> | null;
  const series = row.series as Record<string, unknown> | null;
  const categories = row.categories as Record<string, unknown>[] | null;
  const outbound = resolveEventOutboundUrls({
    websiteUrl: row.website_url as string | null,
    registrationUrl: row.registration_url as string | null,
    regulationsUrl: row.regulations_url as string | null,
    seriesWebsiteUrl: series?.website_url as string | null,
    sourceUrls: sourceUrlsFromRow(row),
  });
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : null,
    disciplines: canonicalEventDisciplines((row.disciplines as string[]) ?? []),
    formats: (row.formats as string[]) ?? [],
    audience: String(row.audience),
    ageCategories: (() => {
      const own = (row.age_categories as string[]) ?? [];
      if (own.length) return own;
      return (series?.age_categories as string[]) ?? [];
    })(),
    status: String(row.status),
    visibility: String(row.visibility ?? "public"),
    eventType: String(row.event_type ?? "race"),
    competitionType: String(row.competition_type ?? "other"),
    season: row.season ? String(row.season) : null,
    websiteUrl: outbound.websiteUrl,
    registrationUrl: outbound.registrationUrl,
    regulationsUrl: outbound.regulationsUrl,
    listingUrl: outbound.listingUrl,
    sourceKind: String(row.source_kind ?? "scraped"),
    level: String(row.level ?? "local"),
    classLabel: (row.class_label as string) ?? null,
    uciClass: (row.uci_class as string) ?? null,
    lastSeenAt: row.last_seen_at
      ? String(row.last_seen_at)
      : row.updated_at
        ? String(row.updated_at)
        : null,
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
    series:
      series && String(series.visibility ?? "public") !== "hidden"
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
  regulationsUrl?: string;
  status?: string;
  visibility?: string;
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
    status: input.status === "hidden" ? "scheduled" : (input.status ?? "scheduled"),
    visibility: input.visibility ?? (input.status === "hidden" ? "hidden" : "public"),
    website_url: input.websiteUrl ?? null,
    registration_url: input.registrationUrl ?? null,
    regulations_url: input.regulationsUrl ?? null,
    fingerprint: fp,
    source_kind: "manual",
    season: input.startDate.slice(0, 4),
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
    regulationsUrl: string;
    status: string;
    visibility: string;
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
  if (fields.regulationsUrl != null) payload.regulations_url = fields.regulationsUrl;
  if (fields.visibility != null) payload.visibility = fields.visibility;
  if (fields.status != null) {
    // Legacy admin "hidden" status → visibility split
    if (fields.status === "hidden") {
      payload.visibility = "hidden";
      payload.status = "scheduled";
    } else {
      payload.status = fields.status;
      if (fields.visibility == null && fields.status !== "cancelled") {
        payload.visibility = "public";
      }
    }
  }

  const { error } = await supabase.from("events").update(payload).eq("id", eventId);
  if (error) throw new Error(error.message);

  if (lock) {
    const { data: existing } = await supabase
      .from("event_overrides")
      .select("locked_fields, fields")
      .eq("event_id", eventId)
      .maybeSingle();
    const prevLocked = (existing?.locked_fields as string[] | null) ?? [];
    const nextKeys = Object.keys(payload).filter((k) => k !== "updated_at");
    const locked = [...new Set([...prevLocked, ...nextKeys])];
    const prevFields =
      existing?.fields && typeof existing.fields === "object"
        ? (existing.fields as Record<string, unknown>)
        : {};
    await supabase.from("event_overrides").upsert(
      {
        event_id: eventId,
        fields: { ...prevFields, ...payload },
        locked_fields: locked,
        updated_by: "admin",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    );
  }
}

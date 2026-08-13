import { createServerSupabase } from "@/lib/supabase/server";
import {
  fingerprint,
  normalizeName,
  slugifyEvent,
  type ParsedEvent,
} from "@/lib/domain";
import { extractEvents, fetchPage, nextPollAt } from "@/lib/watcher/core";

export type WatchOutcome = {
  watchedUrlId: string;
  url: string;
  ok: boolean;
  unchanged?: boolean;
  eventsUpserted: number;
  linksDiscovered: number;
  strategy?: string;
  error?: string;
  httpStatus?: number;
  preview?: ParsedEvent[];
};

export async function runDueWatches(limit = 8): Promise<WatchOutcome[]> {
  const supabase = createServerSupabase();
  const { data: due, error } = await supabase
    .from("watched_urls")
    .select("*")
    .eq("status", "active")
    .lte("next_poll_at", new Date().toISOString())
    .order("next_poll_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  const outcomes: WatchOutcome[] = [];
  for (const row of due ?? []) {
    outcomes.push(await watchOne(row));
    // polite delay between domains
    await new Promise((r) => setTimeout(r, 1500));
  }
  return outcomes;
}

export async function watchOne(row: {
  id: string;
  url: string;
  etag?: string | null;
  last_modified?: string | null;
  content_hash?: string | null;
  kind?: string;
}): Promise<WatchOutcome> {
  const supabase = createServerSupabase();
  const runInsert = await supabase
    .from("ingest_runs")
    .insert({ watched_url_id: row.id })
    .select("id")
    .single();

  try {
    const fetched = await fetchPage(row.url, {
      etag: row.etag,
      lastModified: row.last_modified,
      contentHash: row.content_hash,
    });

    if (fetched.status === 404) {
      await supabase
        .from("watched_urls")
        .update({
          status: "dead",
          http_status: 404,
          last_fetched_at: new Date().toISOString(),
          last_error: "HTTP 404",
          last_extract_status: "dead",
          next_poll_at: nextPollAt().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await finishRun(runInsert.data?.id, {
        ok: false,
        error: "404",
        httpStatus: 404,
      });
      return {
        watchedUrlId: row.id,
        url: row.url,
        ok: false,
        eventsUpserted: 0,
        linksDiscovered: 0,
        error: "404",
        httpStatus: 404,
      };
    }

    if (fetched.unchanged || fetched.status === 304) {
      await supabase
        .from("watched_urls")
        .update({
          last_fetched_at: new Date().toISOString(),
          http_status: fetched.status,
          next_poll_at: nextPollAt().toISOString(),
          last_extract_status: "unchanged",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await finishRun(runInsert.data?.id, { ok: true, httpStatus: fetched.status });
      return {
        watchedUrlId: row.id,
        url: row.url,
        ok: true,
        unchanged: true,
        eventsUpserted: 0,
        linksDiscovered: 0,
        httpStatus: fetched.status,
      };
    }

    if (fetched.status >= 400) {
      throw new Error(`HTTP ${fetched.status}`);
    }

    const extracted = await extractEvents(row.url, fetched.html);
    // Skip already-linked external IDs so large aggregators can finish across polls
    const { data: knownRows } = await supabase
      .from("event_sources")
      .select("external_id")
      .eq("watched_url_id", row.id)
      .not("external_id", "is", null);
    const known = new Set(
      (knownRows ?? []).map((r) => r.external_id).filter((id): id is string => Boolean(id)),
    );
    const MAX_NEW_PER_RUN = 280;
    const fresh = extracted.events
      .filter((ev) => ev.confidence >= 0.35 && (!ev.externalId || !known.has(ev.externalId)))
      .slice(0, MAX_NEW_PER_RUN);

    let upserted = 0;
    for (const ev of fresh) {
      const id = await upsertParsedEvent(ev, row.id);
      if (id) upserted += 1;
    }

    let linksDiscovered = 0;
    for (const child of extracted.childUrls) {
      const sameHost = new URL(child).hostname === new URL(row.url).hostname;
      const isSeriesPage =
        child.includes("serialosss=") ||
        /\/cup\//i.test(child) ||
        /\/serie/i.test(child);
      if (sameHost && (row.kind === "series" || row.kind === "federation" || row.kind === "aggregator")) {
        const { error } = await supabase.from("watched_urls").upsert(
          {
            url: child,
            kind: isSeriesPage ? "series" : "race",
            parent_id: row.id,
            status: "active",
            added_by: "auto-same-domain",
            notes: isSeriesPage ? "Series page discovered from calendar" : null,
            next_poll_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "url", ignoreDuplicates: true },
        );
        if (!error) linksDiscovered += 1;
      } else {
        const { error } = await supabase.from("discovered_links").upsert(
          {
            url: child,
            from_watched_url_id: row.id,
            status: "pending",
            hint_kind: "race",
          },
          { onConflict: "url", ignoreDuplicates: true },
        );
        if (!error) linksDiscovered += 1;
      }
    }

    const needsReview = extracted.events.length === 0 || extracted.confidence < 0.4;
    await supabase
      .from("watched_urls")
      .update({
        content_hash: fetched.hash,
        etag: fetched.etag,
        last_modified: fetched.lastModified,
        http_status: fetched.status,
        last_fetched_at: new Date().toISOString(),
        last_changed_at: new Date().toISOString(),
        last_error: needsReview ? "low confidence or empty extract" : null,
        last_extract_status: needsReview ? "needs_review" : "ok",
        status: needsReview ? "needs_review" : "active",
        next_poll_at: nextPollAt(extracted.events[0]?.startDate).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (extracted.strategy.startsWith("adapter") || extracted.strategy === "jsonld") {
      const host = new URL(row.url).hostname.replace(/^www\./, "");
      await supabase.from("extraction_profiles").insert({
        host,
        strategy: extracted.strategy,
        recipe: { source: extracted.strategy },
        success_count: 1,
        last_success_at: new Date().toISOString(),
      });
    }

    await finishRun(runInsert.data?.id, {
      ok: true,
      eventsUpserted: upserted,
      linksDiscovered,
      strategy: extracted.strategy,
      httpStatus: fetched.status,
    });

    return {
      watchedUrlId: row.id,
      url: row.url,
      ok: true,
      eventsUpserted: upserted,
      linksDiscovered,
      strategy: extracted.strategy,
      httpStatus: fetched.status,
      preview: extracted.events.slice(0, 5),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    await supabase
      .from("watched_urls")
      .update({
        last_error: message,
        last_extract_status: "error",
        last_fetched_at: new Date().toISOString(),
        next_poll_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    await finishRun(runInsert.data?.id, { ok: false, error: message });
    return {
      watchedUrlId: row.id,
      url: row.url,
      ok: false,
      eventsUpserted: 0,
      linksDiscovered: 0,
      error: message,
    };
  }
}

async function finishRun(
  id: string | undefined,
  opts: {
    ok: boolean;
    error?: string;
    eventsUpserted?: number;
    linksDiscovered?: number;
    strategy?: string;
    httpStatus?: number;
  },
) {
  if (!id) return;
  const supabase = createServerSupabase();
  await supabase
    .from("ingest_runs")
    .update({
      finished_at: new Date().toISOString(),
      ok: opts.ok,
      error: opts.error ?? null,
      events_upserted: opts.eventsUpserted ?? 0,
      links_discovered: opts.linksDiscovered ?? 0,
      strategy: opts.strategy ?? null,
      http_status: opts.httpStatus ?? null,
    })
    .eq("id", id);
}

async function upsertParsedEvent(ev: ParsedEvent, watchedUrlId: string) {
  const supabase = createServerSupabase();
  const fp = fingerprint({
    startDate: ev.startDate,
    name: ev.name,
    lat: ev.lat,
    lng: ev.lng,
  });
  const { inferClassification } = await import("@/lib/taxonomy");
  const { isLikelyDuplicate } = await import("@/lib/dedup");
  const { publicRaceUrl } = await import("@/lib/watcher/public-url");
  const classified = inferClassification({
    name: ev.name,
    placeText: ev.placeText,
    disciplines: ev.discipline,
    categoryNames: (ev.categories ?? []).map((c) => c.name),
  });
  const levelInfo = {
    level: classified.level,
    classLabel: classified.classLabel,
    uciClass: classified.uciClass,
  };
  const disciplines = classified.disciplines.length
    ? classified.disciplines
    : ev.discipline ?? [];
  const audience = classified.ageCategories.length
    ? classified.audience
    : ev.audience ?? "mixed";
  const ageCategories = classified.ageCategories;

  // 1) exact fingerprint
  let existingId: string | undefined;
  const { data: byFp } = await supabase
    .from("events")
    .select("id, name, start_date, fingerprint, location:locations(lat, lng), overrides:event_overrides(locked_fields)")
    .eq("fingerprint", fp)
    .maybeSingle();
  existingId = byFp?.id;

  // 2) soft dedup: same day + similar name / nearby
  if (!existingId) {
    const { data: sameDay } = await supabase
      .from("events")
      .select("id, name, start_date, fingerprint, location:locations(lat, lng)")
      .eq("start_date", ev.startDate)
      .limit(80);
    for (const row of sameDay ?? []) {
      const loc = row.location as { lat?: number; lng?: number } | null;
      if (
        isLikelyDuplicate(
          {
            startDate: ev.startDate,
            name: ev.name,
            lat: ev.lat,
            lng: ev.lng,
            fingerprint: fp,
          },
          {
            startDate: row.start_date,
            name: row.name,
            lat: loc?.lat,
            lng: loc?.lng,
            fingerprint: row.fingerprint,
          },
        )
      ) {
        existingId = row.id;
        break;
      }
    }
  }

  const { data: existingFull } = existingId
    ? await supabase
        .from("events")
        .select("id, overrides:event_overrides(locked_fields)")
        .eq("id", existingId)
        .maybeSingle()
    : { data: byFp };

  const locked =
    (existingFull as { overrides?: { locked_fields?: string[] } | { locked_fields?: string[] }[] } | null)
      ?.overrides;
  const lockedFields = Array.isArray(locked)
    ? locked[0]?.locked_fields ?? []
    : locked?.locked_fields ?? [];

  let locationId: string | null = null;
  if (ev.placeText) {
    let lat = ev.lat ?? null;
    let lng = ev.lng ?? null;
    let country = ev.countryHint ?? "CZ";
    let geocodeStatus = lat != null ? "ok" : "pending";
    let geocodeQuery = ev.placeText;
    if (lat == null) {
      try {
        const { geocodeFromGazetteer, cleanGeocodeQuery } = await import("@/lib/geocode");
        const cleaned = cleanGeocodeQuery(ev.placeText, ev.countryHint);
        if (cleaned.query) geocodeQuery = cleaned.query;
        country = cleaned.countryCode || country;
        const geo = geocodeFromGazetteer(ev.placeText, ev.countryHint);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          country = geo.countryCode || cleaned.countryCode || country;
          geocodeStatus = "ok";
        }
      } catch {
        /* ignore */
      }
    }

    const { data: loc } = await supabase
      .from("locations")
      .insert({
        name: ev.placeText,
        municipality: geocodeQuery,
        country_code: country,
        lat,
        lng,
        geocode_query: geocodeQuery,
        geocode_status: geocodeStatus,
      })
      .select("id")
      .single();
    locationId = loc?.id ?? null;
    if (locationId && lat != null && lng != null) {
      await supabase.rpc("set_location_geog", {
        loc_id: locationId,
        lng,
        lat,
      });
    }
  }

  const website = publicRaceUrl(ev.websiteUrl, ev.sourceUrl);
  const registration = publicRaceUrl(ev.registrationUrl);

  const payload: Record<string, unknown> = {
    name: ev.name,
    name_normalized: normalizeName(ev.name),
    start_date: ev.startDate,
    end_date: ev.endDate ?? ev.startDate,
    disciplines,
    audience,
    age_categories: ageCategories,
    fingerprint: fp,
    source_kind: "scraped",
    level: levelInfo.level,
    class_label: levelInfo.classLabel ?? null,
    uci_class: levelInfo.uciClass ?? null,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Only write website/registration when we have a real race URL (never wipe with aggregator)
  if (website) payload.website_url = website;
  else if (!existingId) payload.website_url = null;
  if (registration) payload.registration_url = registration;
  else if (!existingId) payload.registration_url = null;

  if (!lockedFields.includes("location_id") && locationId) {
    payload.location_id = locationId;
  }

  // Attach / create series (Talent Cup, KPŽ, …)
  if (ev.seriesName || ev.seriesSlug) {
    const slug =
      ev.seriesSlug ||
      (ev.seriesName || "series")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);
    const { data: seriesRow } = await supabase
      .from("series")
      .upsert(
        {
          slug,
          name: ev.seriesName || slug,
          website: publicRaceUrl(ev.seriesWebsite),
          audience_hint: ev.audience || "mixed",
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (seriesRow?.id && !lockedFields.includes("series_id")) {
      payload.series_id = seriesRow.id;
    }
  }

  for (const key of lockedFields) {
    delete payload[key];
  }

  let eventId = existingId;
  if (eventId) {
    await supabase.from("events").update(payload).eq("id", eventId);
  } else {
    const slug = slugifyEvent(ev.name, ev.startDate);
    const { data, error } = await supabase
      .from("events")
      .insert({ ...payload, slug })
      .select("id")
      .single();
    if (error) {
      const { data: d2 } = await supabase
        .from("events")
        .insert({ ...payload, slug: `${slug}-${Date.now().toString(36)}` })
        .select("id")
        .single();
      eventId = d2?.id;
    } else {
      eventId = data.id;
    }
  }

  if (!eventId) return null;

  await supabase.from("event_sources").upsert(
    {
      event_id: eventId,
      watched_url_id: watchedUrlId,
      source_url: ev.sourceUrl,
      external_id: ev.externalId,
      is_canonical: true,
    },
    { onConflict: "watched_url_id,external_id" },
  );

  if (ev.categories?.length) {
    await supabase.from("event_categories").delete().eq("event_id", eventId);
    await supabase.from("event_categories").insert(
      ev.categories.map((c) => ({
        event_id: eventId,
        name: c.name,
        distance_km: c.distanceKm ?? null,
        age_min: c.ageMin ?? null,
        age_max: c.ageMax ?? null,
        audience: c.audience ?? ev.audience ?? null,
      })),
    );
  }

  return eventId;
}

export async function previewUrl(url: string) {
  const fetched = await fetchPage(url);
  if (fetched.status >= 400) {
    return { ok: false as const, error: `HTTP ${fetched.status}`, events: [] as ParsedEvent[] };
  }
  const extracted = await extractEvents(url, fetched.html);
  return {
    ok: true as const,
    strategy: extracted.strategy,
    confidence: extracted.confidence,
    events: extracted.events,
    childUrls: extracted.childUrls,
  };
}

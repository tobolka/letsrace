import { createServerSupabase } from "@/lib/supabase/server";
import {
  fingerprint,
  normalizeName,
  slugifyEvent,
  type ParsedEvent,
} from "@/lib/domain";
import {
  extractEvents,
  fetchPage,
  nextPollAt,
  errorPollAt,
  reviewPollAt,
} from "@/lib/watcher/core";
import { hostnameOf, mapPool } from "@/lib/watcher/pool";

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

const MAX_NEW_PER_RUN = 200;
const MAX_NEW_PER_RUN_FCI = 400;
const MAX_REFRESH_PER_RUN = 40;
/** Soft claim window so overlapping crons don't double-process the same row. */
const CLAIM_MS = 12 * 60 * 1000;
/** Stay under typical serverless caps. */
const DEFAULT_BUDGET_MS = 50_000;
const DEFAULT_CONCURRENCY = 3;

export async function runDueWatches(
  limit = 12,
  opts?: { concurrency?: number; budgetMs?: number },
): Promise<WatchOutcome[]> {
  const supabase = createServerSupabase();
  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("watched_urls")
    .select("*")
    .eq("status", "active")
    .lte("next_poll_at", nowIso)
    .order("next_poll_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  // Optimistic lease: push next_poll_at forward; only winners keep the claim
  const claimed: typeof due = [];
  const claimUntil = new Date(Date.now() + CLAIM_MS).toISOString();
  for (const row of due ?? []) {
    const { data: won } = await supabase
      .from("watched_urls")
      .update({
        next_poll_at: claimUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "active")
      .lte("next_poll_at", nowIso)
      .select("id")
      .maybeSingle();
    if (won?.id) claimed.push(row);
  }

  const deadline = Date.now() + (opts?.budgetMs ?? DEFAULT_BUDGET_MS);
  const concurrency = opts?.concurrency ?? DEFAULT_CONCURRENCY;
  const outcomes = await mapPool(claimed, concurrency, async (row) => {
    if (Date.now() > deadline) {
      // Release claim so another run can pick it up soon
      await supabase
        .from("watched_urls")
        .update({ next_poll_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", row.id);
      return {
        watchedUrlId: row.id,
        url: row.url,
        ok: false,
        eventsUpserted: 0,
        linksDiscovered: 0,
        error: "time budget exceeded",
      } satisfies WatchOutcome;
    }
    return watchOne(row);
  });

  return outcomes;
}

export async function watchOne(row: {
  id: string;
  url: string;
  etag?: string | null;
  last_modified?: string | null;
  content_hash?: string | null;
  kind?: string;
  last_extract_status?: string | null;
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
          last_error: null,
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
    const { data: knownRows } = await supabase
      .from("event_sources")
      .select("external_id")
      .eq("watched_url_id", row.id)
      .not("external_id", "is", null);
    const known = new Set(
      (knownRows ?? []).map((r) => r.external_id).filter((id): id is string => Boolean(id)),
    );

    const candidates = extracted.events.filter((ev) => ev.confidence >= 0.35);
    const maxNew =
      extracted.strategy?.includes("fci") || row.url.includes("federciclismo")
        ? MAX_NEW_PER_RUN_FCI
        : MAX_NEW_PER_RUN;
    const fresh = candidates
      .filter((ev) => !ev.externalId || !known.has(ev.externalId))
      .slice(0, maxNew);
    // When page changed, refresh a sample of known races so updates land
    const refresh = candidates
      .filter((ev) => ev.externalId && known.has(ev.externalId))
      .slice(0, MAX_REFRESH_PER_RUN);
    const toUpsert = dedupeByExternalId([...fresh, ...refresh]);

    let upserted = 0;
    // Bounded parallelism for DB upserts (same-host sources stay polite upstream)
    const upsertResults = await mapPool(toUpsert, 4, async (ev) => upsertParsedEvent(ev, row.id));
    upserted = upsertResults.filter(Boolean).length;

    let linksDiscovered = 0;
    for (const child of extracted.childUrls) {
      try {
        const sameHost = hostnameOf(child) === hostnameOf(row.url);
        const isSeriesPage =
          child.includes("serialosss=") ||
          /\/cup\//i.test(child) ||
          /\/serie/i.test(child);
        if (
          sameHost &&
          (row.kind === "series" || row.kind === "federation" || row.kind === "aggregator")
        ) {
          // FCI /race/detail and ical feeds are covered by the list crawl — don't enqueue them
          if (
            hostnameOf(child).includes("federciclismo.it") &&
            (/\/race\/detail\//i.test(child) || /\/race\/icald\//i.test(child))
          ) {
            continue;
          }
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
      } catch {
        /* ignore bad child URLs */
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
        // Stay active — retry later instead of permanent pause
        status: "active",
        next_poll_at: needsReview
          ? reviewPollAt().toISOString()
          : extracted.strategy?.includes("fci")
            ? // Rotate month windows every ~2h until season is filled
              new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
            : nextPollAt(extracted.events[0]?.startDate).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (extracted.strategy.startsWith("adapter") || extracted.strategy === "jsonld") {
      await bumpExtractionProfile(
        hostnameOf(row.url),
        extracted.strategy,
      );
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
    const priorFail = row.last_extract_status === "error" ? 2 : 1;
    await supabase
      .from("watched_urls")
      .update({
        last_error: message,
        last_extract_status: "error",
        last_fetched_at: new Date().toISOString(),
        next_poll_at: errorPollAt(priorFail).toISOString(),
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

function dedupeByExternalId(events: ParsedEvent[]): ParsedEvent[] {
  const seen = new Set<string>();
  const out: ParsedEvent[] = [];
  for (const ev of events) {
    const key = ev.externalId || `${ev.startDate}:${normalizeName(ev.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  return out;
}

async function bumpExtractionProfile(host: string, strategy: string) {
  const supabase = createServerSupabase();
  const { data: existing } = await supabase
    .from("extraction_profiles")
    .select("id, success_count")
    .eq("host", host)
    .eq("strategy", strategy)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    await supabase
      .from("extraction_profiles")
      .update({
        success_count: (existing.success_count ?? 0) + 1,
        last_success_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("extraction_profiles").insert({
      host,
      strategy,
      recipe: { source: strategy },
      success_count: 1,
      last_success_at: new Date().toISOString(),
    });
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
  const { isLikelyDuplicate, preferEventName, mergeDateSpan, preferLevel, normalizeUrlForDedup } =
    await import("@/lib/dedup");
  const { publicRaceUrl } = await import("@/lib/watcher/public-url");
  const classified = inferClassification({
    name: ev.name,
    placeText: ev.placeText,
    seriesName: ev.seriesName,
    seriesSlug: ev.seriesSlug,
    disciplines: ev.discipline,
    categoryNames: (ev.categories ?? []).map((c) => c.name),
    existingAudience: ev.audience,
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

  const incomingWebsite = publicRaceUrl(ev.websiteUrl, ev.sourceUrl);
  const incomingRegistration = publicRaceUrl(ev.registrationUrl);
  const incomingUrls = [incomingWebsite, incomingRegistration, ev.sourceUrl].filter(Boolean);

  // 1) exact fingerprint
  let existingId: string | undefined;
  const { data: byFp } = await supabase
    .from("events")
    .select(
      "id, name, start_date, end_date, fingerprint, website_url, registration_url, location:locations(lat, lng, name, municipality), overrides:event_overrides(locked_fields)",
    )
    .eq("fingerprint", fp)
    .maybeSingle();
  existingId = byFp?.id;

  // 1b) same specific website / race-detail URL (strong signal)
  if (!existingId) {
    const exactUrls = [incomingWebsite, incomingRegistration].filter(
      (u): u is string => Boolean(u && normalizeUrlForDedup(u)),
    );
    for (const url of exactUrls) {
      const { data: bySite } = await supabase
        .from("events")
        .select(
          "id, name, start_date, end_date, website_url, registration_url, location:locations(lat, lng, name, municipality)",
        )
        .eq("website_url", url)
        .limit(8);
      const { data: byReg } = await supabase
        .from("events")
        .select(
          "id, name, start_date, end_date, website_url, registration_url, location:locations(lat, lng, name, municipality)",
        )
        .eq("registration_url", url)
        .limit(8);
      for (const row of [...(bySite ?? []), ...(byReg ?? [])]) {
        const loc = row.location as {
          lat?: number;
          lng?: number;
          name?: string;
          municipality?: string;
        } | null;
        if (
          isLikelyDuplicate(
            {
              startDate: ev.startDate,
              endDate: ev.endDate ?? ev.startDate,
              name: ev.name,
              lat: ev.lat,
              lng: ev.lng,
              placeText: ev.placeText,
              urls: incomingUrls,
            },
            {
              startDate: row.start_date,
              endDate: row.end_date,
              name: row.name,
              lat: loc?.lat,
              lng: loc?.lng,
              placeText: loc?.municipality || loc?.name,
              urls: [row.website_url, row.registration_url],
            },
          )
        ) {
          existingId = row.id;
          break;
        }
      }
      if (existingId) break;
    }

    if (!existingId && ev.sourceUrl && normalizeUrlForDedup(ev.sourceUrl)) {
      const { data: bySrc } = await supabase
        .from("event_sources")
        .select(
          "event_id, source_url, event:events(id, name, start_date, end_date, website_url, registration_url, location:locations(lat, lng, name, municipality))",
        )
        .eq("source_url", ev.sourceUrl)
        .limit(5);
      for (const row of bySrc ?? []) {
        const rawEvent = row.event as unknown;
        const evRow = (Array.isArray(rawEvent) ? rawEvent[0] : rawEvent) as {
          id: string;
          name: string;
          start_date: string;
          end_date?: string;
          website_url?: string;
          registration_url?: string;
          location?: { lat?: number; lng?: number; name?: string; municipality?: string } | null;
        } | null;
        if (!evRow?.id) continue;
        if (
          isLikelyDuplicate(
            {
              startDate: ev.startDate,
              endDate: ev.endDate ?? ev.startDate,
              name: ev.name,
              lat: ev.lat,
              lng: ev.lng,
              placeText: ev.placeText,
              urls: incomingUrls,
            },
            {
              startDate: evRow.start_date,
              endDate: evRow.end_date,
              name: evRow.name,
              lat: evRow.location?.lat,
              lng: evRow.location?.lng,
              placeText: evRow.location?.municipality || evRow.location?.name,
              urls: [evRow.website_url, evRow.registration_url, row.source_url],
            },
          )
        ) {
          existingId = evRow.id;
          break;
        }
      }
    }
  }

  // 2) soft dedup: multi-signal (name + day/weekend + place + urls)
  if (!existingId) {
    const day = ev.startDate.slice(0, 10);
    const prev = new Date(`${day}T12:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const next = new Date(`${day}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const from = prev.toISOString().slice(0, 10);
    const to = next.toISOString().slice(0, 10);

    const { data: nearbyDays } = await supabase
      .from("events")
      .select(
        "id, name, start_date, end_date, fingerprint, status, website_url, registration_url, location:locations(lat, lng, name, municipality), sources:event_sources(source_url)",
      )
      .gte("start_date", from)
      .lte("start_date", to)
      .neq("status", "cancelled")
      .limit(120);

    for (const row of nearbyDays ?? []) {
      const loc = row.location as {
        lat?: number;
        lng?: number;
        name?: string;
        municipality?: string;
      } | null;
      const srcs = (row.sources as { source_url?: string }[] | null) ?? [];
      if (
        isLikelyDuplicate(
          {
            startDate: ev.startDate,
            endDate: ev.endDate ?? ev.startDate,
            name: ev.name,
            lat: ev.lat,
            lng: ev.lng,
            placeText: ev.placeText,
            fingerprint: fp,
            urls: incomingUrls,
          },
          {
            startDate: row.start_date,
            endDate: row.end_date,
            name: row.name,
            lat: loc?.lat,
            lng: loc?.lng,
            placeText: loc?.municipality || loc?.name,
            fingerprint: row.fingerprint,
            urls: [row.website_url, row.registration_url, ...srcs.map((s) => s.source_url)],
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
        .select(
          "id, name, start_date, end_date, level, uci_class, class_label, overrides:event_overrides(locked_fields)",
        )
        .eq("id", existingId)
        .maybeSingle()
    : { data: byFp };

  const locked =
    (existingFull as { overrides?: { locked_fields?: string[] } | { locked_fields?: string[] }[] } | null)
      ?.overrides;
  const lockedFields = Array.isArray(locked)
    ? locked[0]?.locked_fields ?? []
    : locked?.locked_fields ?? [];

  const { shouldIngestByCountry, isRoughlyInEurope } = await import("@/lib/geo/europe");
  // Drop explicit non-European races early (before locations / geocode queue)
  if (ev.countryHint && !shouldIngestByCountry(ev.countryHint)) {
    return null;
  }
  if (
    ev.lat != null &&
    ev.lng != null &&
    !ev.countryHint &&
    !isRoughlyInEurope(ev.lat, ev.lng)
  ) {
    return null;
  }

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

    if (!shouldIngestByCountry(country)) {
      return null;
    }

    // Reuse an existing location with same query + country (cuts geocode queue growth)
    const { data: reused } = await supabase
      .from("locations")
      .select("id, lat, lng")
      .eq("geocode_query", geocodeQuery)
      .eq("country_code", country)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reused?.id) {
      locationId = reused.id;
      if (reused.lat == null && lat != null && lng != null) {
        await supabase
          .from("locations")
          .update({
            lat,
            lng,
            geocode_status: "ok",
            updated_at: new Date().toISOString(),
          })
          .eq("id", reused.id);
        await supabase.rpc("set_location_geog", {
          loc_id: reused.id,
          lng,
          lat,
        });
      }
    } else {
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
  }

  const website = incomingWebsite;
  const registration = incomingRegistration;
  const { isNonRaceEventName } = await import("@/lib/event-visibility");
  const hideAsNonRace = isNonRaceEventName(ev.name);

  const existingRow = existingFull as {
    id?: string;
    name?: string;
    start_date?: string;
    end_date?: string;
    level?: string;
    uci_class?: string | null;
    class_label?: string | null;
  } | null;

  let mergedName = ev.name;
  let mergedStart = ev.startDate;
  let mergedEnd = ev.endDate ?? ev.startDate;
  let mergedLevel: { level: string; uciClass: string | null; classLabel: string | null } = {
    level: levelInfo.level,
    uciClass: levelInfo.uciClass,
    classLabel: levelInfo.classLabel,
  };

  if (existingId && existingRow?.start_date) {
    const span = mergeDateSpan(
      { startDate: existingRow.start_date, endDate: existingRow.end_date },
      { startDate: ev.startDate, endDate: ev.endDate ?? ev.startDate },
    );
    mergedStart = span.startDate;
    mergedEnd = span.endDate;
    mergedName = preferEventName(existingRow.name || ev.name, ev.name);
    mergedLevel = preferLevel(
      {
        level: existingRow.level,
        uciClass: existingRow.uci_class,
        classLabel: existingRow.class_label,
      },
      {
        level: levelInfo.level,
        uciClass: levelInfo.uciClass,
        classLabel: levelInfo.classLabel,
      },
    );
  }

  const payload: Record<string, unknown> = {
    name: mergedName,
    name_normalized: normalizeName(mergedName),
    start_date: mergedStart,
    end_date: mergedEnd,
    disciplines,
    audience,
    age_categories: ageCategories,
    fingerprint: fingerprint({
      startDate: mergedStart,
      name: mergedName,
      lat: ev.lat,
      lng: ev.lng,
    }),
    source_kind: "scraped",
    level: mergedLevel.level,
    class_label: mergedLevel.classLabel ?? null,
    uci_class: mergedLevel.uciClass ?? null,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (hideAsNonRace && !lockedFields.includes("status")) {
    payload.status = "hidden";
  }

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

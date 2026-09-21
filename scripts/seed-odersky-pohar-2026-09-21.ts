/**
 * Seed KOLÁRNA–CBA Oderský pohár 2026 from the official calendar page.
 * Source: https://www.kolarna.eu/kolarna-cba-odersky-pohar-2026/
 *
 * Usage: nvm use 22 && npx tsx scripts/seed-odersky-pohar-2026-09-21.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";
import { attachEventSeries } from "../src/lib/catalog/event-series";
import { listEvents } from "../src/lib/events";
import { geocodePlace } from "../src/lib/geocode";
import { timezoneForCountry } from "../src/lib/geo/timezones";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const DRY = process.argv.includes("--dry");
const UPDATED_BY = "odersky-pohar seed 2026-09-21";
const SERIES_SLUG = "odersky-pohar";
const WEBSITE = "https://www.kolarna.eu/kolarna-cba-odersky-pohar-2026/";

type Round = {
  start: string;
  name: string;
  place: string;
  country?: string;
};

/** 12 rounds as listed on kolarna.eu (dates + venue text). */
const ROUNDS: Round[] = [
  { start: "2026-09-12", name: "Oderský pohár — Rohov", place: "Rohov" },
  { start: "2026-09-19", name: "Oderský pohár — Žádlovice", place: "Žádlovice" },
  { start: "2026-09-26", name: "Oderský pohár — DK Ostrava", place: "Ostrava" },
  { start: "2026-09-27", name: "Oderský pohár — TJ Slezan Frýdek-Místek", place: "Frýdek-Místek" },
  { start: "2026-10-10", name: "Oderský pohár — Moravská Třebová", place: "Moravská Třebová" },
  { start: "2026-10-17", name: "Oderský pohár — Gościęcin", place: "Gościęcin", country: "PL" },
  { start: "2026-10-28", name: "Oderský pohár — Krnov – Cvilín", place: "Krnov" },
  { start: "2026-10-31", name: "Oderský pohár — Zlaté Hory I.", place: "Zlaté Hory" },
  { start: "2026-11-01", name: "Oderský pohár — Zlaté Hory II.", place: "Zlaté Hory" },
  { start: "2026-11-07", name: "Oderský pohár — ACK Stará Ves n. O. I.", place: "Stará Ves nad Ondřejnicí" },
  { start: "2026-11-08", name: "Oderský pohár — ACK Stará Ves n. O. II.", place: "Stará Ves nad Ondřejnicí" },
  { start: "2026-11-28", name: "Oderský pohár — Zábřeh na Moravě (velké finále)", place: "Zábřeh" },
];

async function ensureLocation(
  supabase: ReturnType<typeof createServerSupabase>,
  place: string,
  country: string,
): Promise<string | null> {
  const { data: reused } = await supabase
    .from("locations")
    .select("id")
    .eq("geocode_query", place)
    .eq("country_code", country)
    .not("lat", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reused?.id) return reused.id as string;

  const geo = await geocodePlace(place, country);
  if (!geo) {
    console.log(`  geocode miss: ${place} (${country})`);
    return null;
  }

  const { data: created, error } = await supabase
    .from("locations")
    .insert({
      name: place,
      municipality: place,
      country_code: country,
      lat: geo.lat,
      lng: geo.lng,
      geocode_query: place,
      geocode_status: "ok",
      timezone: timezoneForCountry(country),
    })
    .select("id")
    .single();
  if (error) {
    console.log(`  location insert err: ${error.message}`);
    return null;
  }
  await supabase.rpc("set_location_geog", { loc_id: created.id, lng: geo.lng, lat: geo.lat });
  return created.id as string;
}

async function findOrCreate(
  supabase: ReturnType<typeof createServerSupabase>,
  round: Round,
): Promise<string | null> {
  const fp = fingerprint({ startDate: round.start, name: round.name });
  const slug = slugifyEvent(round.name, round.start);

  const { data: byFp } = await supabase
    .from("events")
    .select("id")
    .eq("fingerprint", fp)
    .is("merged_into_id", null)
    .maybeSingle();
  if (byFp?.id) return byFp.id as string;

  const { data: bySlug } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .is("merged_into_id", null)
    .maybeSingle();
  if (bySlug?.id) return bySlug.id as string;

  // Soft match: same day + "odersky" / place token already in series
  const { data: day } = await supabase
    .from("events")
    .select("id, name, series_id")
    .eq("start_date", round.start)
    .is("merged_into_id", null)
    .ilike("name", "%odersk%")
    .limit(5);
  if (day?.length === 1) return day[0]!.id as string;

  if (DRY) {
    console.log("  WOULD CREATE", round.start, round.name);
    return null;
  }

  const now = new Date().toISOString();
  const status = round.start < now.slice(0, 10) ? "completed" : "scheduled";
  const insertOnce = async (useSlug: string, useFp: string) =>
    supabase
      .from("events")
      .insert({
        slug: useSlug,
        name: round.name,
        name_normalized: normalizeName(round.name),
        start_date: round.start,
        end_date: round.start,
        fingerprint: useFp,
        disciplines: ["cx"],
        audience: "mixed",
        status,
        visibility: "public",
        website_url: WEBSITE,
        source_kind: "official",
        event_type: "race",
        competition_type: "series_round",
        season: "2026",
        level: "regional",
        created_at: now,
        updated_at: now,
        last_seen_at: now,
      })
      .select("id")
      .single();

  let { data, error } = await insertOnce(slug, fp);
  if (error) {
    const suffix = Date.now().toString(36);
    ({ data, error } = await insertOnce(`${slug}-${suffix}`, `${fp}:${suffix}`));
    if (error) {
      console.log("  CREATE ERR", error.message, round.name);
      return null;
    }
  }
  return data!.id as string;
}

async function lockFields(
  supabase: ReturnType<typeof createServerSupabase>,
  eventId: string,
  fields: Record<string, unknown>,
) {
  const { data: existing } = await supabase
    .from("event_overrides")
    .select("fields,locked_fields")
    .eq("event_id", eventId)
    .maybeSingle();
  const merged = { ...((existing?.fields as Record<string, unknown>) ?? {}), ...fields };
  const locked = [...new Set([...((existing?.locked_fields as string[]) ?? []), ...Object.keys(fields)])];
  await supabase.from("event_overrides").upsert(
    { event_id: eventId, fields: merged, locked_fields: locked, updated_by: UPDATED_BY },
    { onConflict: "event_id" },
  );
}

async function main() {
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  const { data: series } = await supabase
    .from("series")
    .select("id, website_url")
    .eq("slug", SERIES_SLUG)
    .maybeSingle();
  if (!series?.id) throw new Error("series odersky-pohar missing");
  const sid = series.id as string;

  console.log(`\n===== ${SERIES_SLUG}`);
  if (!DRY) {
    await supabase
      .from("series")
      .update({
        website_url: WEBSITE,
        source_url: WEBSITE,
        source_kind: "official",
        disciplines: ["cx"],
        updated_at: now,
        last_seen_at: now,
      })
      .eq("id", sid);

    // Ensure the official page is a watched source (protects series_id from aggregators).
    const { data: watched } = await supabase
      .from("watched_urls")
      .select("id")
      .eq("url", WEBSITE)
      .maybeSingle();
    if (!watched) {
      await supabase.from("watched_urls").insert({
        url: WEBSITE,
        kind: "series",
        status: "active",
        added_by: UPDATED_BY,
        notes: "Official 2026 calendar — KOLÁRNA–CBA Oderský pohár",
      });
      console.log("  watched_urls: added");
    }
  }

  // Hide scrapings that were wrongly attached as rounds.
  const { data: current } = await supabase
    .from("events")
    .select("id, name, start_date, status")
    .eq("series_id", sid)
    .is("merged_into_id", null);
  const keepDates = new Set(ROUNDS.map((r) => r.start));
  for (const e of current ?? []) {
    if (keepDates.has(e.start_date) && /odersk/i.test(e.name) && !/autor:\s*jan bartl/i.test(e.name)) {
      continue;
    }
    const junk = /autor:\s*jan bartl|aktuality|lip;|nou autor/i.test(e.name) || !keepDates.has(e.start_date);
    if (!junk && keepDates.has(e.start_date)) continue;
    console.log(`  detach junk: ${e.start_date} ${e.name.slice(0, 72)}`);
    if (DRY) continue;
    await supabase
      .from("events")
      .update({ series_id: null, status: "hidden", visibility: "hidden", updated_at: now })
      .eq("id", e.id);
    await supabase.from("event_series").delete().eq("event_id", e.id).eq("series_id", sid);
  }

  let created = 0;
  for (const round of ROUNDS) {
    const id = await findOrCreate(supabase, round);
    if (!id) continue;

    if (!DRY) {
      await attachEventSeries(supabase, id, sid, { primary: true, source: UPDATED_BY });

      const country = round.country ?? "CZ";
      const locationId = await ensureLocation(supabase, round.place, country);
      const patch: Record<string, unknown> = {
        name: round.name,
        name_normalized: normalizeName(round.name),
        start_date: round.start,
        end_date: round.start,
        website_url: WEBSITE,
        disciplines: ["cx"],
        visibility: "public",
        status: round.start < now.slice(0, 10) ? "completed" : "scheduled",
        updated_at: now,
        last_seen_at: now,
      };
      if (locationId) patch.location_id = locationId;
      await supabase.from("events").update(patch).eq("id", id);

      const lock: Record<string, unknown> = {
        name: round.name,
        start_date: round.start,
        end_date: round.start,
        series_id: sid,
        website_url: WEBSITE,
      };
      if (locationId) lock.location_id = locationId;
      await lockFields(supabase, id, lock);
    }

    console.log(`  OK ${round.start} ${round.name} @ ${round.place}`);
    created++;
  }

  if (!DRY) {
    const listed = await listEvents({ seriesSlug: SERIES_SLUG });
    console.log(`\n  => listEvents=${listed.length}`);
    for (const e of listed) {
      console.log(`     ${e.startDate}  ${e.name}`);
    }
  }

  console.log(`\nDone rounds=${created} dry=${DRY}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

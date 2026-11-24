/**
 * Add races an organiser announced where no reader may look (Facebook, Instagram, a poster in chat).
 * Input: one JSON file in the shape of `Announcement` (src/lib/catalog/announced-races.ts).
 * How to fill it: .claude/skills/add-from-poster/SKILL.md.
 *
 *   npx tsx scripts/add-announced-races.ts reports/announced/2026-11-21-usti.json --dry
 *   npx tsx scripts/add-announced-races.ts reports/announced/2026-11-21-usti.json
 *
 * For each race it checks every same-day record (hidden ones too) by name, venue and distance.
 * A race with possible matches is written only when the file says `update: <slug>` or `isNew: true`.
 * New races inherit venue, discipline and categories from `previous` (categories as "as last year");
 * registration, fees and regulations are never carried over. Confirmed fields are locked, the
 * source and its quote are stored as facts, and the public pages are asked to refresh.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { eventSlugCandidates, fingerprint } from "../src/lib/domain";
import { attachEventSeries } from "../src/lib/catalog/event-series";
import {
  likelySameRace, planNewRace, planUpdate, statedAges, validateAnnouncement,
  type AnnouncedRace, type PreviousEdition,
} from "../src/lib/catalog/announced-races";
import type { Insert, Json } from "../src/lib/supabase/tables";
import { facebookPageUrl } from "../src/lib/watcher/public-url";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) throw Error("Usage: npx tsx scripts/add-announced-races.ts <announcement.json> [--dry]");
const DRY = process.argv.includes("--dry");
const ann = validateAnnouncement(JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")));
const BY = `announced ${file.split("/").pop()}`;
const SITE = "https://letsrace.cz";
const db = createServerSupabase();

type Loc = { id: string; name: string | null; lat: number | null; lng: number | null };
const PREV_COLS = "id,slug,location_id,disciplines,formats,audience,level,competition_type,event_type,age_categories,website_url,timezone,class_label";

function km(a: Loc, b: Loc): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

async function location(id: string | null | undefined): Promise<Loc | null> {
  if (!id) return null;
  const { data } = await db.from("locations").select("id,name,lat,lng").eq("id", id).maybeSingle();
  return (data as Loc) ?? null;
}

async function bySlug(slug: string, cols: string) {
  const { data, error } = await db.from("events").select(cols).eq("slug", slug).is("merged_into_id", null).maybeSingle();
  if (error) throw Error(error.message);
  if (!data) throw Error(`No live race with slug ${slug}`);
  return data as unknown as Record<string, unknown>;
}

/** Same-day records that may be this race, by name, venue or distance. */
async function possibleMatches(race: AnnouncedRace, venue: Loc | null) {
  const { data } = await db.from("events").select("id,slug,name,location_id,visibility,merged_into_id")
    .eq("start_date", race.start).is("merged_into_id", null);
  const out: string[] = [];
  for (const e of data ?? []) {
    if (race.update && e.slug === race.update) continue;
    const there = await location(e.location_id as string | null);
    const dist = venue && there ? km(venue, there) : null;
    const why = [
      likelySameRace(race.name, e.name as string) && "similar name",
      venue && e.location_id === venue.id && "same venue",
      dist != null && dist <= 15 && `${dist.toFixed(1)} km away`,
    ].filter(Boolean);
    if (why.length) out.push(`${e.slug} "${e.name}" [${e.visibility}] — ${why.join(", ")}`);
  }
  return out;
}

async function lock(id: string, fields: Record<string, unknown>) {
  const { data: ex } = await db.from("event_overrides").select("fields,locked_fields").eq("event_id", id).maybeSingle();
  const { error } = await db.from("event_overrides").upsert({
    event_id: id,
    fields: { ...((ex?.fields as object) ?? {}), ...fields } as Json,
    locked_fields: [...new Set([...((ex?.locked_fields as string[]) ?? []), ...Object.keys(fields)])],
    updated_by: BY,
  }, { onConflict: "event_id" });
  if (error) throw Error(error.message);
}

async function insertRace(row: Record<string, unknown>, place: string | null): Promise<{ id: string; slug: string }> {
  const now = new Date().toISOString();
  for (const slug of eventSlugCandidates(row.name as string, row.start_date as string, place)) {
    const { data: taken } = await db.from("events").select("id").eq("slug", slug).maybeSingle();
    if (taken) continue;
    const { data, error } = await db.from("events").insert({
      ...(row as Insert<"events">), slug, created_at: now, updated_at: now, last_seen_at: now,
      fingerprint: fingerprint({ startDate: row.start_date as string, name: row.name as string }),
    }).select("id,slug").single();
    if (error) throw Error(`${row.name}: ${error.message}`);
    return data as { id: string; slug: string };
  }
  throw Error(`${row.name}: every address is taken`);
}

async function main() {
  let seriesId: string | null = null;
  if (ann.series) {
    const { data } = await db.from("series").select("id,facebook_url").eq("slug", ann.series).maybeSingle();
    if (!data) throw Error(`No series ${ann.series}`);
    seriesId = data.id as string;
    // The organiser's page belongs to the series too, unless it already has one.
    const page = facebookPageUrl(ann.facebook);
    if (page && !data.facebook_url) {
      console.log(`Series ${ann.series} gets Facebook ${page}`);
      if (!DRY) {
        const { error } = await db.from("series").update({ facebook_url: page, updated_at: new Date().toISOString() }).eq("id", seriesId);
        if (error) throw Error(error.message);
      }
    }
  }
  const done: string[] = [], blocked: string[] = [];

  for (const race of ann.races) {
    const previous = race.previous ? (await bySlug(race.previous, PREV_COLS)) as unknown as PreviousEdition & { id: string } : null;
    const target = race.update ? await bySlug(race.update, "id,slug,location_id,age_categories") : null;
    const plan = target ? null : planNewRace(race, ann, previous);
    const venueId = (race.locationId ?? (target?.location_id as string | null) ?? plan?.row.location_id ?? null) as string | null;
    const venue = await location(venueId);
    if (venueId && !venue) throw Error(`${race.name}: location ${venueId} does not exist`);

    const matches = await possibleMatches(race, venue);
    console.log(`\n${race.start} ${race.name}${target ? ` → update ${target.slug}` : " → new"}${venue ? ` @ ${venue.name}` : ""}`);
    for (const m of matches) console.log(`   same day: ${m}`);
    if (!target && matches.length && !race.isNew) {
      blocked.push(`${race.start} ${race.name}: decide "update": "<slug>" or "isNew": true (same-day records listed above)`);
      continue;
    }
    if (plan) {
      console.log(`   ${JSON.stringify({ location: plan.row.location_id, disciplines: plan.row.disciplines, ages: plan.row.age_categories, confidence: plan.row.age_confidence, season: plan.row.season, website: plan.row.website_url })}`);
      if (plan.inherited.length) console.log(`   inherited from ${race.previous}: ${plan.inherited.map((f) => f.field).join(", ")}`);
    } else console.log(`   patch ${JSON.stringify(planUpdate(race, ann, (target?.age_categories as string[] | null) ?? []))}`);
    if (DRY) continue;

    const now = new Date().toISOString();
    let id: string, slug: string;
    if (target) {
      ({ id, slug } = target as { id: string; slug: string });
      const { error } = await db.from("events").update({ ...planUpdate(race, ann, (target?.age_categories as string[] | null) ?? []), updated_at: now, last_seen_at: now }).eq("id", id);
      if (error) throw Error(error.message);
    } else {
      ({ id, slug } = await insertRace(plan!.row, venue?.name ?? null));
    }
    if (seriesId) await attachEventSeries(db, id, seriesId, { primary: true, source: BY });

    const stated = statedAges(race);
    await lock(id, {
      ...(target ? {} : { name: race.name, location_id: plan!.row.location_id, website_url: plan!.row.website_url }),
      start_date: race.start, end_date: race.end ?? race.start,
      ...(race.locationId ? { location_id: race.locationId } : {}),
      ...(stated ? { age_categories: stated } : {}),
      ...(seriesId ? { series_id: seriesId } : {}),
    });

    const { error: sErr } = await db.from("event_sources").insert({
      event_id: id, source_url: ann.source, kind: "official", is_canonical: true, external_id: `announced-${race.start}-${slug}`,
    });
    if (sErr && !/duplicate/i.test(sErr.message)) throw Error(sErr.message);
    const facts = [
      { field: "start_date", value: race.start, source_url: ann.source, quote: race.quote, method: "manual_source_review" },
      ...(stated ? [{ field: "age_categories", value: stated, source_url: ann.source, quote: (race.classes ?? race.ageCategories ?? []).join("; "), method: "manual_source_review" }] : []),
      ...(plan?.inherited ?? []).map((f) => ({
        field: f.field, value: f.value, source_url: `${SITE}/cs/zavod/${f.fromSlug}`, method: "previous_edition",
        quote: "Inherited from the previous edition; not confirmed for this edition until the organiser publishes it.",
      })),
    ];
    const { error: fErr } = await db.from("event_facts").insert(
      facts.map((f) => ({ event_id: id, ...f, value: f.value as Json, version: "announced-edition-v1" })),
    );
    if (fErr) throw Error(fErr.message);
    done.push(`${SITE}/cs/zavod/${slug}`);
  }

  console.log(`\n${DRY ? "Dry run, nothing written." : `Written ${done.length}:`}`);
  for (const u of done) console.log(`  ${u}`);
  for (const b of blocked) console.log(`  BLOCKED ${b}`);
  if (DRY || !done.length) return;

  // Pages that existed before need their cached copy expired; the claim allows one batch an hour.
  const { requestPublicRefreshes } = await import("../src/lib/pipeline/public-refresh-requests");
  const refresh = await requestPublicRefreshes();
  if (refresh.status === "waiting") {
    const { data } = await db.from("pipeline_task_attempts").select("started_at").eq("kind", "public_expire")
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    const next = data ? new Date(Date.parse(data.started_at as string) + 3_600_000) : null;
    console.log(`Cache refresh: next hourly slot ${next ? next.toLocaleTimeString("cs-CZ", { timeZone: "Europe/Prague" }) : "soon"}; the Mac cycle takes it, or run scripts/request-public-refreshes.ts then. New pages are live already.`);
  } else console.log(`Cache refresh: ${refresh.status}, ${refresh.requested} item(s).`);
  try {
    const { refreshLiveEditionCoverage } = await import("./update-edition-coverage");
    const cov = await refreshLiveEditionCoverage();
    console.log(`Edition coverage (${cov.season}): ${cov.withEdition}/${cov.races}.`);
  } catch (e) {
    console.warn(`Edition coverage not refreshed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (blocked.length) process.exitCode = 3;
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

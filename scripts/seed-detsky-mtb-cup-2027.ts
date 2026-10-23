/**
 * Seed Dětský MTB Cup Libereckého kraje 2027 (jubilejní 20. ročník) from the
 * organiser's calendar poster published 2026-10-23.
 * Source: https://www.detskymtbcup.cz/
 *
 * Eight rounds attach to the existing `detsky-mtb-cup` series. The closing
 * ceremony ("Vyhlášení", 2027-11-06) is not a race, so it is not an event.
 *
 * Usage: npx tsx scripts/seed-detsky-mtb-cup-2027.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";
import { attachEventSeries } from "../src/lib/catalog/event-series";
import { listEvents } from "../src/lib/events";
import type { Json } from "../src/lib/supabase/tables";

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
const UPDATED_BY = "detsky-mtb-cup 2027 seed 2026-10-23";
const SERIES_SLUG = "detsky-mtb-cup";
const WEBSITE = "https://www.detskymtbcup.cz/";

/** Venues already used by the 2026 rounds. */
const SOBOTKA = "e65f537d-12b6-4e0a-9ae2-9861e6432ba3";
const TURNOV = "d5f24ac8-cf4c-4eff-be11-13910c0ef25d"; // Turnov Rohozec
const TURNOV_STRUHY = "058b2373-c209-4cd8-b881-621e2e72729c";
const BEDRICHOV = "8132efee-deec-40c0-848b-f05edfcaa41a";
const TANVALD = "a0d139b2-026b-43e3-a52b-c6a2ffa97dd3";
const VRATISLAVICE = "3f75b32f-706c-485c-91a6-4e97c4bd4e03";
const JESTED = "28cbc6e8-37cc-4117-8466-c4a6d860cd76"; // Ski areál Ještěd
const NOVE_MESTO = "f0780d14-127d-45bc-bf88-c2aece114086"; // Nové Město pod Smrkem

type Race = {
  start: string;
  name: string;
  locationId: string;
  /** Same-day names that already mean this race. */
  match: RegExp;
};

const CUP = /d[ěe]tsk[ýy] mtb/i;

const RACES: Race[] = [
  { start: "2027-04-18", name: "Dětský MTB Cup — Sobotka (časovka + závod)", locationId: SOBOTKA, match: CUP },
  { start: "2027-05-02", name: "Dětský MTB Cup — Turnov Rohozec", locationId: TURNOV, match: CUP },
  { start: "2027-05-16", name: "Dětský MTB Cup — Turnov Struhy", locationId: TURNOV_STRUHY, match: CUP },
  { start: "2027-05-30", name: "Dětský MTB Cup — Bedřichov (Mistrovství Libereckého kraje)", locationId: BEDRICHOV, match: CUP },
  { start: "2027-06-20", name: "Dětský MTB Cup — Tanvald", locationId: TANVALD, match: CUP },
  { start: "2027-09-05", name: "Dětský MTB Cup — Vratislavice nad Nisou", locationId: VRATISLAVICE, match: CUP },
  { start: "2027-09-12", name: "Dětský MTB Cup — Liberec Ještěd", locationId: JESTED, match: CUP },
  { start: "2027-10-03", name: "Dětský MTB Cup — Nové Město pod Smrkem", locationId: NOVE_MESTO, match: CUP },
];

type Supabase = ReturnType<typeof createServerSupabase>;

async function findExisting(supabase: Supabase, race: Race): Promise<string | null> {
  const fp = fingerprint({ startDate: race.start, name: race.name });
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
    .eq("slug", slugifyEvent(race.name, race.start))
    .is("merged_into_id", null)
    .maybeSingle();
  if (bySlug?.id) return bySlug.id as string;

  const { data: day } = await supabase
    .from("events")
    .select("id, name")
    .eq("start_date", race.start)
    .is("merged_into_id", null);
  const same = (day ?? []).filter((e) => race.match.test(e.name as string));
  if (same.length === 1) return same[0]!.id as string;
  if (same.length > 1) {
    console.log(`  AMBIGUOUS ${race.start}: ${same.map((e) => e.name).join(" | ")}`);
  }
  return null;
}

async function create(supabase: Supabase, race: Race): Promise<string | null> {
  const now = new Date().toISOString();
  const fp = fingerprint({ startDate: race.start, name: race.name });
  const slug = slugifyEvent(race.name, race.start);
  const { data, error } = await supabase
    .from("events")
    .insert({
      slug,
      name: race.name,
      name_normalized: normalizeName(race.name),
      start_date: race.start,
      end_date: race.start,
      fingerprint: fp,
      disciplines: ["xco"],
      formats: ["xco"],
      age_categories: ["kids", "youth"],
      audience: "mixed",
      status: "scheduled",
      visibility: "public",
      website_url: WEBSITE,
      source_kind: "official",
      event_type: "cup",
      competition_type: "community",
      season: "2027",
      level: "local",
      location_id: race.locationId,
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    })
    .select("id")
    .single();
  if (error) {
    console.log("  CREATE ERR", error.message, race.name);
    return null;
  }
  return data.id as string;
}

async function lockFields(supabase: Supabase, eventId: string, fields: Record<string, unknown>) {
  const { data: existing } = await supabase
    .from("event_overrides")
    .select("fields,locked_fields")
    .eq("event_id", eventId)
    .maybeSingle();
  const merged = { ...((existing?.fields as Record<string, unknown>) ?? {}), ...fields };
  const locked = [
    ...new Set([...((existing?.locked_fields as string[]) ?? []), ...Object.keys(fields)]),
  ];
  const { error } = await supabase
    .from("event_overrides")
    .upsert(
      { event_id: eventId, fields: merged as Json, locked_fields: locked, updated_by: UPDATED_BY },
      { onConflict: "event_id" },
    );
  if (error) throw new Error(error.message);
}

async function main() {
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  const { data: series } = await supabase
    .from("series")
    .select("id")
    .eq("slug", SERIES_SLUG)
    .maybeSingle();
  if (!series?.id) throw new Error(`series ${SERIES_SLUG} missing`);
  const sid = series.id as string;

  for (const race of RACES) {
    const found = await findExisting(supabase, race);
    if (DRY) {
      console.log(`  ${found ? "UPDATE" : "CREATE"} ${race.start} ${race.name}`);
      continue;
    }
    const id = found ?? (await create(supabase, race));
    if (!id) continue;

    const patch = {
      name: race.name,
      name_normalized: normalizeName(race.name),
      start_date: race.start,
      end_date: race.start,
      disciplines: ["xco"],
      level: "local",
      event_type: "cup",
      competition_type: "community",
      season: "2027",
      location_id: race.locationId,
      website_url: WEBSITE,
      status: "scheduled",
      visibility: "public",
      updated_at: now,
      last_seen_at: now,
    };
    const { error } = await supabase.from("events").update(patch).eq("id", id);
    if (error) throw new Error(error.message);

    await attachEventSeries(supabase, id, sid, { primary: true, source: UPDATED_BY });

    await lockFields(supabase, id, {
      name: race.name,
      start_date: race.start,
      end_date: race.start,
      location_id: race.locationId,
      website_url: WEBSITE,
      series_id: sid,
    });
    console.log(`  OK ${found ? "updated" : "created"} ${race.start} ${race.name}`);
  }

  if (!DRY) {
    const listed = await listEvents({ seriesSlug: SERIES_SLUG, dateFrom: "2027-01-01" });
    console.log(`\n  => ${SERIES_SLUG} 2027: ${listed.length}`);
    for (const e of listed) console.log(`     ${e.startDate}  ${e.name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

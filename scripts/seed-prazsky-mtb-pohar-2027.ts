/**
 * Seed ŠKODA Pražský MTB pohár 2027 and MČR MTB XCC/XCO 2027 (Praha, Traily
 * Motol) from the organiser's own announcement.
 * Source: https://www.facebook.com/prahamtb (post of 2026-09-27, "…na těchto
 * závodech v roce 2027").
 *
 * The MČR is announced by the same organiser but is not a round of the Pražský
 * pohár, so it stays out of that series. It is not attached to Český pohár MTB
 * either: ČP has not published its 2027 calendar, and a series lists exactly
 * its official rounds.
 *
 * Usage: npx tsx scripts/seed-prazsky-mtb-pohar-2027.ts [--dry]
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
const UPDATED_BY = "prazsky-mtb-pohar 2027 seed 2026-09-28";
const SERIES_SLUG = "prazsky-mtb-pohar";
const WEBSITE = "https://prahamtb.cz/";

/** Venues already used by the 2026 rounds. */
const MOTOL = "4d121da2-e5fe-44d0-9f32-7bf69341c957"; // Traily Motol
const LETNANY_KBELY = "56205aab-86da-4df6-9686-8e602506b475"; // Lesopark Letňany – Kbely

type Race = {
  start: string;
  end?: string;
  name: string;
  locationId: string;
  disciplines: string[];
  level: string;
  eventType: string;
  competitionType: string;
  inSeries: boolean;
  /** Same-day names that already mean this race. */
  match: RegExp;
};

const RACES: Race[] = [
  {
    start: "2027-03-26",
    name: "Pražský MTB pohár — 1. kolo Motol XCC (Mistrovství Prahy XCC)",
    locationId: MOTOL,
    disciplines: ["xcc"],
    level: "regional",
    eventType: "race",
    competitionType: "community",
    inSeries: true,
    match: /pra[žz]sk/i,
  },
  {
    start: "2027-03-27",
    name: "Pražský MTB pohár — 2. kolo Motol XCO",
    locationId: MOTOL,
    disciplines: ["xco"],
    level: "regional",
    eventType: "race",
    competitionType: "community",
    inSeries: true,
    match: /pra[žz]sk/i,
  },
  {
    start: "2027-07-16",
    end: "2027-07-18",
    name: "MČR MTB XCC/XCO — Praha — Traily Motol",
    locationId: MOTOL,
    disciplines: ["xcc", "xco"],
    level: "national",
    eventType: "championship",
    competitionType: "national_federation",
    inSeries: false,
    match: /m[čc]r|mistrovstv[íi] [čc]/i,
  },
  {
    start: "2027-09-25",
    name: "Pražský MTB pohár — 3. kolo Letňany/Kbely XCO",
    locationId: LETNANY_KBELY,
    disciplines: ["xco"],
    level: "regional",
    eventType: "race",
    competitionType: "community",
    inSeries: true,
    match: /pra[žz]sk/i,
  },
  {
    start: "2027-09-26",
    name: "Pražský MTB pohár — 4. kolo Letňany/Kbely XCO (Mistrovství Prahy XCO)",
    locationId: LETNANY_KBELY,
    disciplines: ["xco"],
    level: "regional",
    eventType: "race",
    competitionType: "community",
    inSeries: true,
    match: /pra[žz]sk/i,
  },
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
      end_date: race.end ?? race.start,
      fingerprint: fp,
      disciplines: race.disciplines,
      audience: "mixed",
      status: "scheduled",
      visibility: "public",
      website_url: WEBSITE,
      source_kind: "official",
      event_type: race.eventType,
      competition_type: race.competitionType,
      season: "2027",
      level: race.level,
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
      end_date: race.end ?? race.start,
      disciplines: race.disciplines,
      level: race.level,
      event_type: race.eventType,
      competition_type: race.competitionType,
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

    if (race.inSeries) {
      await attachEventSeries(supabase, id, sid, { primary: true, source: UPDATED_BY });
    }

    await lockFields(supabase, id, {
      name: race.name,
      start_date: race.start,
      end_date: race.end ?? race.start,
      location_id: race.locationId,
      website_url: WEBSITE,
      ...(race.inSeries ? { series_id: sid } : {}),
    });
    console.log(`  OK ${found ? "updated" : "created"} ${race.start} ${race.name}`);
  }

  if (!DRY) {
    await supabase
      .from("series")
      .update({ description: "Čtyři bodovaná kola na jaře a na podzim — Motol a Letňany/Kbely.", updated_at: now })
      .eq("id", sid);

    const listed = await listEvents({ seriesSlug: SERIES_SLUG, dateFrom: "2027-01-01" });
    console.log(`\n  => ${SERIES_SLUG} 2027: ${listed.length}`);
    for (const e of listed) console.log(`     ${e.startDate}  ${e.name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

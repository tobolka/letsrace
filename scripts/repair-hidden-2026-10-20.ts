/**
 * Republish races hidden by the calendar-freshness pass while their listing
 * still carries them, and put Soběšická Mulda back on the map.
 *
 * Two bugs hid them (both fixed in `hideDroppedCalendarEvents`):
 *  - a race the listing renamed kept its old external id beside the new one,
 *    and the old id going missing hid the race;
 *  - FCI and Ride&Rest are read a month window at a time, so races outside
 *    the window read as dropped and were hidden a few per run.
 * Nothing republishes a race the watcher sees again, so they stayed hidden.
 *
 * The ids come from an audit of 2026-10-20: upcoming, status `hidden`, seen in
 * their listing within the last week, with vague names ("GARA"), the 31 Dec
 * placeholder date and same-day near-duplicates left out.
 *
 * Mulda: 2026 ran on 11 Oct (results are up), the organiser has announced
 * 10 Oct 2027. Muldička, the kids' race on the meadow, runs the same morning.
 * Source: https://www.czex.cz/mulda/ and /mulda/muldicka.
 *
 * Usage: npx tsx scripts/repair-hidden-2026-10-20.ts <ids.json> [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

const DRY = process.argv.includes("--dry");
const IDS_FILE = process.argv.slice(2).find((a) => !a.startsWith("--"));
const UPDATED_BY = "hidden-audit 2026-10-20";
const MULDA_2026 = "874856ec-0790-44e5-b70d-e140a31cfc7c";
const MULDA_LOCATION = "d65860aa-7666-4b8a-8b4a-0d9cffd800b4";
const WEBSITE = "https://www.czex.cz/mulda/";
const MULDICKA_URL = "https://www.czex.cz/mulda/muldicka";

const supabase = createServerSupabase();

async function lockFields(eventId: string, fields: Record<string, unknown>) {
  const { data: existing } = await supabase
    .from("event_overrides")
    .select("fields,locked_fields")
    .eq("event_id", eventId)
    .maybeSingle();
  const merged = { ...((existing?.fields as Record<string, unknown>) ?? {}), ...fields };
  const locked = [...new Set([...((existing?.locked_fields as string[]) ?? []), ...Object.keys(fields)])];
  const { error } = await supabase
    .from("event_overrides")
    .upsert({ event_id: eventId, fields: merged, locked_fields: locked, updated_by: UPDATED_BY }, { onConflict: "event_id" });
  if (error) throw new Error(error.message);
}

async function republishListed(ids: string[]) {
  const now = new Date().toISOString();
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    if (DRY) continue;
    const { error } = await supabase
      .from("events")
      .update({ visibility: "public", status: "scheduled", updated_at: now })
      .in("id", chunk)
      .eq("status", "hidden")
      .is("merged_into_id", null);
    if (error) throw new Error(error.message);
  }
  console.log(`${DRY ? "would republish" : "republished"} ${ids.length} listed races`);
}

async function mulda() {
  const now = new Date().toISOString();
  // The listing's address string geocoded to central Brno; the start meadow is
  // by the red transmitter building at Okružní 29a, Lesná.
  const { count } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("location_id", MULDA_LOCATION);
  console.log(`Mulda location shared by ${count} events`);
  if (!DRY) {
    const { error } = await supabase
      .from("locations")
      .update({
        name: "Okružní 29a, Brno-Lesná",
        municipality: "Brno",
        venue: "Louka u vysílače, Okružní 29a",
        lat: 49.2351,
        lng: 16.6226,
        geocode_query: "Okružní 29a, Brno",
        geocode_status: "ok",
        updated_at: now,
      })
      .eq("id", MULDA_LOCATION);
    if (error) throw new Error(error.message);
    const { error: evErr } = await supabase
      .from("events")
      .update({ visibility: "public", status: "completed", website_url: WEBSITE, updated_at: now })
      .eq("id", MULDA_2026);
    if (evErr) throw new Error(evErr.message);
    await lockFields(MULDA_2026, { visibility: "public", status: "completed" });
  }
  console.log("Mulda 2026 → public, completed");

  const races = [
    {
      name: "Soběšická Mulda 2027",
      disciplines: ["xco"],
      audience: "mixed",
      website: WEBSITE,
      description:
        "Tradiční XC závod pro amatéry a příchozí ve věku 10–120 let v Brně-Lesné: 15 a 30 km, mládež na kratších okruzích, měření čipy.",
    },
    {
      name: "Muldička 2027",
      disciplines: ["xco"],
      audience: "kids",
      website: MULDICKA_URL,
      description:
        "Dětský závod na kolech po louce pro děti 4–9 let, ráno před Soběšickou Muldou. Startovné zdarma, povinná přilba.",
    },
  ];
  const start = "2027-10-10";
  for (const race of races) {
    const fp = fingerprint({ startDate: start, name: race.name });
    const slug = slugifyEvent(race.name, start);
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .or(`fingerprint.eq.${fp},slug.eq.${slug}`)
      .is("merged_into_id", null)
      .maybeSingle();
    if (existing) {
      console.log(`  exists ${race.name} (${existing.id})`);
      continue;
    }
    if (DRY) {
      console.log(`  would create ${race.name} ${start}`);
      continue;
    }
    const { data, error } = await supabase
      .from("events")
      .insert({
        slug,
        name: race.name,
        name_normalized: normalizeName(race.name),
        start_date: start,
        end_date: start,
        fingerprint: fp,
        disciplines: race.disciplines,
        formats: race.disciplines,
        audience: race.audience,
        status: "scheduled",
        visibility: "public",
        website_url: race.website,
        source_kind: "official",
        event_type: "race",
        competition_type: "community",
        season: "2027",
        level: "local",
        description: race.description,
        location_id: MULDA_LOCATION,
        timezone: "Europe/Prague",
        created_at: now,
        updated_at: now,
        last_seen_at: now,
      })
      .select("id")
      .single();
    if (error) throw new Error(`${race.name}: ${error.message}`);
    console.log(`  created ${race.name} (${data.id})`);
  }
}

async function main() {
  if (!IDS_FILE) throw new Error("usage: repair-hidden-2026-10-20.ts <ids.json> [--dry]");
  const ids = JSON.parse(readFileSync(IDS_FILE, "utf8")) as string[];
  await republishListed(ids);
  await mulda();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

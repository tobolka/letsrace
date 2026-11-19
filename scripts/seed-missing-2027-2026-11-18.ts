/**
 * Four verified 2027 additions found 2026-11-18 (see reports/missing-2027-2026-11-18/).
 *  - Austrian Extreme Bike Race (new), organiser page austrianextremebikerace.at
 *  - Dětská Rohálovka (new children's race, parent Rohálovská 50ka already exists), vesani.cz/propozice-deti/
 *  - Garmin Bratislavský MTB maratón (new, date from bikepoint.sk only; organiser still shows 2026)
 *  - Urban Downhill Race Leutkirch (existing; description + lock only)
 * Local Series of Downhill is NOT written: only an aggregator corroborates it.
 *
 * Usage: npx tsx scripts/seed-missing-2027-2026-11-18.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";
import { attachEventSeries } from "../src/lib/catalog/event-series";
import type { Json } from "../src/lib/supabase/tables";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const DRY = process.argv.includes("--dry");
const BY = "missing-2027 import 2026-11-18";
const supabase = createServerSupabase();

type Cat = { name: string; distance_km?: number; elevation_m?: number; age_min?: number; age_max?: number; gender?: "male" | "female"; audience?: string };
type Spec = {
  name: string; start: string; end: string; locationId: string; disciplines: string[];
  audience: string; ages: string[]; eventType: string; level: string; competitionType: string;
  website: string; regulations?: string; registration?: string; description: string;
  categories: Cat[]; seriesSlug?: string;
};

const GRAZ = "4f3aa906-735d-479a-8015-f05c3fe2cdb4";
const PRUSINOVICE = "e701ab85-0ec3-482b-bd35-717a3d3fc22d";
const RACA = "0d8bd426-0116-438f-b04f-3dea3166ceaf"; // location of the 2026 edition (Bratislava-Rača)

const kid = (name: string, y1: number, y2: number, gender: "male" | "female", km?: number): Cat => ({
  name: `${name} ${gender === "male" ? "chlapci" : "dívky"}`,
  age_min: Math.max(0, 2027 - y2), age_max: 2027 - y1, gender, audience: "kids", ...(km ? { distance_km: km } : {}),
});
const pair = (name: string, y1: number, y2: number, km?: number) => (["male", "female"] as const).map((g) => kid(name, y1, y2, g, km));

const SPECS: Spec[] = [
  {
    name: "Austrian Extreme Bike Race", start: "2027-08-15", end: "2027-08-30", locationId: GRAZ,
    disciplines: ["road"], audience: "adults", ages: ["amateur", "masters"], eventType: "race", level: "international",
    competitionType: "community", website: "https://www.austrianextremebikerace.at/", registration: undefined,
    description:
      "Unsupported ultracycling race starting and finishing in Graz. Grand Départ with the 880 km loop (about 16,000 m climbing) on 15 August 2027 at 09:00, riders set off individually five minutes apart; finish cut-off 30 August 2027, 23:59. A 2,500 km individual time trial (about 52,000 m climbing) can be started by riders whenever they choose within the organiser's rules, so it has no fixed start. Solo and pairs; the 880 km route has supported and unsupported classes. Riders must be over 18. Registration and bike check on the afternoon of 14 August. Organiser: Abenteuer und Bergsportklub Graz. The organiser's site says registration runs from October 2026 to early August 2027 (and elsewhere mentions inquiries opening October 2027) – confirm the exact process with the organiser. 100 EUR for tracking and insurance is due after registration.",
    categories: [
      { name: "880 km – Solo, unsupported", distance_km: 880, elevation_m: 16000, age_min: 18 },
      { name: "880 km – Solo, supported", distance_km: 880, elevation_m: 16000, age_min: 18 },
      { name: "880 km – Pairs, unsupported", distance_km: 880, elevation_m: 16000, age_min: 18 },
      { name: "880 km – Pairs, supported", distance_km: 880, elevation_m: 16000, age_min: 18 },
      { name: "2,500 km ITT – Solo (self-chosen start)", distance_km: 2500, elevation_m: 52000, age_min: 18 },
      { name: "2,500 km ITT – Pairs (self-chosen start)", distance_km: 2500, elevation_m: 52000, age_min: 18 },
    ],
  },
  {
    name: "Dětská Rohálovka", start: "2027-05-01", end: "2027-05-01", locationId: PRUSINOVICE,
    disciplines: ["mtb"], audience: "kids", ages: ["kids", "youth", "u7", "u9", "u11", "u13", "u15"], eventType: "race", level: "local",
    competitionType: "community", website: "https://www.vesani.cz/detska-rohalovka/",
    regulations: "https://www.vesani.cz/propozice-deti/", registration: "https://www.vesani.cz/on-line-registrace/",
    description:
      "Children's MTB race on the morning of 1 May 2027 in Prusinovice, held alongside the adult RAAB FORCE Rohálovská 50ka. Fourteen separate classifications by birth year and gender, from 2013–2014 down to balance bikes (2024+). Lap 1.35 km, 35 m climbing; entry 100 CZK, balance bikes free. Online registration until 16 April 2027 (name on start number) or 27 April 2027; check-in at the Kulturní dům on 30 April 16:00–19:00 and on race day from 7:30; limit 280 children. Helmet mandatory except on balance bikes. Organisers: Holešovští pokalíšci and Vesani.cz.",
    categories: [
      ...pair("2013–2014", 2013, 2014, 5.4), ...pair("2015–2016", 2015, 2016, 4.05), ...pair("2017–2018", 2017, 2018, 2.7),
      ...pair("2019–2020", 2019, 2020, 1.35), ...pair("2021–2022 (short loop)", 2021, 2022), ...pair("2023 (around the pitch)", 2023, 2023),
      ...pair("2024+ (balance bikes)", 2024, 2027),
    ],
  },
  {
    name: "GARMIN Bratislavský MTB maratón", start: "2027-09-26", end: "2027-09-26", locationId: RACA,
    disciplines: ["xcm"], audience: "adults", ages: ["amateur", "masters"], eventType: "cup", level: "local",
    competitionType: "other", website: "https://bratislavskymtbmaraton.biker.sk/", seriesSlug: "bratislava-mtb-maraton",
    description:
      "MTB marathon in Bratislava-Rača (Župný pohár). The date, 26 September 2027, is listed in the BikePoint.sk calendar (organiser SPORTMEDIA); the organiser's own site still shows the 2026 edition, so route distances (the calendar lists 25, 50 and 80 km), categories, championship status and registration are not yet confirmed for 2027.",
    categories: [],
  },
];

async function findExisting(s: Spec) {
  const { data } = await supabase.from("events").select("id,name,start_date").eq("start_date", s.start).is("merged_into_id", null);
  return (data ?? []).find((e) => normalizeName(e.name as string) === normalizeName(s.name))?.id as string | undefined;
}

async function lock(id: string, fields: Record<string, unknown>) {
  const { data: ex } = await supabase.from("event_overrides").select("fields,locked_fields").eq("event_id", id).maybeSingle();
  const { error } = await supabase.from("event_overrides").upsert({
    event_id: id,
    fields: { ...((ex?.fields as object) ?? {}), ...fields } as Json,
    locked_fields: [...new Set([...((ex?.locked_fields as string[]) ?? []), ...Object.keys(fields)])],
    updated_by: BY,
  }, { onConflict: "event_id" });
  if (error) throw new Error(error.message);
}

async function main() {
  const now = new Date().toISOString();
  for (const s of SPECS) {
    let id = await findExisting(s);
    console.log(`${id ? "EXISTS" : "CREATE"} ${s.start} ${s.name}`);
    if (DRY) continue;
    const row = {
      name: s.name, name_normalized: normalizeName(s.name), start_date: s.start, end_date: s.end,
      disciplines: s.disciplines, formats: s.disciplines, age_categories: s.ages, audience: s.audience,
      status: "scheduled", visibility: "public", website_url: s.website, registration_url: s.registration ?? null,
      regulations_url: s.regulations ?? null, source_kind: "official", event_type: s.eventType,
      competition_type: s.competitionType, level: s.level, season: "2027", location_id: s.locationId,
      description: s.description, age_confidence: s.categories.length ? "explicit" : "previous", updated_at: now, last_seen_at: now,
    };
    if (!id) {
      const { data, error } = await supabase.from("events").insert({
        ...row, slug: slugifyEvent(s.name, s.start), created_at: now,
        fingerprint: fingerprint({ startDate: s.start, name: s.name }),
      }).select("id").single();
      if (error) throw new Error(`${s.name}: ${error.message}`);
      id = data.id as string;
      if (s.categories.length)
        await supabase.from("event_categories").insert(s.categories.map((c) => ({ ...c, event_id: id!, audience: c.audience ?? s.audience }))).then((r) => { if (r.error) throw new Error(r.error.message); });
    }
    if (s.seriesSlug) {
      const { data: ser } = await supabase.from("series").select("id").eq("slug", s.seriesSlug).single();
      await attachEventSeries(supabase, id, ser!.id as string, { primary: true, source: BY });
    }
    await lock(id, { name: s.name, start_date: s.start, end_date: s.end, location_id: s.locationId, website_url: s.website, disciplines: s.disciplines });
    console.log(`  id ${id} /cs/zavod/${slugifyEvent(s.name, s.start)}`);
  }

  // Leutkirch: existing public record; add the Kids Race note and protect it from re-ingestion.
  const LEUT = "cdbb887a-c103-41c4-b7c3-6dc7c57c3cf8";
  const desc =
    "City downhill in Leutkirch im Allgäu on Saturday 14 August 2027 (confirmed by the organiser). Registration is not yet open; details will follow on the organiser's site and Instagram. Last year's timed classes were U15, U17, U19, Elite and Masters for male and female riders, plus a Kids Race; whether a Kids Race takes place in 2027 and in what form is not yet announced. The 2027 classes and eligible birth years have yet to be published.";
  console.log("UPDATE Leutkirch", LEUT);
  if (!DRY) {
    const { error } = await supabase.from("events").update({ description: desc, updated_at: now, last_seen_at: now }).eq("id", LEUT);
    if (error) throw new Error(error.message);
    await lock(LEUT, { start_date: "2027-08-14", end_date: "2027-08-14", disciplines: ["dh"], website_url: "https://urban-downhill-leutkirch.de/" });
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

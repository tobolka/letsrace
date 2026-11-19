/**
 * 2026-11-19: Vulkan-Race Gedern 2027 (new) and the multisport clean-up.
 *  - Vulkan-Race Gedern 2027: organiser's home page announces 16-18 July 2027 and the German
 *    MTB XCC/XCO championships. The 90-minute Jedermann race, youth races and the Hessencup are
 *    NOT announced for 2027 yet (their pages still say 2026), so they are not created.
 *  - Eifeler Sparkassen Crossduathlon 2027 and Lorsbacher Cross-Duathlon 2026 are run-MTB-run
 *    multisport events, mislabelled xco: hidden and locked so imports cannot bring them back.
 *  - Gravelowa Korona Grudziadz: already 26-27 June 2027 (competit.pl confirms); only re-locks
 *    the date fields and asks for a public refresh.
 *
 * Usage: npx tsx scripts/seed-vulkan-gedern-2027-2026-11-19.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";
import type { Json } from "../src/lib/supabase/tables";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const DRY = process.argv.includes("--dry");
const BY = "owner-batch-2026-11-19";
const supabase = createServerSupabase();

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
  const GEDERN = "5851e9ac-4d33-4fb6-b9df-b33679b1ccaa";
  const name = "Vulkan-Race Gedern";
  const start = "2027-07-16", end = "2027-07-18";
  const { data: ex } = await supabase.from("events").select("id").eq("start_date", start).ilike("name", "%vulkan%race%gedern%").is("merged_into_id", null);
  let id = ex?.[0]?.id as string | undefined;
  console.log(id ? `EXISTS Vulkan ${id}` : "CREATE Vulkan");
  const description =
    "Mountain bike weekend in Gedern (Hessen), 16–18 July 2027, announced by the organisers as the German Mountain Bike Championships in XCC and XCO (TGV Schotten / HWG Gedern). Registration for 2027 is not published yet. Earlier editions also had a 90-minute Jedermann race for riders without a licence, youth races and MTB HessenCup rounds; none of these is confirmed for 2027 yet, so times, classes and entry links will follow once the organiser publishes them.";
  const row = {
    name, name_normalized: normalizeName(name), start_date: start, end_date: end,
    disciplines: ["xco", "xcc"], formats: ["xco", "xcc"], age_categories: [] as string[], audience: "mixed",
    status: "scheduled", visibility: "public", website_url: "https://vulkan-race-gedern.de/",
    source_kind: "official", event_type: "race", competition_type: "national_federation", level: "national",
    season: "2027", location_id: GEDERN, description, age_confidence: "default", updated_at: now, last_seen_at: now,
    timezone: "Europe/Berlin",
  };
  if (!DRY) {
    if (!id) {
      const { data, error } = await supabase.from("events").insert({
        ...row, slug: slugifyEvent(name, start), created_at: now, fingerprint: fingerprint({ startDate: start, name }),
      }).select("id").single();
      if (error) throw new Error(error.message);
      id = data.id as string;
    }
    await lock(id, { name, start_date: start, end_date: end, location_id: GEDERN, website_url: row.website_url, disciplines: row.disciplines, visibility: "public" });
    console.log(`  id ${id} /en/race/${slugifyEvent(name, start)}`);
  }

  // Multisport events: hide and lock.
  for (const eid of ["046fd101-6439-4e7c-8efc-8554691ffb79", "00417237-6699-4046-8ab3-dbeb62421075"]) {
    console.log("HIDE", eid);
    if (DRY) continue;
    const { error } = await supabase.from("events").update({ visibility: "hidden", event_type: "training", updated_at: now }).eq("id", eid);
    if (error) throw new Error(error.message);
    await lock(eid, { visibility: "hidden", event_type: "training" });
  }

  // Grudziadz: dates were already right; make them durable.
  const GRU = "d7ca6e90-8ff6-4ab5-a2b8-347b888b919d";
  console.log("LOCK Grudziadz dates", GRU);
  if (!DRY) {
    await lock(GRU, { start_date: "2027-06-26", end_date: "2027-06-27" });
    await supabase.from("events").update({ updated_at: now }).eq("id", GRU);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

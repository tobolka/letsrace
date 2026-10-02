/**
 * Pick the golden set: upcoming races the model would read, spread over
 * countries, with a site of their own. Writes tmp/golden-ids.txt.
 */
import { readFileSync, writeFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }
const QUOTA: Record<string, number> = { CZ: 8, DE: 8, IT: 7, PL: 6, AT: 5, CH: 4, NL: 2, BE: 2, SK: 2, FR: 2, GB: 2, ES: 2 };
const AGG = /rideandrest|odjazd|kalendarzrowerowy|sumator|eventivsport|radsport-events|granfondoguide|facebook|instagram/i;
async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const s = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await s.from("events").select("id, name, start_date, website_url, age_confidence, registration_url, regulations_url, location:locations(country_code)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", ["scheduled", "tbc", "confirmed"]).gte("start_date", today).not("website_url", "is", null).order("id").range(from, from + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick: any[] = [];
  for (const [c, n] of Object.entries(QUOTA)) {
    const pool = rows.filter((r) => r.location?.country_code === c && !AGG.test(r.website_url) && (r.age_confidence !== "explicit" || !r.registration_url || !r.regulations_url)).sort(() => rnd() - 0.5);
    pick.push(...pool.slice(0, n));
  }
  writeFileSync("tmp/golden-ids.txt", pick.map((r) => r.id).join(","));
  for (const r of pick) console.log(r.location?.country_code, r.start_date, r.name, r.website_url);
  console.log(pick.length);
}
main();

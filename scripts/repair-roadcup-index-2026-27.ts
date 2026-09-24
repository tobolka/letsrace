/** Hide two generic events incorrectly made from RoadCup season indexes. Dry by default. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";

try {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
} catch { /* Environment may already be loaded. */ }

const reviewed = [
  { id: "0bb8008e-74e5-4bb7-a769-352e74a19f93", name: "RoadCup 2026", date: "2026-09-12", year: "2026" },
  { id: "3102eff7-1bf5-4f06-b833-d96d054778ee", name: "RoadCup 2027", date: "2027-09-20", year: "2027" },
];

async function main() {
  const sb = createServerSupabase();
  for (const item of reviewed) {
    const { data: event, error } = await sb.from("events")
      .select("id,name,start_date,visibility,website_url")
      .eq("id", item.id).single();
    if (error || !event || event.name !== item.name || event.start_date !== item.date ||
        event.website_url !== `https://www.roadcycling.cz/roadcup/rocnik-${item.year}`) {
      throw new Error(`${item.id}: reviewed RoadCup index changed`);
    }
    console.log(`${event.start_date} ${event.name}: ${event.visibility} → hidden`);
    if (!process.argv.includes("--apply")) continue;
    const { error: updateError } = await sb.from("events")
      .update({ visibility: "hidden", updated_at: new Date().toISOString() })
      .eq("id", event.id);
    if (updateError) throw new Error(`${event.id}: ${updateError.message}`);
    const { error: lockError } = await sb.from("event_overrides").upsert({
      event_id: event.id, fields: { visibility: "hidden" }, locked_fields: ["visibility"],
      updated_by: "roadcup-season-index-2026-09-24", updated_at: new Date().toISOString(),
    }, { onConflict: "event_id" });
    if (lockError) throw new Error(`${event.id} override: ${lockError.message}`);
  }
  console.log(process.argv.includes("--apply") ? "Applied" : "Dry run only");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

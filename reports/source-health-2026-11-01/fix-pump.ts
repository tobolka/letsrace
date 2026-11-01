import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../../src/lib/supabase/server";
(async () => {
  const db = createServerSupabase();
  const id = "7ff0bc3f-f5fa-4eaf-ae05-225e37591344";
  const { data: ev } = await db.from("events").select("*").eq("id", id).single();
  console.log(JSON.stringify({ ...ev, search_text: undefined }));
  const { data: src } = await db.from("event_sources").select("*").eq("event_id", id);
  console.log(JSON.stringify(src));
  const { data: facts } = await db.from("event_facts").select("*").eq("event_id", id).order("created_at", { ascending: false }).limit(8);
  console.log(JSON.stringify(facts));
})();
(async () => {
  if (!process.argv.includes("--apply")) return;
  const db = createServerSupabase();
  const id = "7ff0bc3f-f5fa-4eaf-ae05-225e37591344";
  const { error } = await db.from("events").update({
    start_date: "2026-04-26", end_date: "2026-04-26",
    fingerprint: "2026-04-26:u2fz1:severocesky pumptrackovy pohar", visibility: "public", updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error(error.message);
  const { data } = await db.from("events").select("start_date,end_date,visibility,fingerprint").eq("id", id).single();
  console.log("after", data);
  await db.from("event_facts").insert([
    { event_id: id, field: "start_date", value: "2026-04-26", previous: "2025-04-26", source_url: "https://portal.czechcyclingfederation.com/RaceDetail/Race/1695", method: "manual_fix_2026-11-01", version: "pipeline-v2", status: "active", quote: "Federation lists start 2026-04-26; its end year 2025 is a typo (same day, same place as the Dětský MTB Cup Sobotka)." },
  ]);
})();

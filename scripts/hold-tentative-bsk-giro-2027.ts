/** Keep an aggregator's explicitly tentative 2027 date out of the public calendar. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";

try {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
} catch { /* Environment may already be loaded. */ }

async function main() {
  const sb = createServerSupabase();
  const id = "d5c4d3da-81a5-4fbb-a933-91cb3e46a82b";
  const { data: event, error } = await sb.from("events")
    .select("id,name,start_date,status,visibility")
    .eq("id", id).single();
  if (error || event?.name !== "BSK Giro Pičín (připravuje se)" ||
      event.start_date !== "2027-06-20") {
    throw new Error("Reviewed BSK Giro row changed; check the official calendar");
  }
  console.log(`${event.name}: ${event.status}/${event.visibility} → tbc/hidden`);
  if (!process.argv.includes("--apply")) return console.log("Dry run only");
  const { error: updateError } = await sb.from("events")
    .update({ status: "tbc", visibility: "hidden", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);
  const { error: lockError } = await sb.from("event_overrides").upsert({
    event_id: id, fields: { status: "tbc", visibility: "hidden" },
    locked_fields: ["status", "visibility"], updated_by: "tentative-2027-review",
    updated_at: new Date().toISOString(),
  }, { onConflict: "event_id" });
  if (lockError) throw new Error(lockError.message);
  console.log("Applied; unlock only after the organiser confirms the date");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

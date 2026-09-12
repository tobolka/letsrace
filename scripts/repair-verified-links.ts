/** Verified 2026-09-11 against the organizer pages below. Dry-run by default. */
import { config } from "dotenv";
import { createServerSupabase, hasServiceRole } from "../src/lib/supabase/server";

config({ path: ".env.local", quiet: true });
const apply = process.argv.includes("--apply");
const repairs = [
  { id: "2a7bc6fa-ac57-4322-be11-dc4d02b2b09a", date: "2026-09-13", url: "https://www.stupavskymaraton.sk/inpage/junior-mtb/" },
  { id: "70c5f6d4-53d4-40b0-bc74-a80459e305b8", date: "2026-09-19", url: "https://3xkolemkalicha.webnode.cz/" },
  { id: "5249eede-a0de-4cb7-bf56-eeb9e5adfb4a", date: "2026-10-11", url: "https://www.enduroseria.sk/" },
];

async function main() {
  if (apply && !hasServiceRole()) throw new Error("Service role required for catalog repair");
  const db = createServerSupabase();
  for (const repair of repairs) {
    const { data, error } = await db.from("events")
      .select("id,name,start_date,website_url")
      .eq("id", repair.id).single();
    if (error) throw error;
    if (data.start_date !== repair.date) throw new Error(`Date changed: ${repair.id}`);
    if (data.website_url) {
      console.log(`Already linked: ${data.name}`);
      continue;
    }
    const { data: overrides, error: lockError } = await db.from("event_overrides").select("locked_fields").eq("event_id", repair.id);
    if (lockError) throw lockError;
    if ((overrides ?? []).some((o) => o.locked_fields?.includes("website_url"))) {
      console.log(`Locked, skipped: ${data.name}`);
      continue;
    }
    if (apply) {
      const { data: changed, error: updateError } = await db.from("events")
        .update({ website_url: repair.url })
        .eq("id", repair.id).eq("start_date", repair.date).is("website_url", null)
        .select("id,website_url").single();
      if (updateError || changed?.website_url !== repair.url) throw updateError ?? new Error("Repair not confirmed");
    }
    console.log(`${apply ? "Linked" : "Would link"}: ${data.name} → ${repair.url}`);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

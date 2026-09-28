/**
 * Pražský MTB pohár 2026 lists four rounds on prahamtb.cz, but two aggregator
 * rows sat beside them in the series: "Memoriál Petra Marka" (the 2. kolo's
 * subtitle, same day and venue) and "Finálový závod" (the 4. kolo weekend).
 * Detach and hide them, and lock that so the next ingest can't bring them back.
 *
 * Usage: npx tsx scripts/hide-prazsky-extra-rows-2026-09-28.ts [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";

try {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
} catch {
  /* Environment may already be loaded. */
}

const UPDATED_BY = "prazsky extra rows 2026-09-28";
const SERIES_ID = "c9988946-7c2a-44c9-b569-3b346bbf5891"; // prazsky-mtb-pohar

/** Reviewed rows: id → the name and day they must still have. */
const ROWS = [
  { id: "76632a32-f685-41ff-af9c-2bbe76a6bd08", name: "Memoriál Petra Marka", start: "2026-04-12" },
  { id: "8d418bfd-0924-44f8-aeaa-7d7f804f819f", name: "Finálový závod", start: "2026-05-17" },
];

async function main() {
  const sb = createServerSupabase();
  const apply = process.argv.includes("--apply");
  const now = new Date().toISOString();

  for (const row of ROWS) {
    const { data: event, error } = await sb
      .from("events")
      .select("id,name,start_date,series_id,status,visibility")
      .eq("id", row.id)
      .single();
    if (error || event?.name !== row.name || event.start_date !== row.start) {
      throw new Error(`Reviewed row ${row.id} changed; check it again`);
    }
    console.log(`${event.start_date} ${event.name}: ${event.status}/${event.visibility} → hidden, no series`);
    if (!apply) continue;

    const { error: updateError } = await sb
      .from("events")
      .update({ series_id: null, status: "hidden", visibility: "hidden", updated_at: now })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);

    const { error: memberError } = await sb
      .from("event_series")
      .delete()
      .eq("event_id", row.id)
      .eq("series_id", SERIES_ID);
    if (memberError) throw new Error(memberError.message);

    const { data: existing } = await sb
      .from("event_overrides")
      .select("fields,locked_fields")
      .eq("event_id", row.id)
      .maybeSingle();
    const fields = { series_id: null, status: "hidden", visibility: "hidden" };
    const { error: lockError } = await sb.from("event_overrides").upsert(
      {
        event_id: row.id,
        fields: { ...((existing?.fields as Record<string, unknown>) ?? {}), ...fields },
        locked_fields: [
          ...new Set([...((existing?.locked_fields as string[]) ?? []), ...Object.keys(fields)]),
        ],
        updated_by: UPDATED_BY,
        updated_at: now,
      },
      { onConflict: "event_id" },
    );
    if (lockError) throw new Error(lockError.message);
  }
  console.log(apply ? "Applied" : "Dry run only; pass --apply");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

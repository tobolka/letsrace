/**
 * Take hall cycling (cycle-ball, artistic cycling) out of the public catalogue.
 *
 * The importers reject it now (`isIndoorCycling` in the sport gate); this
 * hides what came in before that, and locks the field so a later read of the
 * same source cannot publish it again. Series made only of such races go too.
 *
 *   npx tsx scripts/hide-indoor-cycling.ts --dry
 *   npx tsx scripts/hide-indoor-cycling.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Json } from "../src/lib/supabase/tables";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

const DRY = process.argv.includes("--dry");
const BY = "hide-indoor-cycling 2026-11-09";

async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { isIndoorCycling } = await import("../src/lib/sport-gate");
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  const { data: series, error: seriesError } = await supabase
    .from("series")
    .select("id,name,visibility")
    .neq("visibility", "hidden");
  if (seriesError) throw new Error(seriesError.message);
  const indoorSeries = (series ?? []).filter((s) => isIndoorCycling(s.name as string));
  const indoorSeriesIds = new Set(indoorSeries.map((s) => s.id as string));

  const rows: { id: string; name: string; series_id: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select("id,name,series_id")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const indoor = rows.filter((e) => isIndoorCycling(e.name) || (e.series_id && indoorSeriesIds.has(e.series_id)));

  for (const e of indoor) {
    console.log(`hide race "${e.name}"`);
    if (DRY) continue;
    const { error } = await supabase.from("events").update({ visibility: "hidden", updated_at: now }).eq("id", e.id);
    if (error) throw new Error(error.message);
    const { data: existing } = await supabase
      .from("event_overrides")
      .select("fields,locked_fields")
      .eq("event_id", e.id)
      .maybeSingle();
    const fields = { ...((existing?.fields as Record<string, unknown>) ?? {}), visibility: "hidden" };
    const locked = [...new Set([...((existing?.locked_fields as string[]) ?? []), "visibility"])];
    const { error: lockError } = await supabase
      .from("event_overrides")
      .upsert({ event_id: e.id, fields: fields as Json, locked_fields: locked, updated_by: BY }, { onConflict: "event_id" });
    if (lockError) throw new Error(lockError.message);
  }

  for (const s of indoorSeries) {
    console.log(`hide series "${s.name}"`);
    if (DRY) continue;
    const { error } = await supabase.from("series").update({ visibility: "hidden", updated_at: now }).eq("id", s.id);
    if (error) throw new Error(error.message);
  }
  console.log(`${DRY ? "would hide" : "hid"} ${indoor.length} races, ${indoorSeries.length} series`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

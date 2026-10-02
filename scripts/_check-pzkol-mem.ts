import { readFileSync } from "fs";
import { resolve } from "path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../src/lib/supabase/server";

async function main() {
  const sb = createServerSupabase();
  const { data: series } = await sb
    .from("series")
    .select("id,slug")
    .in("slug", [
      "puchar-polski-w-maratonie-mtb-xcm",
      "puchar-polski-pumptrack",
      "puchar-polski-w-kolarstwie-szosowym",
      "puchar-polski-w-kolarstwie-prze-ajowym-2026-27",
      "super-puchar-polski-cx-2026-27",
    ]);
  const ids = (series || []).map((s) => s.id);
  const { data: mem } = await sb
    .from("event_series")
    .select("source, is_primary, series_id")
    .in("series_id", ids)
    .limit(5000);
  const bySource: Record<string, number> = {};
  const bySeriesPrimary: Record<string, { p: number; s: number }> = {};
  for (const m of mem || []) {
    bySource[m.source || "?"] = (bySource[m.source || "?"] || 0) + 1;
    const slug = series!.find((s) => s.id === m.series_id)?.slug || "?";
    if (!bySeriesPrimary[slug]) bySeriesPrimary[slug] = { p: 0, s: 0 };
    if (m.is_primary) bySeriesPrimary[slug].p++;
    else bySeriesPrimary[slug].s++;
  }
  console.log("bySource", bySource);
  console.log("bySeriesPrimary", bySeriesPrimary);

  // sample event names for maraton primary
  const maraton = series!.find((s) => s.slug === "puchar-polski-w-maratonie-mtb-xcm")!;
  const { data: evs } = await sb
    .from("events")
    .select("id,name,start_date,website_url,source_url")
    .eq("series_id", maraton.id)
    .is("merged_into_id", null)
    .order("start_date")
    .limit(15);
  console.log("sample maraton primaries:");
  for (const e of evs || []) console.log(`  ${e.start_date} ${e.name} | ${(e.website_url || e.source_url || "").slice(0, 60)}`);
}
main();

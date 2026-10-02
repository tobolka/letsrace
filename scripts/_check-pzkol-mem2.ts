import { readFileSync } from "fs";
import { resolve } from "path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../src/lib/supabase/server";

async function main() {
  const sb = createServerSupabase();
  const { data: maraton } = await sb
    .from("series")
    .select("id")
    .eq("slug", "puchar-polski-w-maratonie-mtb-xcm")
    .single();
  const { data: links } = await sb
    .from("event_series")
    .select("event_id, is_primary, source")
    .eq("series_id", maraton!.id)
    .limit(5);
  console.log("links", links);
  if (links?.[0]) {
    const { data: ev } = await sb
      .from("events")
      .select("id,name,start_date,series_id,website_url,source_url")
      .eq("id", links[0].event_id)
      .maybeSingle();
    console.log("event", ev);
  }
  const { count: withSeries } = await sb
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("series_id", maraton!.id);
  console.log("events.series_id count", withSeries);

  // How many csv-regional memberships total?
  const { count: csvMem } = await sb
    .from("event_series")
    .select("*", { count: "exact", head: true })
    .eq("source", "csv-regional");
  console.log("csv-regional memberships", csvMem);
}
main();

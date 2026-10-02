import { readFileSync } from "fs";
import { resolve } from "path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../src/lib/supabase/server";

async function main() {
  const sb = createServerSupabase();
  const slugs = [
    "puchar-polski-w-maratonie-mtb-xcm",
    "puchar-polski-pumptrack",
    "puchar-polski-w-kolarstwie-szosowym",
    "puchar-polski-w-kolarstwie-prze-ajowym-2026-27",
    "super-puchar-polski-cx-2026-27",
    "spdh",
    "slovensky-pohar-xco",
    "slovensky-pohar-mtb-xc",
    "xco-nrw-cup",
  ];
  const { data: series } = await sb.from("series").select("id,slug,name").in("slug", slugs);
  for (const s of series || []) {
    const { count: mem } = await sb
      .from("event_series")
      .select("*", { count: "exact", head: true })
      .eq("series_id", s.id);
    const { count: primary } = await sb
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("series_id", s.id)
      .is("merged_into_id", null);
    console.log(`${s.slug}: primary=${primary} membership=${mem} name=${s.name}`);
  }

  // Does slovensky-pohar-xco exist?
  const { data: xco } = await sb.from("series").select("id,slug,name,website_url").eq("slug", "slovensky-pohar-xco");
  console.log("slovensky-pohar-xco", xco);

  const { data: schnee } = await sb.from("series").select("id,slug,name,website_url").ilike("slug", "%schneef%");
  console.log("schneef", schnee);

  const { data: nrw } = await sb.from("series").select("id,slug,name,website_url").ilike("name", "%NRW%");
  console.log("nrw", nrw);
}
main();

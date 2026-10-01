/**
 * Stated categories that were only an audience hint ("a kids' series") back
 * to a guess, so the readers may look for the real list.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/demote-audience-ages.ts [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { inferAgeCategories } = await import("../src/lib/taxonomy");
  const supabase = createServerSupabase();
  const apply = process.argv.includes("--apply");
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("events")
    .select("id, name, start_date, age_categories, series:series!events_series_id_fkey(name, age_categories_confirmed_at), sources:event_sources(source_url)")
    .eq("age_confidence", "explicit")
    .is("merged_into_id", null)
    .gte("start_date", today)
    .limit(5000);
  const ids: string[] = [];
  for (const e of (data ?? []) as unknown as {
    id: string;
    name: string;
    start_date: string;
    age_categories: string[];
    series: { name: string; age_categories_confirmed_at: string | null } | null;
    sources: { source_url: string | null }[] | null;
  }[]) {
    // Only where the hint came from: the hynekmusil adapter's series audience.
    // A federation page that says "giovanissimi" did state it.
    if (!(e.sources ?? []).some((s) => /hynekmusil\.cz/i.test(s.source_url ?? ""))) continue;
    const ages = e.age_categories ?? [];
    if (!ages.length || ages.some((a) => a !== "kids" && a !== "youth")) continue;
    if (e.series?.age_categories_confirmed_at) continue;
    if (inferAgeCategories(`${e.name} ${e.series?.name ?? ""}`).length) continue;
    ids.push(e.id);
    console.log(`${apply ? "FIX" : "DRY"}  ${e.start_date}  ${e.name}  [${ages.join(",")}]`);
  }
  if (apply && ids.length) {
    for (let i = 0; i < ids.length; i += 100) {
      await supabase.from("events").update({ age_confidence: "default" }).in("id", ids.slice(i, i + 100));
      await supabase.from("catalog_probes").delete().in("event_id", ids.slice(i, i + 100));
    }
  }
  console.log({ demoted: ids.length, dry: !apply });
}

main();

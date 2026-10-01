/**
 * U13 is youth now, not kids: rows whose "kids" came only from U13 lose it.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/regroup-u13.ts [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { AGE_CATEGORIES, audienceFromAgeCategories } = await import("../src/lib/taxonomy");
  type Age = (typeof AGE_CATEGORIES)[number];
  const supabase = createServerSupabase();
  const apply = process.argv.includes("--apply");
  const regroup = (ages: string[]): Age[] | null => {
    if (!ages.includes("u13") || !ages.includes("kids")) return null;
    if (ages.some((a) => a === "u7" || a === "u9" || a === "u11")) return null;
    const next = new Set(ages.filter((a) => a !== "kids"));
    next.add("youth");
    return AGE_CATEGORIES.filter((a) => next.has(a));
  };
  let events = 0;
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("events")
      .select("id, age_categories")
      .contains("age_categories", ["u13", "kids"])
      .range(from, from + 999);
    for (const e of (data ?? []) as { id: string; age_categories: string[] }[]) {
      const next = regroup(e.age_categories);
      if (!next) continue;
      events += 1;
      if (apply) {
        await supabase
          .from("events")
          .update({ age_categories: next, audience: audienceFromAgeCategories(next) })
          .eq("id", e.id);
      }
    }
    if (!data || data.length < 1000) break;
  }
  const { data: series } = await supabase.from("series").select("id, age_categories").contains("age_categories", ["u13", "kids"]);
  let seriesCount = 0;
  for (const s of (series ?? []) as { id: string; age_categories: string[] }[]) {
    const next = regroup(s.age_categories);
    if (!next) continue;
    seriesCount += 1;
    if (apply) await supabase.from("series").update({ age_categories: next }).eq("id", s.id);
  }
  console.log({ events, series: seriesCount, dry: !apply });
}

main();

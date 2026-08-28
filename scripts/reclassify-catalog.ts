/**
 * Re-run the classifier over the whole catalog and correct rows that the old
 * blob-regex version got wrong.
 *
 * Three things move: events that are not bike races at all get hidden, inflated
 * race levels come back down, and age categories that were guessed get replaced
 * by the ones the name actually states. Locked fields are never touched — an
 * admin edit outranks anything inferred here.
 *
 * Usage:
 *   nvm use 22 && npx tsx scripts/reclassify-catalog.ts --dry
 *   nvm use 22 && npx tsx scripts/reclassify-catalog.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { inferClassification, audienceFromAgeCategories, type AgeCategory } from "../src/lib/taxonomy";
import { isNonCyclingEventName } from "../src/lib/sport-gate";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may already be set */
  }
}
loadEnv();

const DRY = process.argv.includes("--dry");

type Row = {
  id: string;
  name: string;
  start_date: string;
  disciplines: string[] | null;
  age_categories: string[] | null;
  audience: string | null;
  level: string | null;
  class_label: string | null;
  uci_class: string | null;
  visibility: string | null;
  event_type: string | null;
  series: { name?: string; slug?: string } | { name?: string; slug?: string }[] | null;
  locations: { municipality?: string; country_code?: string } | { municipality?: string; country_code?: string }[] | null;
  overrides: { locked_fields?: string[] }[] | null;
  categories: { name: string }[] | null;
};

const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function main() {
  const supabase = createServerSupabase();
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id,name,start_date,disciplines,age_categories,audience,level,class_label,uci_class,visibility,event_type," +
          "series(name,slug),locations(municipality,country_code),overrides:event_overrides(locked_fields),categories:event_categories(name)",
      )
      .order("start_date")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  console.log(`loaded ${rows.length} events${DRY ? " (dry run)" : ""}`);

  const stats = { hidden: 0, level: 0, ages: 0, disciplines: 0, skippedLocked: 0, errors: 0 };
  const levelMoves: string[] = [];

  for (const row of rows) {
    const locked = new Set(row.overrides?.[0]?.locked_fields ?? []);
    const series = one(row.series);
    const loc = one(row.locations);
    const categoryNames = (row.categories ?? []).map((c) => c.name);

    // The source's own words only — our stored disciplines are the guess under review.
    const nonCycling = isNonCyclingEventName(row.name, categoryNames.join(" "));

    const classified = inferClassification({
      name: row.name,
      placeText: loc?.municipality,
      seriesName: series?.name,
      seriesSlug: series?.slug,
      disciplines: row.disciplines,
      categoryNames,
      existingLevel: row.level,
      existingClassLabel: row.class_label,
      existingAudience: row.audience,
      startDate: row.start_date,
      countryHint: loc?.country_code,
    });

    const patch: Record<string, unknown> = {};

    if (nonCycling && row.visibility !== "hidden" && !locked.has("visibility")) {
      patch.visibility = "hidden";
      stats.hidden += 1;
    }

    if (
      classified.levelReason !== "default" &&
      classified.level !== row.level &&
      !locked.has("level")
    ) {
      patch.level = classified.level;
      patch.class_label = classified.classLabel;
      levelMoves.push(`${row.level} -> ${classified.level} [${classified.levelReason}] ${row.name.slice(0, 50)}`);
      stats.level += 1;
    }

    // Only evidence replaces stored ages; a default must not overwrite anything.
    if (
      classified.ageConfidence === "explicit" &&
      !locked.has("age_categories") &&
      JSON.stringify(classified.ageCategories) !== JSON.stringify(row.age_categories ?? [])
    ) {
      patch.age_categories = classified.ageCategories;
      patch.audience = audienceFromAgeCategories(classified.ageCategories as AgeCategory[]);
      stats.ages += 1;
    }

    if (!Object.keys(patch).length) continue;
    if (locked.size) stats.skippedLocked += 1;
    if (DRY) continue;

    patch.updated_at = new Date().toISOString();
    const { error } = await supabase.from("events").update(patch).eq("id", row.id);
    if (error) {
      stats.errors += 1;
      console.error(`  ! ${row.name.slice(0, 40)}: ${error.message}`);
    }
  }

  console.log("\nlevel corrections (first 40):");
  levelMoves.slice(0, 40).forEach((l) => console.log("  ", l));
  console.log("\n", stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

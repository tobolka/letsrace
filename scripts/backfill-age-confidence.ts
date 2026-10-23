/**
 * Backfill events.age_confidence — where each race's age categories came from.
 *
 *   npx tsx scripts/backfill-age-confidence.ts          # dry run: counts only
 *   npx tsx scripts/backfill-age-confidence.ts --apply  # write the column
 *
 * The categories were stored for years without saying whether a source stated
 * them or a heuristic guessed. This re-runs the classifier on each race's own
 * name and series, with nothing but the text:
 *
 *  - a category token in the name ("Dětský pohár", "U11") → explicit;
 *  - the stored set equals what the level/discipline default would give, or
 *    the series' own set it was copied from → default (a guess);
 *  - anything else can only have come from a source's category list → explicit.
 *
 * Only writes age_confidence; the categories themselves are untouched.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../src/lib/supabase/server";
import { readAllRows } from "../src/lib/supabase/read-all";
import { inferClassification } from "../src/lib/taxonomy";

type Row = {
  id: string;
  name: string;
  start_date: string;
  age_categories: string[] | null;
  age_confidence: string | null;
  disciplines: string[] | null;
  level: string | null;
  class_label: string | null;
  series: SeriesRef | SeriesRef[] | null;
};
type SeriesRef = { name: string | null; slug: string | null; age_categories: string[] | null };

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

async function main() {
  const apply = process.argv.includes("--apply");
  const supabase = createServerSupabase();
  const rows = await readAllRows<Row>((from, to) =>
    supabase
      .from("events")
      .select(
        "id, name, start_date, age_categories, age_confidence, disciplines, level, class_label, series:series!events_series_id_fkey(name, slug, age_categories)",
      )
      .not("age_categories", "is", null)
      .filter("age_categories", "neq", "{}")
      .order("id", { ascending: true })
      .range(from, to),
  );

  const decided = { explicit: [] as string[], default: [] as string[] };
  const why = { name: 0, heuristic: 0, series: 0, source: 0 };
  for (const r of rows) {
    const stored = r.age_categories ?? [];
    if (!stored.length) continue;
    const series = Array.isArray(r.series) ? r.series[0] : r.series;
    const c = inferClassification({
      name: r.name,
      seriesName: series?.name,
      seriesSlug: series?.slug,
      disciplines: r.disciplines,
      existingLevel: r.level,
      existingClassLabel: r.class_label,
      startDate: r.start_date,
    });
    let conf: "explicit" | "default";
    if (c.ageConfidence === "explicit") {
      conf = "explicit";
      why.name += 1;
    } else if (c.ageCategories.length && same(stored, c.ageCategories)) {
      conf = "default";
      why.heuristic += 1;
    } else if ((series?.age_categories ?? []).length && same(stored, series!.age_categories!)) {
      conf = "default";
      why.series += 1;
    } else {
      conf = "explicit";
      why.source += 1;
    }
    if (r.age_confidence !== conf) decided[conf].push(r.id);
  }

  console.log(`rows with categories: ${rows.length}`);
  console.log(`explicit — name token: ${why.name}, source list: ${why.source}`);
  console.log(`default  — heuristic: ${why.heuristic}, copied from series: ${why.series}`);
  console.log(`to write: explicit ${decided.explicit.length}, default ${decided.default.length}`);
  if (!apply) {
    console.log("dry run — pass --apply to write");
    return;
  }
  for (const conf of ["explicit", "default"] as const) {
    const ids = decided[conf];
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from("events").update({ age_confidence: conf }).in("id", ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
  }
  console.log("written");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

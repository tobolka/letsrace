import { createServerSupabase } from "@/lib/supabase/server";
import { audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import { fciCategoryLine, parseFciCategories } from "@/lib/watcher/extractors/fci-categories";

/**
 * Fill Italian age categories from the page that states them.
 *
 * Most races with no categories cannot be filled from anything we hold — the
 * name says nothing and guessing would put "kids" on a race no child may
 * enter. The Italian federation is the exception: every race page carries a
 * "Categorie ammesse" line in the organiser's own words.
 *
 * The calendar the watcher follows does not carry that line, only the per-race
 * page does, so this fetches them one at a time and is deliberately bounded.
 * Forty a run, three runs a day, is enough to keep up with a federation that
 * adds a few hundred races a season without turning the hygiene job into a
 * crawler.
 */
export async function fillFciAgeCategories(opts?: {
  max?: number;
  delayMs?: number;
}): Promise<{ attempted: number; filled: number; silent: number; failed: number }> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 40;
  const delayMs = opts?.delayMs ?? 400;
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("events")
    .select("id, age_categories, sources:event_sources(source_url)")
    .eq("visibility", "public")
    .in("status", ["scheduled", "tbc", "postponed", "registration_open"])
    .gte("start_date", today)
    .or("age_categories.is.null,age_categories.eq.{}")
    .order("start_date", { ascending: true })
    .limit(600);

  const rows = (data ?? []) as unknown as {
    id: string;
    sources: { source_url: string | null }[] | null;
  }[];

  const targets: { id: string; url: string }[] = [];
  for (const row of rows) {
    const url = (row.sources ?? [])
      .map((s) => s.source_url ?? "")
      .find((u) => /members\.federciclismo\.it\/race\/detail\/\d+/.test(u));
    if (url) targets.push({ id: row.id, url });
    if (targets.length >= max) break;
  }

  const result = { attempted: targets.length, filled: 0, silent: 0, failed: 0 };
  for (const target of targets) {
    try {
      const res = await fetch(target.url, {
        headers: { "user-agent": "letsrace-catalog/1.0 (+https://letsrace.cz)" },
      });
      if (!res.ok) {
        result.failed += 1;
        continue;
      }
      const ages = parseFciCategories(fciCategoryLine(await res.text()));
      if (!ages.length) {
        result.silent += 1;
        continue;
      }
      const { error } = await supabase
        .from("events")
        .update({
          age_categories: ages,
          audience: audienceFromAgeCategories(ages as AgeCategory[]),
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id);
      if (error) result.failed += 1;
      else result.filled += 1;
    } catch {
      result.failed += 1;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return result;
}

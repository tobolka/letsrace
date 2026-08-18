import { createServerSupabase } from "@/lib/supabase/server";
import {
  audienceFromAgeCategories,
  inferClassification,
  type AgeCategory,
} from "@/lib/taxonomy";

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

type SeriesInfo = {
  name: string | null;
  slug: string | null;
  age_categories?: string[] | null;
  audience_hint?: string | null;
};

type EventRow = {
  id: string;
  name: string;
  start_date?: string;
  audience: string | null;
  age_categories: string[] | null;
  level: string | null;
  class_label: string | null;
  disciplines: string[] | null;
  series: SeriesInfo | SeriesInfo[] | null;
};

function seriesOf(row: EventRow) {
  const raw = row.series;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function emptyAges(cats: string[] | null | undefined): boolean {
  return !(cats ?? []).length;
}

export async function fillEmptyAgeCategories(opts?: {
  maxEvents?: number;
  upcomingOnly?: boolean;
}): Promise<{ eventsFilled: number; seriesFilled: number; stillUnknown: number }> {
  const supabase = createServerSupabase();
  const maxEvents = opts?.maxEvents ?? 400;
  const upcomingOnly = opts?.upcomingOnly ?? true;
  const now = new Date().toISOString();

  const { data: seriesRows } = await supabase
    .from("series")
    .select("id, name, slug, age_categories, audience_hint, level")
    .eq("visibility", "public")
    .or("age_categories.is.null,age_categories.eq.{}")
    .limit(400);

  let seriesFilled = 0;
  for (const s of seriesRows ?? []) {
    if (!emptyAges(s.age_categories as string[] | null)) continue;
    const classified = inferClassification({
      name: s.name as string,
      seriesName: s.name as string,
      seriesSlug: s.slug as string,
      existingLevel: s.level as string | null,
      existingAudience: s.audience_hint as string | null,
    });
    if (!classified.ageCategories.length) continue;
    const { error } = await supabase
      .from("series")
      .update({
        age_categories: classified.ageCategories,
        audience_hint: classified.audience,
        updated_at: now,
      })
      .eq("id", s.id);
    if (!error) seriesFilled += 1;
  }

  let query = supabase
    .from("events")
    .select(
      "id, name, start_date, audience, age_categories, level, class_label, disciplines, series:series(name, slug, age_categories, audience_hint)",
    )
    .eq("visibility", "public")
    .in("status", ["scheduled", "tbc", "postponed", "registration_open"])
    .or("age_categories.is.null,age_categories.eq.{}")
    .order("start_date", { ascending: true })
    .limit(maxEvents);
  if (upcomingOnly) query = query.gte("start_date", todayIso());

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const patches: { id: string; age_categories: string[]; audience: string }[] = [];
  let stillUnknown = 0;
  for (const row of (rows ?? []) as unknown as EventRow[]) {
    if (!emptyAges(row.age_categories)) continue;

    const series = seriesOf(row);
    const seriesAges = (series?.age_categories ?? []).filter(Boolean);
    if (seriesAges.length) {
      patches.push({
        id: row.id,
        age_categories: seriesAges,
        audience:
          series?.audience_hint ||
          audienceFromAgeCategories(seriesAges as AgeCategory[]),
      });
      continue;
    }

    const classified = inferClassification({
      name: row.name,
      seriesName: series?.name,
      seriesSlug: series?.slug,
      disciplines: row.disciplines,
      existingLevel: row.level,
      existingClassLabel: row.class_label,
      existingAudience: row.audience,
      startDate: row.start_date,
    });
    if (!classified.ageCategories.length) {
      stillUnknown += 1;
      continue;
    }
    patches.push({
      id: row.id,
      age_categories: classified.ageCategories,
      audience: classified.audience,
    });
  }

  const { mapPool } = await import("@/lib/watcher/pool");
  const results = await mapPool(patches, 8, async (patch) => {
    const { error: upErr } = await supabase
      .from("events")
      .update({
        age_categories: patch.age_categories,
        audience: patch.audience,
        updated_at: now,
      })
      .eq("id", patch.id);
    return !upErr;
  });
  const eventsFilled = results.filter(Boolean).length;
  stillUnknown += results.length - eventsFilled;

  return { eventsFilled, seriesFilled, stillUnknown };
}

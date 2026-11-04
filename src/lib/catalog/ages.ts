import { createServerSupabase } from "@/lib/supabase/server";
import {
  audienceFromAgeCategories,
  inferClassification,
  type AgeCategory,
} from "@/lib/taxonomy";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

type SeriesInfo = {
  id: string;
  updated_at: string;
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

  const { data: seriesRows, error: seriesError } = await supabase
    .from("series")
    .select("id, name, slug, age_categories, audience_hint, level, updated_at")
    .eq("visibility", "public")
    .or("age_categories.is.null,age_categories.eq.{}")
    .limit(400);

  if (seriesError) throw seriesError;
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
    const { data: updated, error } = await supabase
      .from("series")
      .update({
        age_categories: classified.ageCategories,
        audience_hint: classified.audience,
        updated_at: now,
      })
      .eq("id", s.id).eq("updated_at", s.updated_at).eq("visibility", "public")
      .or("age_categories.is.null,age_categories.eq.{}").is("age_categories_confirmed_at", null).select("id");
    if (error) throw error;
    if (updated?.length) seriesFilled += 1;
  }

  let query = supabase
    .from("events")
    .select(
      "id, public_revision, name, start_date, audience, age_categories, level, class_label, disciplines, series:series!events_series_id_fkey(id, updated_at, name, slug, age_categories, audience_hint)",
    )
    .eq("visibility", "public")
    .in("status", [...ACTIVE_EVENT_STATUSES])
    .or("age_categories.is.null,age_categories.eq.{}")
    .order("start_date", { ascending: true })
    .limit(maxEvents);
  if (upcomingOnly) query = query.gte("start_date", todayIso());

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const patches: {
    id: string;
    revision: string;
    series: SeriesInfo | null;
    age_categories: string[];
    audience: string;
    age_confidence: "explicit" | "default";
  }[] = [];
  let stillUnknown = 0;
  for (const row of rows ?? []) {
    if (!emptyAges(row.age_categories)) continue;

    const series = seriesOf(row);
    const seriesAges = (series?.age_categories ?? []).filter(Boolean);
    if (seriesAges.length) {
      patches.push({
        id: row.id,
        revision: row.public_revision,
        series,
        age_categories: seriesAges,
        audience:
          series?.audience_hint ||
          audienceFromAgeCategories(seriesAges as AgeCategory[]),
        // Borrowed from the series, whose own set may itself be a guess.
        age_confidence: "default",
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
      revision: row.public_revision,
      series,
      age_categories: classified.ageCategories,
      audience: classified.audience,
      age_confidence: classified.ageConfidence === "explicit" ? "explicit" : "default",
    });
  }

  const { mapPool } = await import("@/lib/watcher/pool");
  const results = await mapPool(patches, 8, async (patch) => {
    const { data, error } = await supabase.rpc("pipeline_apply_catalogue_age_read", {
      p_event: patch.id, p_revision: patch.revision,
      p_patch: { age_categories: patch.age_categories, audience: patch.audience, age_confidence: patch.age_confidence },
      p_method: "catalogue_age_inference", p_version: "atomic-v1",
      p_quote: patch.series ? "Inferred from the race and its primary series metadata." : "Inferred from catalogue race metadata.",
      p_series: patch.series?.id, p_series_updated_at: patch.series?.updated_at,
    });
    return !error && Boolean(data);
  });
  const eventsFilled = results.filter(Boolean).length;
  stillUnknown += results.length - eventsFilled;

  return { eventsFilled, seriesFilled, stillUnknown };
}

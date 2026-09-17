/**
 * Many-to-many membership of a race in series.
 *
 * `events.series_id` is the primary badge (UI, explore default). Additional
 * series that also count the same race live in `event_series`.
 */
import type { createServerSupabase } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServerSupabase>;

export async function attachEventSeries(
  supabase: Supabase,
  eventId: string,
  seriesId: string,
  opts?: { primary?: boolean; source?: string },
): Promise<void> {
  const primary = opts?.primary ?? false;
  const source = opts?.source ?? "watcher";
  const now = new Date().toISOString();

  if (primary) {
    await supabase
      .from("event_series")
      .update({ is_primary: false, updated_at: now })
      .eq("event_id", eventId)
      .eq("is_primary", true)
      .neq("series_id", seriesId);
  }

  const { error } = await supabase.from("event_series").upsert(
    {
      event_id: eventId,
      series_id: seriesId,
      is_primary: primary,
      source,
      updated_at: now,
    },
    { onConflict: "event_id,series_id" },
  );
  if (error) throw new Error(error.message);

  if (primary) {
    await supabase.from("events").update({ series_id: seriesId, updated_at: now }).eq("id", eventId);
  }
}

/** Attach a secondary series without touching the primary badge. */
export async function attachSecondarySeries(
  supabase: Supabase,
  eventId: string,
  seriesId: string,
  source = "watcher",
): Promise<void> {
  const { data: existing } = await supabase
    .from("event_series")
    .select("series_id, is_primary")
    .eq("event_id", eventId)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (existing) return;

  const { data: event } = await supabase
    .from("events")
    .select("series_id")
    .eq("id", eventId)
    .maybeSingle();

  // If the race has no primary yet, this becomes the primary.
  if (!event?.series_id) {
    await attachEventSeries(supabase, eventId, seriesId, { primary: true, source });
    return;
  }

  if (event.series_id === seriesId) {
    await attachEventSeries(supabase, eventId, seriesId, { primary: true, source });
    return;
  }

  await attachEventSeries(supabase, eventId, seriesId, { primary: false, source });
}

export async function eventIdsForSeries(
  supabase: Supabase,
  seriesId: string,
): Promise<string[]> {
  const { data: links, error } = await supabase
    .from("event_series")
    .select("event_id")
    .eq("series_id", seriesId);
  if (error) throw new Error(error.message);

  const ids = new Set((links ?? []).map((r) => r.event_id as string));

  // Safety net for rows not yet mirrored (pre-trigger inserts).
  const { data: primary } = await supabase
    .from("events")
    .select("id")
    .eq("series_id", seriesId)
    .is("merged_into_id", null);
  for (const row of primary ?? []) ids.add(row.id as string);

  return [...ids];
}

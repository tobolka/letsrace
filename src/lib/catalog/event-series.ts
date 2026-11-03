/**
 * Many-to-many membership of a race in series.
 *
 * `events.series_id` is the primary badge (UI, explore default). Additional
 * series that also count the same race live in `event_series`.
 */
import type { createServerSupabase } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServerSupabase>;

export type SeriesAttachment = { status: "attached" | "unchanged" | "locked" | "merged" };

export async function attachEventSeries(
  supabase: Supabase,
  eventId: string,
  seriesId: string,
  opts?: { primary?: boolean; source?: string; promoteIfEmpty?: boolean },
): Promise<SeriesAttachment> {
  const { data, error } = await supabase.rpc("pipeline_attach_event_series", {
    p_event: eventId, p_series: seriesId, p_primary: opts?.primary ?? false,
    p_source: opts?.source ?? "watcher", p_promote_if_empty: opts?.promoteIfEmpty ?? false,
  });
  if (error) throw Error(`Attaching race to series: ${error.message}`);
  const result = data as SeriesAttachment | null;
  if (!result || !["attached", "unchanged", "locked", "merged"].includes(result.status)) throw Error("Series attachment was not confirmed");
  return result;
}

/** Decide whether an empty primary can be filled under the same row lock. */
export async function attachSecondarySeries(
  supabase: Supabase,
  eventId: string,
  seriesId: string,
  source = "watcher",
): Promise<SeriesAttachment> {
  return attachEventSeries(supabase, eventId, seriesId, { source, promoteIfEmpty: true });
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
  const { data: primary, error: primaryError } = await supabase
    .from("events")
    .select("id")
    .eq("series_id", seriesId)
    .is("merged_into_id", null);
  if (primaryError) throw Error(primaryError.message);
  for (const row of primary ?? []) ids.add(row.id as string);

  return [...ids];
}

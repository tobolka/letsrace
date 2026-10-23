import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";

/**
 * A race that names no discipline takes its series': a round of "Pohár
 * Karlovarského kraje horských kol" is a mountain-bike race whether or not
 * the calendar line says so. Only races with none of their own, and only
 * from a series that states them; never overwrites.
 */
export async function fillDisciplinesFromSeries(): Promise<{ filled: number }> {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("events")
    .select("id, disciplines, series:series!events_series_id_fkey(disciplines)")
    .eq("visibility", "public")
    .is("merged_into_id", null)
    .in("status", [...ACTIVE_EVENT_STATUSES])
    .gte("start_date", today)
    .not("series_id", "is", null)
    .limit(3000);
  let filled = 0;
  for (const e of data ?? []) {
    if ((e.disciplines ?? []).length) continue;
    const fromSeries = e.series?.disciplines ?? [];
    if (!fromSeries.length) continue;
    await supabase.from("events").update({ disciplines: fromSeries, updated_at: new Date().toISOString() }).eq("id", e.id);
    filled += 1;
  }
  return { filled };
}

import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";

const PAGE = 1000;

/**
 * An Italian race with no website of its own gets its page on rideandrest.net:
 * where it starts, the length and a link to the federation's own record.
 * Better than nothing — and the web finder looks again for the organiser's
 * site later and replaces this one when it finds it.
 */
export async function fillRideAndRestLinks(opts?: {
  dryRun?: boolean;
  log?: (line: string) => void;
}): Promise<{ attempted: number; filled: number }> {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const result = { attempted: 0, filled: 0 };
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, start_date, sources:event_sources(source_url)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .is("website_url", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      const url = (row.sources ?? [])
        .map((s) => s.source_url ?? "")
        .find((u) => /^https:\/\/rideandrest\.net\/manifestazione\/[^/]+\/?$/.test(u));
      if (!url) continue;
      result.attempted += 1;
      opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${row.start_date}  ${row.name}  → ${url}`);
      if (opts?.dryRun) continue;
      const { data: done } = await supabase
        .from("events")
        .update({ website_url: url, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("website_url", null)
        .select("id");
      result.filled += done?.length ?? 0;
    }
    if (rows.length < PAGE) break;
  }
  return result;
}

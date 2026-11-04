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
  let after: string | undefined;
  for (;;) {
    let query = supabase
      .from("events")
      .select("id, public_revision, name, start_date, sources:event_sources(source_url)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .is("website_url", null)
      .order("id", { ascending: true })
      .limit(PAGE);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
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
      const { data: done, error } = await supabase.rpc("pipeline_apply_catalogue_detail", {
        p_event: row.id, p_revision: row.public_revision, p_method: "rideandrest_website",
        p_source: url, p_patch: { website_url: url },
      });
      if (error) throw error;
      if (done?.includes("website_url")) result.filled += 1;
    }
    if (rows.length < PAGE) break;
    after = rows.at(-1)!.id;
  }
  return result;
}

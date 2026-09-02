/**
 * What is waiting for a person, in numbers small enough to sit in a sidebar.
 *
 * Deliberately cheap — head counts and one stored-record pass, no page-through
 * of the catalogue — so the shell can ask for it on every load and again while
 * you work, and the badges are never one navigation out of date.
 */
import { createServerSupabase } from "@/lib/supabase/server";
import { getSourceHealth } from "@/lib/admin/source-health";

export type AdminWorkCounts = {
  discovery: number;
  inbox: number;
  stalled: number;
  /** Upcoming public races with nowhere to send a rider. */
  unlinked: number;
  checkedAt: string;
};

export async function getAdminWorkCounts(): Promise<AdminWorkCounts> {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const [health, discovery, inbox, unlinked] = await Promise.all([
    getSourceHealth(),
    supabase
      .from("discovered_links")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("feedback").select("*", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("visibility", "public")
      .gte("start_date", today)
      .is("website_url", null)
      .is("registration_url", null),
  ]);

  return {
    discovery: discovery.count ?? 0,
    inbox: inbox.count ?? 0,
    stalled: health.stalled.length,
    unlinked: unlinked.count ?? 0,
    checkedAt: new Date().toISOString(),
  };
}

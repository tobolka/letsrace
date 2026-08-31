/**
 * Everything the admin home page needs, in one pass.
 *
 * Organised around what needs doing rather than what can be counted. The old
 * dashboard led with six completeness percentages, all of which were healthy
 * while six sources were silently dead and 57% of the Czech calendar was
 * missing — a number no panel showed, because nothing compared the catalogue
 * against anything outside it.
 */
import { createServerSupabase } from "@/lib/supabase/server";
import { getSourceHealth, type StalledSource } from "@/lib/admin/source-health";

export type ForwardBucket = { month: string; races: number };

export type CountryCoverage = {
  code: string;
  upcoming: number;
  withLink: number;
  withPin: number;
  withAges: number;
};

export type AdminOverview = {
  /** Things that need a person, most urgent first. */
  stalled: StalledSource[];
  pendingDiscovery: number;
  openFeedback: number;
  incompleteUpcoming: number;

  totals: { events: number; publicUpcoming: number; sources: number; activeSources: number };
  /** Races by month — where the season cliff shows. */
  forward: ForwardBucket[];
  beyond90: number;
  coverage: CountryCoverage[];
  lastRun: { at: string | null; ok: boolean | null; upserted: number } | null;
  failRate7d: { fails: number; runs: number };
};

const PAGE = 1000;

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const rows: {
    start_date: string;
    website_url: string | null;
    registration_url: string | null;
    age_categories: string[] | null;
    locations: { country_code?: string | null; lat?: number | null } | null;
  }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("events")
      .select("start_date,website_url,registration_url,age_categories,locations(country_code,lat)")
      .eq("visibility", "public")
      .gte("start_date", today)
      .order("start_date")
      .range(from, from + PAGE - 1);
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (!data || data.length < PAGE) break;
  }

  const [health, eventCount, sourceCount, activeCount, pendingDiscovery, feedback, runs] =
    await Promise.all([
      getSourceHealth(),
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("watched_urls").select("*", { count: "exact", head: true }),
      supabase.from("watched_urls").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase
        .from("discovered_links")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("feedback").select("*", { count: "exact", head: true }).eq("status", "new"),
      supabase
        .from("ingest_runs")
        .select("ok, events_upserted, started_at")
        .gte("started_at", new Date(Date.now() - 7 * 864e5).toISOString())
        .order("started_at", { ascending: false })
        .limit(500),
    ]);

  const byMonth = new Map<string, number>();
  const byCountry = new Map<string, CountryCoverage>();
  const in90 = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  let beyond90 = 0;
  let incomplete = 0;

  for (const r of rows) {
    const month = r.start_date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    if (r.start_date > in90) beyond90 += 1;

    const cc = r.locations?.country_code ?? "??";
    const c = byCountry.get(cc) ?? { code: cc, upcoming: 0, withLink: 0, withPin: 0, withAges: 0 };
    c.upcoming += 1;
    const hasLink = Boolean(r.website_url || r.registration_url);
    const hasPin = r.locations?.lat != null;
    const hasAges = (r.age_categories ?? []).length > 0;
    if (hasLink) c.withLink += 1;
    if (hasPin) c.withPin += 1;
    if (hasAges) c.withAges += 1;
    byCountry.set(cc, c);
    if (!hasLink || !hasPin) incomplete += 1;
  }

  const runRows = runs.data ?? [];
  const last = runRows[0];

  return {
    stalled: health.stalled,
    pendingDiscovery: pendingDiscovery.count ?? 0,
    openFeedback: feedback.error ? 0 : (feedback.count ?? 0),
    incompleteUpcoming: incomplete,
    totals: {
      events: eventCount.count ?? 0,
      publicUpcoming: rows.length,
      sources: sourceCount.count ?? 0,
      activeSources: activeCount.count ?? 0,
    },
    forward: [...byMonth.entries()]
      .sort()
      .slice(0, 12)
      .map(([month, races]) => ({ month, races })),
    beyond90,
    coverage: [...byCountry.values()].sort((a, b) => b.upcoming - a.upcoming).slice(0, 10),
    lastRun: last
      ? {
          at: (last.started_at as string) ?? null,
          ok: (last.ok as boolean | null) ?? null,
          upserted: (last.events_upserted as number) ?? 0,
        }
      : null,
    failRate7d: {
      fails: runRows.filter((r) => r.ok === false).length,
      runs: runRows.length,
    },
  };
}

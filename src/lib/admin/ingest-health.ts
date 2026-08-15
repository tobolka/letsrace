import { createServerSupabase } from "@/lib/supabase/server";

export type CompletenessSlice = {
  total: number;
  withAges: number;
  withDisciplines: number;
  withWebsiteOrReg: number;
  withRegistration: number;
  withCoords: number;
  completeCore: number;
};

export type AdapterFailure = {
  strategy: string | null;
  fails: number;
  lastError: string | null;
  lastAt: string | null;
};

export type SourceHealth = {
  active: number;
  needsReview: number;
  paused: number;
  withError: number;
};

export type IngestHealth = {
  completeness: CompletenessSlice;
  sourceHealth: SourceHealth;
  adapterFailures: AdapterFailure[];
  recentFailRate: number;
  recentRuns: number;
  recentFails: number;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function getIngestHealth(): Promise<IngestHealth> {
  const supabase = createServerSupabase();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: events, error: eventsErr },
    { count: active },
    { count: needsReview },
    { count: paused },
    { count: withError },
    { data: recentRuns, error: runsErr },
  ] = await Promise.all([
    supabase
      .from("events")
      .select(
        "age_categories, disciplines, website_url, registration_url, location:locations(lat, lng)",
      )
      .eq("visibility", "public")
      .in("status", ["scheduled", "tbc", "postponed", "registration_open"])
      .gte("start_date", todayIso())
      .limit(5000),
    supabase
      .from("watched_urls")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("watched_urls")
      .select("*", { count: "exact", head: true })
      .eq("status", "needs_review"),
    supabase
      .from("watched_urls")
      .select("*", { count: "exact", head: true })
      .eq("status", "paused"),
    supabase
      .from("watched_urls")
      .select("*", { count: "exact", head: true })
      .not("last_error", "is", null),
    supabase
      .from("ingest_runs")
      .select("ok, error, strategy, started_at")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(2000),
  ]);

  if (eventsErr) throw new Error(eventsErr.message);
  if (runsErr) throw new Error(runsErr.message);

  const completeness: CompletenessSlice = {
    total: 0,
    withAges: 0,
    withDisciplines: 0,
    withWebsiteOrReg: 0,
    withRegistration: 0,
    withCoords: 0,
    completeCore: 0,
  };

  for (const row of events ?? []) {
    completeness.total += 1;
    const ages = (row.age_categories as string[] | null) ?? [];
    const discs = (row.disciplines as string[] | null) ?? [];
    const hasAges = ages.length > 0;
    const hasDisc = discs.length > 0;
    const hasReg = Boolean(row.registration_url);
    const hasUrl = Boolean(row.website_url || row.registration_url);
    const loc = Array.isArray(row.location) ? row.location[0] : row.location;
    const hasCoords = loc?.lat != null && loc?.lng != null;
    if (hasAges) completeness.withAges += 1;
    if (hasDisc) completeness.withDisciplines += 1;
    if (hasUrl) completeness.withWebsiteOrReg += 1;
    if (hasReg) completeness.withRegistration += 1;
    if (hasCoords) completeness.withCoords += 1;
    if (hasAges && hasDisc && hasReg && hasCoords) completeness.completeCore += 1;
  }

  const failByStrategy = new Map<string, AdapterFailure>();
  let recentFails = 0;
  for (const run of recentRuns ?? []) {
    if (run.ok === false) {
      recentFails += 1;
      const key = (run.strategy as string | null) || "unknown";
      const prev = failByStrategy.get(key) ?? {
        strategy: run.strategy,
        fails: 0,
        lastError: null,
        lastAt: null,
      };
      prev.fails += 1;
      if (!prev.lastAt || (run.started_at && run.started_at > prev.lastAt)) {
        prev.lastAt = run.started_at;
        prev.lastError = run.error;
        prev.strategy = run.strategy;
      }
      failByStrategy.set(key, prev);
    }
  }

  const recentRunsCount = recentRuns?.length ?? 0;
  const adapterFailures = [...failByStrategy.values()]
    .sort((a, b) => b.fails - a.fails)
    .slice(0, 12);

  return {
    completeness,
    sourceHealth: {
      active: active ?? 0,
      needsReview: needsReview ?? 0,
      paused: paused ?? 0,
      withError: withError ?? 0,
    },
    adapterFailures,
    recentFailRate: recentRunsCount ? recentFails / recentRunsCount : 0,
    recentRuns: recentRunsCount,
    recentFails,
  };
}

export function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

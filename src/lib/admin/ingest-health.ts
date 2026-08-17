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

type CompletenessRow = {
  age_categories: string[] | null;
  disciplines: string[] | null;
  website_url: string | null;
  registration_url: string | null;
  location: { lat: number | null; lng: number | null } | { lat: number | null; lng: number | null }[] | null;
};

type IngestRunRow = {
  ok: boolean | null;
  error: string | null;
  strategy: string | null;
  started_at: string | null;
};

/** PostgREST caps each response at ~1000 rows; page until exhausted. */
const PAGE = 1000;

async function fetchAllUpcomingCompletenessRows(
  supabase: ReturnType<typeof createServerSupabase>,
): Promise<CompletenessRow[]> {
  const rows: CompletenessRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "age_categories, disciplines, website_url, registration_url, location:locations(lat, lng)",
      )
      .eq("visibility", "public")
      .in("status", ["scheduled", "tbc", "postponed", "registration_open"])
      .gte("start_date", todayIso())
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as CompletenessRow[];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

async function fetchRecentIngestRuns(
  supabase: ReturnType<typeof createServerSupabase>,
  since: string,
): Promise<IngestRunRow[]> {
  const rows: IngestRunRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("ingest_runs")
      .select("ok, error, strategy, started_at")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as IngestRunRow[];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

function accumulateCompleteness(rows: CompletenessRow[]): CompletenessSlice {
  const completeness: CompletenessSlice = {
    total: 0,
    withAges: 0,
    withDisciplines: 0,
    withWebsiteOrReg: 0,
    withRegistration: 0,
    withCoords: 0,
    completeCore: 0,
  };

  for (const row of rows) {
    completeness.total += 1;
    const ages = row.age_categories ?? [];
    const discs = row.disciplines ?? [];
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

  return completeness;
}

export async function getIngestHealth(): Promise<IngestHealth> {
  const supabase = createServerSupabase();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [events, activeRes, needsReviewRes, pausedRes, withErrorRes, recentRuns] =
    await Promise.all([
      fetchAllUpcomingCompletenessRows(supabase),
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
      fetchRecentIngestRuns(supabase, since),
    ]);

  const completeness = accumulateCompleteness(events);

  const failByStrategy = new Map<string, AdapterFailure>();
  let recentFails = 0;
  for (const run of recentRuns) {
    if (run.ok === false) {
      recentFails += 1;
      const key = run.strategy || "unknown";
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

  const recentRunsCount = recentRuns.length;
  const adapterFailures = [...failByStrategy.values()]
    .sort((a, b) => b.fails - a.fails)
    .slice(0, 12);

  return {
    completeness,
    sourceHealth: {
      active: activeRes.count ?? 0,
      needsReview: needsReviewRes.count ?? 0,
      paused: pausedRes.count ?? 0,
      withError: withErrorRes.count ?? 0,
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

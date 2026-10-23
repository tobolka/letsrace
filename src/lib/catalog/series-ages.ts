import { recordFacts } from "@/lib/catalog/facts";
import { createServerSupabase } from "@/lib/supabase/server";
import { AGE_CATEGORIES, audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";

const PAGE = 1000;

export type SeriesAgeRow = {
  id: string;
  name: string;
  countryCode: string | null;
  websiteUrl: string | null;
  /** Upcoming public rounds, soonest first. */
  rounds: { id: string; name: string; startDate: string; ages: string[]; confidence: string | null; regulationsUrl: string | null }[];
  /** The series' own list, and whether a person confirmed it. */
  ages: AgeCategory[];
  confirmedAt: string | null;
  /** Every band any round states (from a source), as a starting suggestion. */
  suggested: AgeCategory[];
};

/**
 * Series with races coming up, for a person to say once who may start.
 *
 * Reading classes off pages gets most races; a series is where a person can
 * settle the rest in one decision: "Jesenický šnek runs kids from benjamínci
 * to masters at every round". Unconfirmed series come first, then the ones
 * with the most rounds ahead.
 */
export async function listSeriesForAgeReview(opts?: {
  country?: string;
  onlyOpen?: boolean;
}): Promise<SeriesAgeRow[]> {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const events: {
    id: string;
    name: string;
    start_date: string;
    series_id: string;
    age_categories: string[] | null;
    age_confidence: string | null;
    regulations_url: string | null;
  }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, start_date, series_id, age_categories, age_confidence, regulations_url")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .not("series_id", "is", null)
      .gte("start_date", today)
      .lte("start_date", until)
      .order("start_date", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    events.push(...((data ?? []) as typeof events));
    if (!data || data.length < PAGE) break;
  }
  const bySeries = new Map<string, typeof events>();
  for (const e of events) bySeries.set(e.series_id, [...(bySeries.get(e.series_id) ?? []), e]);
  if (!bySeries.size) return [];

  const ids = [...bySeries.keys()];
  const series: {
    id: string;
    name: string;
    country_code: string | null;
    website_url: string | null;
    age_categories: string[] | null;
    age_categories_confirmed_at: string | null;
  }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("series")
      .select("id, name, country_code, website_url, age_categories, age_categories_confirmed_at")
      .in("id", ids.slice(i, i + 200));
    series.push(...((data ?? []) as typeof series));
  }

  const rows: SeriesAgeRow[] = series.map((s) => {
    const rounds = bySeries.get(s.id) ?? [];
    const stated = new Set<string>();
    for (const r of rounds) if (r.age_confidence === "explicit") (r.age_categories ?? []).forEach((a) => stated.add(a));
    return {
      id: s.id,
      name: s.name,
      countryCode: s.country_code,
      websiteUrl: s.website_url,
      rounds: rounds.map((r) => ({
        id: r.id,
        name: r.name,
        startDate: r.start_date,
        ages: r.age_categories ?? [],
        confidence: r.age_confidence,
        regulationsUrl: r.regulations_url,
      })),
      ages: AGE_CATEGORIES.filter((a) => (s.age_categories ?? []).includes(a)),
      confirmedAt: s.age_categories_confirmed_at,
      suggested: AGE_CATEGORIES.filter((a) => stated.has(a)),
    };
  });
  return rows
    .filter((r) => !opts?.country || (r.countryCode ?? "").toUpperCase() === opts.country.toUpperCase())
    .filter((r) => !opts?.onlyOpen || !r.confirmedAt)
    .sort(
      (a, b) =>
        Number(Boolean(a.confirmedAt)) - Number(Boolean(b.confirmedAt)) ||
        b.rounds.length - a.rounds.length ||
        a.rounds[0]!.startDate.localeCompare(b.rounds[0]!.startDate),
    );
}

/** Confirmed common categories fill gaps; a round's own categories are an exception. */
export function mayInheritSeriesAges(round: { age_categories: string[] | null; age_confidence: string | null; locked_fields?: string[] | null }): boolean {
  if (round.age_confidence === "explicit" && round.age_categories?.length) return false;
  return !(round.locked_fields ?? []).some((field) => ["age_categories", "age_confidence", "audience"].includes(field));
}

export async function applySeriesAgesToRounds(seriesId?: string, opts?: { dryRun?: boolean; log?: (line: string) => void }): Promise<{ series: number; rounds: number }> {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase.from("series").select("id, name, age_categories, website_url")
    .not("age_categories_confirmed_at", "is", null);
  if (seriesId) q = q.eq("id", seriesId);
  const { data: confirmed, error } = await q;
  if (error) throw new Error(error.message);
  let rounds = 0;
  for (const s of confirmed ?? []) {
    const ages = AGE_CATEGORIES.filter((a) => (s.age_categories ?? []).includes(a));
    if (!ages.length) continue;
    type Round = { id: string; name: string; age_categories: string[] | null; age_confidence: string | null; audience: string | null; overrides: { locked_fields: string[] | null } | null };
    const candidates: Round[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from("events")
        .select("id, name, age_categories, age_confidence, audience, overrides:event_overrides(locked_fields)")
        .eq("series_id", s.id).is("merged_into_id", null).gte("start_date", today)
        .in("status", [...ACTIVE_EVENT_STATUSES]).order("id").range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      candidates.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    for (const round of candidates) {
      if (!mayInheritSeriesAges({ ...round, locked_fields: round.overrides?.locked_fields })) continue;
      opts?.log?.(`${opts.dryRun ? "DRY" : "SET"} ${round.name} ← ${s.name}: ${ages.join(",")}`);
      if (opts?.dryRun) { rounds += 1; continue; }
      const audience = audienceFromAgeCategories(ages);
      const { data, error } = await supabase.from("events")
        .update({ age_categories: ages, age_confidence: "explicit", audience, updated_at: new Date().toISOString() })
        .eq("id", round.id).or("age_confidence.is.null,age_confidence.neq.explicit,age_categories.is.null,age_categories.eq.{}")
        .select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) continue;
      await recordFacts(supabase, round.id, [
        { field: "age_categories", value: ages, previous: round.age_categories, sourceUrl: s.website_url, quote: `Confirmed series categories: ${s.name}` },
        { field: "age_confidence", value: "explicit", previous: round.age_confidence },
        { field: "audience", value: audience, previous: round.audience },
      ], { method: "confirmed_series", version: "series-ages-v2" });
      rounds += 1;
    }
  }
  return { series: confirmed?.length ?? 0, rounds };
}

export async function confirmSeriesAges(seriesId: string, ages: string[], note?: string): Promise<number> {
  const supabase = createServerSupabase();
  const clean = AGE_CATEGORIES.filter((a) => ages.includes(a));
  // The umbrella chips follow the bands, as everywhere else.
  const withUmbrellas = new Set<AgeCategory>(clean);
  if (clean.some((a) => ["u7", "u9", "u11"].includes(a))) withUmbrellas.add("kids");
  if (clean.some((a) => ["u13", "u15", "u17"].includes(a))) withUmbrellas.add("youth");
  const final = AGE_CATEGORIES.filter((a) => withUmbrellas.has(a));
  const { error } = await supabase
    .from("series")
    .update({
      age_categories: final,
      age_categories_confirmed_at: final.length ? new Date().toISOString() : null,
      age_categories_note: note ?? null,
    })
    .eq("id", seriesId);
  if (error) throw new Error(error.message);
  if (!final.length) return 0;
  return (await applySeriesAgesToRounds(seriesId)).rounds;
}

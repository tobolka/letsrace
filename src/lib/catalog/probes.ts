import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A memory for the readers that go and look at one race's own page.
 *
 * Without it every pass picks the same batch: "upcoming races with no age
 * categories" is a stable question, so the nightly job asked the same sixty-odd
 * pages every run, got the same nothing, and never reached the ones behind
 * them. A page that carries no categories is a fact about that page, not a
 * transient failure.
 *
 * It is not permanent, though — an organiser publishes the programme in
 * February for a race in June — so a silence goes stale and the page is worth
 * one more look.
 */

export type ProbeName = "fci_ages" | "raceresult_ages";
export type ProbeOutcome = "silent" | "failed";

/** How long an answer stands before the page is worth asking again. */
const RETRY_DAYS: Record<ProbeOutcome, number> = {
  // Nothing there today; the programme may be published later in the season.
  silent: 30,
  // Could not reach it at all — a site being down is worth another try soon.
  failed: 3,
};

const PAGE = 1000;

/**
 * The events this probe should skip, because it has asked recently enough.
 */
export async function recentlyProbed(
  supabase: SupabaseClient,
  probe: ProbeName,
): Promise<Set<string>> {
  const skip = new Set<string>();
  const now = Date.now();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("catalog_probes")
      .select("event_id, outcome, last_attempt_at")
      .eq("probe", probe)
      .order("event_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data as { event_id: string; outcome: string; last_attempt_at: string }[]) {
      const days = RETRY_DAYS[(row.outcome as ProbeOutcome) ?? "silent"] ?? RETRY_DAYS.silent;
      if (now - Date.parse(row.last_attempt_at) < days * 86_400_000) skip.add(row.event_id);
    }
    if (data.length < PAGE) break;
  }
  return skip;
}

/** Remember that this page was asked and did not answer. */
export async function recordProbe(
  supabase: SupabaseClient,
  eventId: string,
  probe: ProbeName,
  outcome: ProbeOutcome,
): Promise<void> {
  const { data } = await supabase
    .from("catalog_probes")
    .select("attempts")
    .eq("event_id", eventId)
    .eq("probe", probe)
    .maybeSingle();
  await supabase.from("catalog_probes").upsert(
    {
      event_id: eventId,
      probe,
      outcome,
      attempts: Number(data?.attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
    },
    { onConflict: "event_id,probe" },
  );
}

/** A page that answered is no longer a page to skip. */
export async function clearProbe(
  supabase: SupabaseClient,
  eventId: string,
  probe: ProbeName,
): Promise<void> {
  await supabase.from("catalog_probes").delete().eq("event_id", eventId).eq("probe", probe);
}

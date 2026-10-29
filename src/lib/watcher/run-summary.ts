import type { WatchOutcome } from "@/lib/watcher/run";

export function isBudgetDeferral(message: string): boolean {
  return /provider_deferred:|LLM budget of|Shared LLM budget|calendar_budget_exhausted|calendar_time_budget_exhausted|write_time_budget_exhausted|time budget exceeded|chunk_limit/.test(message);
}

export function summarizeWatches(outcomes: WatchOutcome[]) {
  const pending = outcomes.filter(o => !o.ok);
  const deferred = pending.filter(o => isBudgetDeferral(o.error ?? "") && !(o.eventsFailed ?? 0));
  return { watched: outcomes.length, upserted: outcomes.reduce((n, o) => n + o.eventsUpserted, 0),
    created: outcomes.reduce((n, o) => n + (o.eventsCreated ?? 0), 0),
    failed: pending.length - deferred.length, deferred: deferred.length };
}

/** One machine-readable contract shared by scheduled and manual readers. */
export function reportWatchBatch(outcomes: WatchOutcome[]) {
  const summary = summarizeWatches(outcomes);
  console.info("pipeline_batch", JSON.stringify({
    reads: outcomes.length, created: summary.created,
    updated: outcomes.reduce((sum, o) => sum + (o.eventsUpdated ?? 0), 0),
    failed: summary.failed, deferred: summary.deferred,
    deferredWrites: outcomes.reduce((sum, o) => sum + (o.eventsDeferred ?? 0), 0),
    unchanged: outcomes.filter(o => o.unchanged).length,
    okUrls: outcomes.filter(o => o.ok).map(o => o.url),
    problems: outcomes.filter(o => !o.ok).map(o => ({ url: o.url, error: (o.error ?? "unknown").slice(0, 1200) })),
  }));
  for (const outcome of outcomes) reportFederation(outcome);
}

export function reportFederation(out: WatchOutcome) {
  if (!/portal\.czechcyclingfederation\.com/i.test(out.url)) return;
  console.info("pipeline_federation", JSON.stringify({
    status: out.ok ? "ok" : /identity_review_required|pipeline_data_review_required/.test(out.error ?? "") ? "needs_review" : "failed",
    read: out.eventsExtracted ?? 0, written: out.eventsUpserted,
    created: out.eventsCreated ?? 0, updated: out.eventsUpdated ?? 0,
    issue: out.error?.slice(0, 1200) ?? null,
  }));
}

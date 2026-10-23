import type { WatchOutcome } from "@/lib/watcher/run";

export function isBudgetDeferral(message: string): boolean {
  return /LLM budget of|Shared LLM budget|calendar_budget_exhausted|calendar_time_budget_exhausted|write_time_budget_exhausted|time budget exceeded|chunk_limit/.test(message);
}

export function summarizeWatches(outcomes: WatchOutcome[]) {
  const pending = outcomes.filter(o => !o.ok);
  const deferred = pending.filter(o => isBudgetDeferral(o.error ?? "") && !(o.eventsFailed ?? 0));
  return { watched: outcomes.length, upserted: outcomes.reduce((n, o) => n + o.eventsUpserted, 0),
    created: outcomes.reduce((n, o) => n + (o.eventsCreated ?? 0), 0),
    failed: pending.length - deferred.length, deferred: deferred.length };
}

import type { WatchOutcome } from "@/lib/watcher/run";

export function isBudgetDeferral(message: string): boolean {
  return /provider_deferred:|LLM budget of|Shared LLM budget|calendar_budget_exhausted|calendar_time_budget_exhausted|write_time_budget_exhausted|time budget exceeded|chunk_limit|source_reader_unavailable_or_running|source_changed_before_read|concurrent_event_update|calendar_write_retry_pending/.test(message);
}

export function isUnreadableSource(message: string): boolean {
  return ["unsupported_or_empty_source", "low confidence or empty extract", "dynamic_render_unavailable"].includes(message) || /^(source_document_too_large|pdf_has_no_text)/.test(message);
}

export function watchOutcomeState(outcome: WatchOutcome): "ok" | "failed" | "deferred" | "unreadable" {
  // A partial write failure always requires attention, even if the reader also
  // reported a limitation or a caller accidentally marked the source successful.
  if ((outcome.eventsFailed ?? 0) > 0) return "failed";
  if (outcome.ok) return "ok";
  if (isBudgetDeferral(outcome.error ?? "")) return "deferred";
  if (isUnreadableSource(outcome.error ?? "")) return "unreadable";
  return "failed";
}

export function recordedRunState(run:{ok:boolean|null;error:string|null;finished_at:string|null}){
  if(!run.finished_at)return 'running' as const;
  if(run.ok==null)return 'unknown' as const;
  return watchOutcomeState({watchedUrlId:'',url:'',ok:run.ok,error:run.error??undefined,eventsUpserted:0,linksDiscovered:0});
}

export function summarizeWatches(outcomes: WatchOutcome[]) {
  const states = outcomes.map(watchOutcomeState);
  return { watched: outcomes.length, upserted: outcomes.reduce((n, o) => n + o.eventsUpserted, 0),
    created: outcomes.reduce((n, o) => n + (o.eventsCreated ?? 0), 0),
    failed: states.filter(s => s === "failed").length,
    deferred: states.filter(s => s === "deferred").length,
    unreadable: states.filter(s => s === "unreadable").length };
}

/** Shared result for the server response, stored job and local runner log. */
export function watchBatchResult(outcomes: WatchOutcome[]) {
  const summary = summarizeWatches(outcomes);
  return {
    ok: summary.failed === 0,
    status: summary.failed ? "attention" : summary.deferred ? "deferred" : summary.unreadable ? "limited" : "ok",
    // Keep both names while older server clients use count and the Mac uses reads.
    count: outcomes.length, reads: outcomes.length, created: summary.created,
    updated: outcomes.reduce((sum, o) => sum + (o.eventsUpdated ?? 0), 0),
    failed: summary.failed, deferred: summary.deferred, unreadable: summary.unreadable,
    deferredWrites: outcomes.reduce((sum, o) => sum + (o.eventsDeferred ?? 0), 0),
    unchanged: outcomes.filter(o => o.unchanged).length,
    okUrls: outcomes.filter(o => watchOutcomeState(o) === "ok").map(o => o.url),
    problems: outcomes.filter(o => watchOutcomeState(o) !== "ok").map(o => ({
      url: o.url, state: watchOutcomeState(o), error: (o.error ?? "unknown").slice(0, 1200),
    })),
  };
}

/** One machine-readable contract shared by scheduled and manual readers. */
export function reportWatchBatch(outcomes: WatchOutcome[]) {
  console.info("pipeline_batch", JSON.stringify(watchBatchResult(outcomes)));
  for (const outcome of outcomes) reportFederation(outcome);
}

export function reportFederation(out: WatchOutcome) {
  if (!/portal\.czechcyclingfederation\.com/i.test(out.url)) return;
  console.info("pipeline_federation", JSON.stringify({
    status: out.ok ? "ok" : watchOutcomeState(out) === "deferred" ? "deferred" : /identity_review_required|pipeline_data_review_required/.test(out.error ?? "") ? "needs_review" : "failed",
    read: out.eventsExtracted ?? 0, written: out.eventsUpserted,
    created: out.eventsCreated ?? 0, updated: out.eventsUpdated ?? 0,
    issue: out.error?.slice(0, 1200) ?? null,
  }));
}

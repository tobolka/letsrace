import { createServerSupabase } from "@/lib/supabase/server";
import type { WatchOutcome } from "@/lib/watcher/run";
import type { Json } from "@/lib/supabase/database.types";
import { AsyncLocalStorage } from "node:async_hooks";

type SourceReceipt = { runId: string; patch: Json; runResult: Json };
const sourceLease = new AsyncLocalStorage<{ key: string; token: string; url: string; receipt?: SourceReceipt }>();
export function currentSourceLease() {
  const lease = sourceLease.getStore();
  return lease && { key: lease.key, token: lease.token, url: lease.url };
}

export function stageSourceReceipt(receipt: SourceReceipt) {
  const lease = sourceLease.getStore();
  if (!lease) throw Error("Source receipt requires a lease");
  lease.receipt = receipt;
}

/** Every scheduled, service and browser read uses the same persisted source lease. */
export async function withSourceWork(row: { id: string; url: string; kind?: string; updated_at?: string }, read: () => Promise<WatchOutcome>, opts?: { dueBefore?: string }): Promise<WatchOutcome> {
  const db = createServerSupabase();
  const claim = { p_source: row.id, p_capabilities: process.env.VERCEL ? ["http"] : ["http", "browser"] };
  const { data, error } = opts
    ? await db.rpc("pipeline_claim_source_read", { ...claim, p_due_before: opts.dueBefore, p_expected_revision: opts.dueBefore ? row.updated_at : undefined })
    : await db.rpc("pipeline_claim_source", claim);
  if (error) throw Error(`Claiming source work: ${error.message}`);
  if (!Array.isArray(data)) throw Error("Source work claim was not confirmed");
  const task = data[0];
  if (!task) return { watchedUrlId: row.id, url: row.url, ok: false, eventsUpserted: 0, linksDiscovered: 0, error: "source_reader_unavailable_or_running", strategy: "deferred" };
  if (!task.token || !task.key) throw Error("Source work claim has no lease token");
  const payload = task.payload as { url?: string; sourceKind?: string; sourceRevision?: string } | null;
  if ((payload?.url && payload.url !== row.url) || (row.kind && payload?.sourceKind && row.kind !== payload.sourceKind)) {
    const { error } = await db.rpc("pipeline_finish_source", { p_key: task.key, p_token: task.token!, p_url: payload?.url ?? row.url, p_result: { error: "source_changed_before_read" } });
    if (error) throw error;
    return { watchedUrlId: row.id, url: row.url, ok: false, eventsUpserted: 0, linksDiscovered: 0, error: "source_changed_before_read", strategy: "deferred" };
  }
  let result: WatchOutcome;
  const lease: NonNullable<ReturnType<typeof sourceLease.getStore>> = { key: task.key, token: task.token, url: row.url };
  try { result = await sourceLease.run(lease, read); }
  catch (error) {
    const { data: retried, error: retryError } = await db.rpc("pipeline_retry_task", { p_key: task.key, p_token: task.token!, p_error: error instanceof Error ? error.message : "Source work interrupted", p_delay_seconds: 3600 });
    if (retryError) throw Error(`Recording source retry: ${retryError.message}`);
    if (retried !== true) throw new Error("source_reader_unavailable_or_running:retry_not_accepted", { cause: error });
    throw error;
  }
  const completion = { p_key: task.key, p_token: task.token, p_url: row.url,
    p_result: { ok: result.ok, created: result.eventsCreated ?? 0, updated: result.eventsUpdated ?? 0, error: result.error ?? null, read: result.eventsExtracted ?? 0 } };
  const receipt = lease.receipt;
  if (opts && (!receipt || !payload?.sourceRevision)) throw Error("Source completion lacks its receipt or revision");
  const { data: accepted, error: finishError } = opts
    ? await db.rpc("pipeline_commit_source_read", {
      ...completion, p_revision: payload?.sourceRevision ?? "", p_run: receipt!.runId,
      p_patch: receipt!.patch, p_run_result: receipt!.runResult,
    })
    : await db.rpc("pipeline_finish_source", completion);
  if (finishError) throw Error(`Recording source result: ${finishError.message}`);
  // A changed URL or expired/replaced lease is a refused completion, even if
  // HTTP and SQL returned successfully. Do not announce a successful run.
  if (accepted !== true) return { ...result, ok: false, error: "source_reader_unavailable_or_running:result_not_accepted", strategy: "deferred" };
  return result;
}

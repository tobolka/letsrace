import { createServerSupabase } from "@/lib/supabase/server";
import type { WatchOutcome } from "@/lib/watcher/run";
import { AsyncLocalStorage } from "node:async_hooks";

const sourceLease = new AsyncLocalStorage<{ key: string; token: string; url: string }>();
export const currentSourceLease = () => sourceLease.getStore();

/** Every scheduled, service and browser read uses the same persisted source lease. */
export async function withSourceWork(row: { id: string; url: string }, read: () => Promise<WatchOutcome>): Promise<WatchOutcome> {
  const db = createServerSupabase();
  const { data, error } = await db.rpc("pipeline_claim_source", { p_source: row.id, p_capabilities: process.env.VERCEL ? ["http"] : ["http", "browser"] });
  if (error) throw Error(`Claiming source work: ${error.message}`);
  if (!Array.isArray(data)) throw Error("Source work claim was not confirmed");
  const task = data[0];
  if (!task) return { watchedUrlId: row.id, url: row.url, ok: false, eventsUpserted: 0, linksDiscovered: 0, error: "source_reader_unavailable_or_running", strategy: "deferred" };
  if (!task.token || !task.key) throw Error("Source work claim has no lease token");
  const payload = task.payload as { url?: string };
  if (payload?.url && payload.url !== row.url) {
    const { error } = await db.rpc("pipeline_finish_source", { p_key: task.key, p_token: task.token!, p_url: row.url, p_result: { error: "source_changed_before_read" } });
    if (error) throw error;
    return { watchedUrlId: row.id, url: row.url, ok: false, eventsUpserted: 0, linksDiscovered: 0, error: "source_changed_before_read", strategy: "deferred" };
  }
  let result: WatchOutcome;
  try { result = await sourceLease.run({ key: task.key, token: task.token, url: row.url }, read); }
  catch (error) {
    const { data: retried, error: retryError } = await db.rpc("pipeline_retry_task", { p_key: task.key, p_token: task.token!, p_error: error instanceof Error ? error.message : "Source work interrupted", p_delay_seconds: 3600 });
    if (retryError) throw Error(`Recording source retry: ${retryError.message}`);
    if (retried !== true) throw new Error("source_reader_unavailable_or_running:retry_not_accepted", { cause: error });
    throw error;
  }
  const { data: accepted, error: finishError } = await db.rpc("pipeline_finish_source", { p_key: task.key, p_token: task.token!, p_url: row.url,
    p_result: JSON.parse(JSON.stringify({ ok: result.ok, created: result.eventsCreated ?? 0, updated: result.eventsUpdated ?? 0, error: result.error ?? null, read: result.eventsExtracted ?? 0 })) });
  if (finishError) throw Error(`Recording source result: ${finishError.message}`);
  // A changed URL or expired/replaced lease is a refused completion, even if
  // HTTP and SQL returned successfully. Do not announce a successful run.
  if (accepted !== true) return { ...result, ok: false, error: "source_reader_unavailable_or_running:result_not_accepted", strategy: "deferred" };
  return result;
}

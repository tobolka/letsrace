import { createServerSupabase } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/seo";

/** Request bounded refreshes without fetching HTML or consuming verification slots. */
export async function requestPublicRefreshes() {
  if (!process.env.CRON_SECRET) throw Error("Missing publication access");
  const db = createServerSupabase();
  const { data: tasks, error } = await db.rpc("pipeline_claim_tasks", { p_kind: "public_expire", p_capabilities: ["web"], p_limit: 1 });
  if (error) throw error;
  const task = tasks[0];
  if (!task) return { status: "waiting", requested: 0, verified: false };
  try {
    const payload = task.payload as { revision?: string };
    if (task.key !== "publication:expire" || typeof payload.revision !== "string") throw Error("Invalid refresh batch");
    const response = await fetch(`${getSiteUrl()}/api/ops/publication`, {
      method: "POST", redirect: "error", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key: task.key, token: task.token, revision: payload.revision }), signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw Error(`Refresh service returned HTTP ${response.status}`);
    const result = await response.json() as { items?: { key: string; revision: string }[]; verified?: boolean };
    if (!Array.isArray(result.items) || result.items.length > 200 || result.items.some(item => typeof item.key !== "string" || typeof item.revision !== "string") || result.verified !== false) throw Error("Invalid refresh receipt");
    const saved = await db.rpc("pipeline_record_expirations", { p_token: task.token!, p_items: result.items });
    if (saved.error) throw saved.error;
    const remaining = await db.rpc("pipeline_expiration_candidates", { p_token: task.token! });
    if (remaining.error) throw remaining.error;
    const more = remaining.data.length > 0;
    const finished = more
      ? await db.rpc("pipeline_retry_task", { p_key: task.key, p_token: task.token!, p_error: "Next bounded refresh batch remains due", p_delay_seconds: 3600 })
      : await db.rpc("pipeline_finish_task", { p_key: task.key, p_token: task.token!, p_payload: task.payload, p_result: { requested: saved.data, requestedAt: new Date().toISOString(), verified: false } });
    if (finished.error) throw finished.error;
    return { status: more ? "partial" : finished.data ? "requested" : "superseded", requested: saved.data, verified: false };
  } catch (error) {
    const retry = await db.rpc("pipeline_retry_task", { p_key: task.key, p_token: task.token!, p_error: error instanceof Error ? error.message : "Refresh request failed", p_delay_seconds: 3600 });
    if (retry.error) throw retry.error;
    return { status: "deferred", requested: 0, verified: false };
  }
}

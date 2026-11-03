import { createServerSupabase } from "@/lib/supabase/server";
import { detectPlanChanges, type EventSnapshot } from "@/lib/plan-changes";
import type { Json } from "@/lib/supabase/database.types";

function snapshot(value: unknown): EventSnapshot {
  if (!value || typeof value !== "object") throw Error("Missing plan-change snapshot");
  const row = value as EventSnapshot;
  if (typeof row.name !== "string" || typeof row.startDate !== "string" || !Array.isArray(row.disciplines) || row.disciplines.some(d => typeof d !== "string")
    || ![row.endDate, row.status, row.registrationUrl].every(v => v === null || typeof v === "string")) throw Error("Invalid plan-change snapshot");
  return row;
}

/** Uses the same rider-facing change rules; completion and stored notices are atomic. */
export async function completePlanChanges() {
  const db = createServerSupabase();
  const { data: tasks, error } = await db.rpc("pipeline_claim_tasks", { p_kind: "plan_changes", p_capabilities: ["web"], p_limit: 10 });
  if (error) throw Error(`Claiming plan changes: ${error.message}`);
  let completed = 0, changes = 0, deferred = 0;
  for (const task of tasks) {
    try {
      if (!task.token || !task.payload || typeof task.payload !== "object" || Array.isArray(task.payload)) throw Error("Missing plan-change claim");
      const payload = task.payload;
      const notices = detectPlanChanges(snapshot(payload.before), snapshot(payload.after));
      const { data, error } = await db.rpc("pipeline_finish_plan_changes", { p_key: task.key, p_token: task.token, p_payload: payload, p_changes: notices as unknown as Json });
      if (error) throw Error(`Completing plan changes: ${error.message}`);
      if (data !== true) { deferred++; continue; }
      completed++; changes += notices.length;
    } catch (error) {
      const retry = await db.rpc("pipeline_retry_task", { p_key: task.key, p_token: task.token!, p_error: error instanceof Error ? error.message : "Plan changes interrupted", p_delay_seconds: 3600 });
      if (retry.error) throw Error(`Recording plan-change retry: ${retry.error.message}`);
      deferred++;
    }
  }
  return { completed, changes, deferred };
}

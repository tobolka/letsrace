/** Inspect a recovery point by default; --apply calls the guarded transaction. */
import { config } from "dotenv";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "../src/lib/supabase/server";
config({ path: ".env.local", quiet: true });

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("A service-role connection is required");
  const id = process.argv.find(a => a.startsWith("--history="))?.slice(10);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Supply --history=<merge history UUID>; add --apply to restore");
  // This migration adds private administrative functions, not catalogue types.
  const db: SupabaseClient = createServerSupabase();
  const { data: row, error } = await db.from("pipeline_merge_history").select("id,keep_id,drop_id,created_at,restored_at,after_state").eq("id", id).single();
  if (error) throw error;
  const { data: current, error: readError } = await db.rpc("app_merge_snapshot", { keep_id: row.keep_id, drop_id: row.drop_id });
  if (readError) throw readError;
  const unchanged = JSON.stringify(current) === JSON.stringify(row.after_state);
  console.log(JSON.stringify({ id, keep: row.keep_id, drop: row.drop_id, mergedAt: row.created_at,
    restoredAt: row.restored_at, unchanged, apply: process.argv.includes("--apply") }, null, 2));
  if (row.restored_at || !unchanged) throw new Error("Recovery point is stale or already restored; inspect and reconcile manually");
  if (!process.argv.includes("--apply")) return;
  const { error: restoreError } = await db.rpc("app_restore_event_merge", { history_id: id });
  if (restoreError) throw restoreError;
  console.log("Restored. Event rows, sources, facts, memberships and personal plans recovered in one transaction.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });

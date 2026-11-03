import type { SupabaseClient } from "@supabase/supabase-js";

/** Existing matched race, protected fields and history commit together. */
export async function updateEventPreservingKey(
  supabase: SupabaseClient,
  id: string,
  payload: Record<string, unknown>,
  evidence: { revision: string; sourceUrl: string; quote?: string | null; model?: string | null },
): Promise<{ retainedKey: boolean; changed: boolean }> {
  const { data, error } = await supabase.rpc("pipeline_update_watcher_event", {
    p_event: id, p_revision: evidence.revision, p_patch: payload,
    p_evidence: { sourceUrl: evidence.sourceUrl, quote: evidence.quote ?? null, model: evidence.model ?? null },
  });
  if (error) throw new Error(`Updating race: ${error.message}`);
  const receipt = data as { retainedKey?: unknown; changed?: unknown; applied?: unknown } | null;
  if (!receipt || typeof receipt.retainedKey !== "boolean" || typeof receipt.changed !== "boolean" || !receipt.applied || typeof receipt.applied !== "object" || Array.isArray(receipt.applied)) {
    throw new Error("Race update was not confirmed");
  }
  // Later plan-change reporting must use what survived the current manual locks.
  for (const key of Object.keys(payload)) Reflect.deleteProperty(payload, key);
  Object.assign(payload, receipt.applied);
  return { retainedKey: receipt.retainedKey, changed: receipt.changed };
}

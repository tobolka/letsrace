import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { ParsedEvent } from "@/lib/domain";
import { sourceEvidenceRecord } from "@/lib/catalog/source-evidence";
import { mergeCategoryEvidence } from "@/lib/catalog/merge-category-evidence";
import { currentSourceLease } from "@/lib/pipeline/source-work";

export type NewRaceLocationPlan = { action: "create"; row: Record<string, unknown> } | { action: "geocode"; id: string; expectedLat: number | null; expectedLng: number | null; lat: number; lng: number };

/** A new race becomes visible together with its source, categories and memberships. */
export async function createWatcherEvent(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  source: { watchedUrlId: string; kind: string; event: ParsedEvent; reviewed: boolean },
  location: NewRaceLocationPlan | null,
  secondarySeries: string[],
): Promise<{ id: string }> {
  const id = randomUUID(), snapshot = sourceEvidenceRecord(id, source.watchedUrlId, source.kind, source.event);
  const categories = mergeCategoryEvidence([], (source.event.categories ?? []).map(c => ({
    name: c.name, distance_km: c.distanceKm ?? null, age_min: c.ageMin ?? null, age_max: c.ageMax ?? null, audience: c.audience ?? source.event.audience ?? null,
  })));
  const { data, error } = await supabase.rpc("pipeline_create_watcher_event", {
    p_event: id, p_payload: payload, p_source: snapshot.value, p_hash: snapshot.hash, p_reader: snapshot.reader,
    p_reviewed: source.reviewed, p_location: location, p_categories: categories, p_secondary: [...new Set(secondarySeries)],
    p_lease: currentSourceLease() ?? null,
  });
  if (error) throw Object.assign(new Error(`Creating race: ${error.message}`), { code: error.code });
  if (!data || typeof data !== "object" || data.id !== id || data.created !== true) throw Error("New race transaction was not confirmed");
  return { id };
}

/** Existing matched race, protected fields and history commit together. */
export async function updateEventPreservingKey(
  supabase: SupabaseClient,
  id: string,
  payload: Record<string, unknown>,
  evidence: { revision: string; sourceUrl: string; quote?: string | null; model?: string | null; location?: NewRaceLocationPlan | null; secondarySeries?: string[]; sourceKind?: string; source?: { watchedUrlId: string; kind: string; event: ParsedEvent } },
): Promise<{ retainedKey: boolean; changed: boolean }> {
  const { watcherEvidencePlan } = await import("./evidence-plan");
  const plan = evidence.source ? await watcherEvidencePlan(supabase, id, evidence.source, true) : null;
  const { data, error } = await supabase.rpc(plan ? "pipeline_update_watcher_bundle" : "pipeline_update_watcher_event", {
    p_event: id, p_revision: evidence.revision, p_patch: payload,
    p_evidence: { sourceUrl: evidence.sourceUrl, quote: evidence.quote ?? null, model: evidence.model ?? null, location: evidence.location ?? null, secondarySeries: evidence.secondarySeries ?? [], sourceKind: evidence.sourceKind ?? null, lease: currentSourceLease() ?? null },
    ...(plan ? { p_source: plan.snapshot.value, p_source_hash: plan.snapshot.hash, p_reader: plan.snapshot.reader, p_categories: plan.categories } : {}),
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

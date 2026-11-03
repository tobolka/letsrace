import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedEvent } from "@/lib/domain";
import { sourceEvidenceRecord } from "@/lib/catalog/source-evidence";
import { mergeCategoryEvidence, type CategoryEvidence } from "@/lib/catalog/merge-category-evidence";
import type { NewRaceLocationPlan } from "@/lib/watcher/write-event";

export type CandidatePublication = { id: string; token: string; evidenceHash: string };

/** Publication receipt and every native race dependency commit together. */
export async function publishCandidatePlan(db: SupabaseClient, claim: CandidatePublication, plan: {
  eventId?: string; revision?: string; payload: Record<string, unknown>;
  watchedUrlId: string; kind: string; event: ParsedEvent;
  location: NewRaceLocationPlan | null; secondarySeries: string[];
}) {
  const id = plan.eventId ?? randomUUID();
  const snapshot = sourceEvidenceRecord(id, plan.watchedUrlId, plan.kind, plan.event);
  let held: CategoryEvidence[] = [];
  if (plan.eventId && plan.event.categories?.length) {
    const { data, error } = await db.from("event_categories").select("id,name,distance_km,age_min,age_max,audience").eq("event_id", id);
    if (error) throw Error(`Reading reviewed categories: ${error.message}`);
    held = data ?? [];
  }
  const categories = plan.event.categories?.length ? mergeCategoryEvidence(held, plan.event.categories.map(c => ({
    name: c.name, distance_km: c.distanceKm ?? null, age_min: c.ageMin ?? null, age_max: c.ageMax ?? null, audience: c.audience ?? plan.event.audience ?? null,
  }))) : [];
  const { data, error } = await db.rpc("pipeline_publish_candidate", {
    p_id: claim.id, p_token: claim.token, p_hash: claim.evidenceHash, p_event: id, p_revision: plan.revision ?? null,
    p_payload: plan.payload, p_source: snapshot.value, p_source_hash: snapshot.hash, p_reader: snapshot.reader,
    p_location: plan.location, p_categories: categories, p_secondary: [...new Set(plan.secondarySeries)],
  });
  if (error) throw Error(`Publishing candidate: ${error.message}`);
  if (!data || data.id !== id || typeof data.created !== "boolean" || typeof data.changed !== "boolean") throw Error("Candidate publication was not confirmed");
  if (!data.created) {
    if (!data.applied || typeof data.applied !== "object" || Array.isArray(data.applied)) throw Error("Candidate update was not confirmed");
    for (const key of Object.keys(plan.payload)) Reflect.deleteProperty(plan.payload, key);
    Object.assign(plan.payload, data.applied);
  }
  return { id, created: data.created as boolean, changed: data.changed as boolean };
}

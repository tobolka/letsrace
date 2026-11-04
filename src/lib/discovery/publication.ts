import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedEvent } from "@/lib/domain";
import { watcherEvidencePlan } from "@/lib/watcher/evidence-plan";
import { writeWatcherWithSeries, type NewRaceLocationPlan, type WatcherSeriesPlan } from "@/lib/watcher/write-event";

export type CandidatePublication = { id: string; token: string; evidenceHash: string };

/** Publication receipt and every native race dependency commit together. */
export async function publishCandidatePlan(db: SupabaseClient, claim: CandidatePublication, plan: {
  eventId?: string; revision?: string; payload: Record<string, unknown>;
  watchedUrlId: string; kind: string; event: ParsedEvent;
  location: NewRaceLocationPlan | null; secondarySeries: string[]; seriesPlans?: WatcherSeriesPlan[];
}) {
  const id = plan.eventId ?? randomUUID();
  const { snapshot, categories } = await watcherEvidencePlan(db, id, plan, Boolean(plan.eventId));
  const { data, error } = await writeWatcherWithSeries(db, "publish", "pipeline_publish_candidate", {
    p_id: claim.id, p_token: claim.token, p_hash: claim.evidenceHash, p_event: id, p_revision: plan.revision ?? null,
    p_payload: plan.payload, p_source: snapshot.value, p_source_hash: snapshot.hash, p_reader: snapshot.reader,
    p_location: plan.location, p_categories: categories, p_secondary: [...new Set(plan.secondarySeries)],
  }, plan.seriesPlans);
  if (error) throw Error(`Publishing candidate: ${error.message}`);
  if (!data || typeof data.id !== "string" || data.created !== !plan.eventId || (plan.eventId && data.id !== plan.eventId) || typeof data.changed !== "boolean") throw Error("Candidate publication was not confirmed");
  if (!data.created) {
    if (!data.applied || typeof data.applied !== "object" || Array.isArray(data.applied)) throw Error("Candidate update was not confirmed");
    for (const key of Object.keys(plan.payload)) Reflect.deleteProperty(plan.payload, key);
    Object.assign(plan.payload, data.applied);
  }
  return { id: data.id as string, created: data.created as boolean, changed: data.changed as boolean };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedEvent } from "@/lib/domain";
import { sourceEvidenceRecord } from "@/lib/catalog/source-evidence";
import { mergeCategoryEvidence, type CategoryEvidence } from "@/lib/catalog/merge-category-evidence";

/** Read categories before the revision-protected write; a later edit invalidates the plan. */
export async function watcherEvidencePlan(db: SupabaseClient, id: string, source: { watchedUrlId: string; kind: string; event: ParsedEvent }, existing: boolean) {
  const snapshot = sourceEvidenceRecord(id, source.watchedUrlId, source.kind, source.event);
  let held: CategoryEvidence[] = [];
  if (existing && source.event.categories?.length) {
    const { data, error } = await db.from("event_categories").select("id,name,distance_km,age_min,age_max,audience").eq("event_id", id);
    if (error) throw Error(`Reading source categories: ${error.message}`);
    held = data ?? [];
  }
  const categories = source.event.categories?.length ? mergeCategoryEvidence(held, source.event.categories.map(c => ({
    name: c.name, distance_km: c.distanceKm ?? null, age_min: c.ageMin ?? null, age_max: c.ageMax ?? null, audience: c.audience ?? source.event.audience ?? null,
  }))) : [];
  return { snapshot, categories };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { detectPlanChanges, type EventSnapshot } from "@/lib/plan-changes";

export async function recordEventPlanChanges(
  supabase: SupabaseClient,
  eventId: string,
  before: EventSnapshot,
  after: EventSnapshot,
): Promise<number> {
  const changes = detectPlanChanges(before, after);
  if (changes.length === 0) return 0;
  const { error } = await supabase.from("event_plan_changes").upsert(
    changes.map((c) => ({
      event_id: eventId,
      kind: c.kind,
      fingerprint: c.fingerprint,
      payload: c.payload,
    })),
    { onConflict: "event_id,kind,fingerprint", ignoreDuplicates: true },
  );
  if (error) {
    console.error("event_plan_changes", error.message);
    return 0;
  }
  return changes.length;
}

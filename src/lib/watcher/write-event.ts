import type { SupabaseClient } from "@supabase/supabase-js";

/** Updating a proven source match must never adopt another row's unique key. */
export async function updateEventPreservingKey(supabase: SupabaseClient, id: string, payload: Record<string, unknown>) {
  let { error } = await supabase.from("events").update(payload).eq("id", id);
  const retainedKey = error?.code === "23505" && error.message.includes("events_fingerprint_key");
  if (retainedKey) {
    Reflect.deleteProperty(payload, "fingerprint");
    ({ error } = await supabase.from("events").update(payload).eq("id", id));
  }
  if (error) throw new Error(`Updating race: ${error.message}`);
  return { retainedKey };
}

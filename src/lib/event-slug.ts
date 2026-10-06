import type { SupabaseClient } from "@supabase/supabase-js";
import { eventSlugCandidates } from "@/lib/domain";

/**
 * The best free address for a new race: the first of `eventSlugCandidates`
 * that no race has and no race used to have. A stamp is the last resort, for
 * a name, place and date that all repeat.
 */
export async function freeEventSlug(
  supabase: SupabaseClient,
  race: { name: string; startDate: string; place?: string | null },
): Promise<string> {
  const candidates = eventSlugCandidates(race.name, race.startDate, race.place);
  const [{ data: live }, { data: old }] = await Promise.all([
    supabase.from("events").select("slug").in("slug", candidates),
    supabase.from("event_slug_aliases").select("slug").in("slug", candidates),
  ]);
  const taken = new Set([...(live ?? []), ...(old ?? [])].map((r) => String(r.slug)));
  return candidates.find((c) => !taken.has(c)) ?? `${candidates.at(-1)}-${Date.now().toString(36)}`;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { eventSlugCandidates } from "@/lib/domain";

/**
 * The best free address for a new race: the first of `eventSlugCandidates`
 * no race has. A stamp is the last resort, for a name, place and date that
 * all repeat.
 */
export async function freeEventSlug(
  supabase: SupabaseClient,
  race: { name: string; startDate: string; place?: string | null },
): Promise<string> {
  const candidates = eventSlugCandidates(race.name, race.startDate, race.place);
  const { data } = await supabase.from("events").select("slug").in("slug", candidates);
  const taken = new Set((data ?? []).map((r) => String(r.slug)));
  return candidates.find((c) => !taken.has(c)) ?? `${candidates.at(-1)}-${Date.now().toString(36)}`;
}

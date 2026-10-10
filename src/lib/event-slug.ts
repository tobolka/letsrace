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

/** What an address says about its race: the words of the name, and its day or year. */
export function parseRaceSlug(slug: string): { words: string[]; date: string | null; year: string | null } {
  const s = slug.toLowerCase();
  const date = s.match(/(?:^|-)((?:19|20)\d{2}-\d{2}-\d{2})$/)?.[1] ?? null;
  const rest = date ? s.slice(0, -date.length) : s;
  const parts = rest.split("-").filter(Boolean);
  const year = date?.slice(0, 4) ?? [...parts].reverse().find((p) => /^(?:19|20)\d{2}$/.test(p)) ?? null;
  return { words: parts.filter((p) => !/^\d+$/.test(p)), date, year };
}

/**
 * How much of an address a race's own slug accounts for, 0–1: the share of the
 * address's words that the race's slug has. Older slugs dropped words the
 * current ones keep (`ct-author-2026-10-10` for `ct-author-cup-2026`), so the
 * address's words are measured against the race's, not the other way round.
 */
export function slugMatchScore(slug: string, race: { slug: string; startDate: string }): number {
  const want = parseRaceSlug(slug);
  if (!want.words.length) return 0;
  if (want.date && want.date !== race.startDate) return 0;
  if (want.year && want.year !== race.startDate.slice(0, 4)) return 0;
  const have = new Set(race.slug.split("-"));
  return want.words.filter((w) => have.has(w)).length / want.words.length;
}

/**
 * The race an address that no race has stands for, when one race clearly is
 * it — every word of the address in its slug, on the day or in the year the
 * address names, and no other race as good. Otherwise null, and the nearest
 * ones are only suggested.
 */
export function rankRacesForSlug<T extends { slug: string; startDate: string }>(
  slug: string,
  races: T[],
): { match: T | null; near: T[] } {
  const scored = races
    .map((race) => ({ race, score: slugMatchScore(slug, race) }))
    .filter((r) => r.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.race.slug.length - b.race.slug.length);
  const [best, second] = scored;
  const { date, year } = parseRaceSlug(slug);
  const match =
    best && best.score === 1 && (date || year) && (!second || second.score < 1) ? best.race : null;
  return { match, near: scored.filter((r) => r.race !== match).slice(0, 5).map((r) => r.race) };
}

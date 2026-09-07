import { createServerSupabase } from "@/lib/supabase/server";
import { audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import {
  fetchRaceResultContests,
  parseContestCategories,
  raceResultEventId,
} from "@/lib/watcher/extractors/contest-categories";

/**
 * Fill age categories from a timing platform's own contest list.
 *
 * RaceResult publishes the contests an event runs at a public config endpoint —
 * "56 km - hlavní závod", "1 km - děti nejmladší II.", "Schülerrennen U13" —
 * and those names are the organiser saying which categories exist. The page
 * itself renders that list in the browser, so the endpoint is the only way to
 * read it without one.
 *
 * Bounded like the Italian pass: a few dozen a run is enough to keep up, and a
 * three-times-a-day tidy has no business crawling.
 */
export async function fillRaceResultAgeCategories(opts?: {
  max?: number;
  delayMs?: number;
}): Promise<{ attempted: number; filled: number; silent: number; failed: number }> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 30;
  const delayMs = opts?.delayMs ?? 350;
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("events")
    .select(
      "id, website_url, registration_url, sources:event_sources(source_url)",
    )
    .eq("visibility", "public")
    .in("status", ["scheduled", "tbc", "postponed", "registration_open"])
    .gte("start_date", today)
    .or("age_categories.is.null,age_categories.eq.{}")
    .order("start_date", { ascending: true })
    .limit(600);

  const rows = (data ?? []) as unknown as {
    id: string;
    website_url: string | null;
    registration_url: string | null;
    sources: { source_url: string | null }[] | null;
  }[];

  const targets: { id: string; eventId: string }[] = [];
  for (const row of rows) {
    const eventId = [
      row.website_url,
      row.registration_url,
      ...(row.sources ?? []).map((s) => s.source_url),
    ]
      .map((u) => raceResultEventId(u))
      .find((v): v is string => Boolean(v));
    if (eventId) targets.push({ id: row.id, eventId });
    if (targets.length >= max) break;
  }

  const result = { attempted: targets.length, filled: 0, silent: 0, failed: 0 };
  for (const target of targets) {
    try {
      const ages = parseContestCategories(await fetchRaceResultContests(target.eventId));
      if (!ages.length) {
        result.silent += 1;
        continue;
      }
      const { error } = await supabase
        .from("events")
        .update({
          age_categories: ages,
          audience: audienceFromAgeCategories(ages as AgeCategory[]),
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id);
      if (error) result.failed += 1;
      else result.filled += 1;
    } catch {
      result.failed += 1;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return result;
}

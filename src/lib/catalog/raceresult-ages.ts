import { createServerSupabase } from "@/lib/supabase/server";
import { recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import {
  fetchRaceResultContests,
  parseContestCategories,
  raceResultEventId,
} from "@/lib/watcher/extractors/contest-categories";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { mayInheritSeriesAges } from "@/lib/catalog/series-ages";
import { recordFacts } from "@/lib/catalog/facts";

const PAGE = 1000;

/**
 * Fill age categories from a timing platform's own contest list.
 *
 * RaceResult publishes the contests an event runs at a public config endpoint —
 * "56 km - hlavní závod", "1 km - děti nejmladší II.", "Schülerrennen U13" —
 * and those names are the organiser saying which categories exist. The page
 * itself renders that list in the browser, so the endpoint is the only way to
 * read it without one.
 *
 * Bounded like the Italian pass, and forgetful in the same way it is not: an
 * event whose contest list is empty is remembered, so the next run spends its
 * budget on events that have not been asked yet.
 */
export async function fillRaceResultAgeCategories(opts?: {
  max?: number;
  delayMs?: number;
  dryRun?: boolean;
  log?: (line: string) => void;
}): Promise<{ attempted: number; filled: number; silent: number; failed: number }> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 30;
  const delayMs = opts?.delayMs ?? 350;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "raceresult_ages_v2");

  const targets: { id: string; eventId: string; name: string; startDate: string; previous: string[] | null; confidence: string | null; audience: string | null }[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    const { data, error } = await supabase
      .from("events")
      .select("id,name,start_date,age_categories,age_confidence,audience,website_url,registration_url,sources:event_sources(source_url),overrides:event_overrides(locked_fields)")
      .eq("visibility", "public")
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .is("merged_into_id", null)
      .or("age_categories.is.null,age_categories.eq.{},age_confidence.is.null,age_confidence.neq.explicit")
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;

    const rows = (data ?? []) as unknown as {
      id: string;
      name: string; start_date: string; age_categories: string[] | null; age_confidence: string | null; audience: string | null;
      overrides: { locked_fields: string[] | null } | null;
      website_url: string | null;
      registration_url: string | null;
      sources: { source_url: string | null }[] | null;
    }[];
    for (const row of rows) {
      if (skip.has(row.id)) continue;
      if (!mayInheritSeriesAges({ ...row, locked_fields: row.overrides?.locked_fields })) continue;
      const eventId = [
        row.website_url,
        row.registration_url,
        ...(row.sources ?? []).map((s) => s.source_url),
      ]
        .map((u) => raceResultEventId(u))
        .find((v): v is string => Boolean(v));
      if (eventId) targets.push({ id: row.id, eventId, name: row.name, startDate: row.start_date, previous: row.age_categories, confidence: row.age_confidence, audience: row.audience });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result = { attempted: targets.length, filled: 0, silent: 0, failed: 0 };
  const contests = new Map<string, string[]>();
  for (const target of targets) {
    try {
      if (!contests.has(target.eventId)) contests.set(target.eventId, await fetchRaceResultContests(target.eventId));
      const names = contests.get(target.eventId)!;
      const season = { refYear: Number(target.startDate.slice(0, 4)) };
      const ages = parseContestCategories(names, season);
      if (!ages.length || names.some((name) => !parseContestCategories([name], season).length)) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, target.id, "raceresult_ages_v2", "silent");
        continue;
      }
      opts?.log?.(`${opts.dryRun ? "DRY" : "SET"} ${target.name}: ${ages.join(",")} ← ${names.join(" | ")}`);
      if (opts?.dryRun) { result.filled++; continue; }
      const { data: saved, error } = await supabase
        .from("events")
        .update({
          age_categories: ages,
          // Read off the source's own category list.
          age_confidence: "explicit",
          audience: audienceFromAgeCategories(ages as AgeCategory[]),
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id)
        .or("age_confidence.is.null,age_confidence.neq.explicit,age_categories.is.null,age_categories.eq.{}")
        .select("id");
      if (error) {
        result.failed += 1;
        await recordProbe(supabase, target.id, "raceresult_ages_v2", "failed");
      } else {
        if (!saved?.length) continue;
        const sourceUrl = `https://my.raceresult.com/${target.eventId}/`;
        await recordFacts(supabase, target.id, [
          { field: "age_categories", value: ages, previous: target.previous, sourceUrl, quote: names.join(" | ") },
          { field: "age_confidence", value: "explicit", previous: target.confidence, sourceUrl },
          { field: "audience", value: audienceFromAgeCategories(ages), previous: target.audience, sourceUrl },
        ], { method: "raceresult_contests", version: "contest-categories-v2" });
        result.filled += 1;
      }
    } catch {
      result.failed += 1;
      if (!opts?.dryRun) await recordProbe(supabase, target.id, "raceresult_ages_v2", "failed");
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return result;
}

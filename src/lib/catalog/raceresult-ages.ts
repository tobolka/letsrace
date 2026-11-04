import { createServerSupabase } from "@/lib/supabase/server";
import { recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { AGE_CATEGORIES, audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import {
  fetchRaceResultProgramme,
  parseContestCategories,
  parseContestAdmission,
  raceResultEventId,
} from "@/lib/watcher/extractors/contest-categories";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { mayInheritSeriesAges } from "@/lib/catalog/series-ages";
import { corroborateRaceResultDate, nearbyEditionDate } from "@/lib/catalog/raceresult-date";
import { preferDeeperOfficialUrl } from "@/lib/watcher/public-url";
import type { Update } from "@/lib/supabase/tables";

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
  ids?: string[];
  log?: (line: string) => void;
}): Promise<{ attempted: number; filled: number; silent: number; failed: number }> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 30;
  const delayMs = opts?.delayMs ?? 350;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "raceresult_ages_v5", { silentDays: 7 });

  const targets: { id: string; revision: string; eventId: string; name: string; startDate: string; endDate: string | null; website: string | null; regulations: string | null; locked: string[] }[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    const { data, error } = await supabase
      .from("events")
      .select("id,public_revision,name,start_date,end_date,regulations_url,age_categories,age_confidence,audience,website_url,registration_url,sources:event_sources(source_url),overrides:event_overrides(locked_fields)")
      .eq("visibility", "public")
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .is("merged_into_id", null)
      .or("age_categories.is.null,age_categories.eq.{},age_confidence.is.null,age_confidence.neq.explicit")
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;

    const rows = data ?? [];
    for (const row of rows) {
      if (opts?.ids && !opts.ids.includes(row.id)) continue;
      if (skip.has(row.id) && !opts?.ids) continue;
      if (!mayInheritSeriesAges({ ...row, locked_fields: row.overrides?.locked_fields })) continue;
      const eventId = [
        row.website_url,
        row.registration_url,
        ...(row.sources ?? []).map((s) => s.source_url),
      ]
        .map((u) => raceResultEventId(u))
        .find((v): v is string => Boolean(v));
      if (eventId) targets.push({ id: row.id, revision: row.public_revision, eventId, name: row.name, startDate: row.start_date, endDate: row.end_date, website: row.website_url, regulations: row.regulations_url, locked: row.overrides?.locked_fields ?? [] });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result = { attempted: targets.length, filled: 0, silent: 0, failed: 0 };
  const contests = new Map<string, Awaited<ReturnType<typeof fetchRaceResultProgramme>>>();
  for (const target of targets) {
    try {
      if (!contests.has(target.eventId)) contests.set(target.eventId, await fetchRaceResultProgramme(target.eventId));
      const programme = contests.get(target.eventId)!;
      if (programme.startDate && target.startDate !== programme.startDate && nearbyEditionDate(target.startDate, programme.startDate, programme.endDate)
        && !target.locked.some((field) => ["start_date", "end_date"].includes(field))) {
        const proof = await corroborateRaceResultDate(target.eventId, target.name, programme.startDate);
        if (proof) {
          opts?.log?.(`${opts.dryRun ? "DRY" : "DATE"} ${target.name}: ${target.startDate} → ${programme.startDate} ← ${proof.sourceUrl}`);
          if (!opts?.dryRun) {
            const patch: Update<"events"> = { start_date: programme.startDate, end_date: programme.endDate };
            if (!target.locked.includes("website_url") && proof.websiteUrl) patch.website_url = preferDeeperOfficialUrl(proof.websiteUrl, target.website);
            if (!target.locked.includes("regulations_url") && !target.regulations) patch.regulations_url = proof.sourceUrl;
            const { data, error } = await supabase.rpc("pipeline_apply_catalogue_age_read", {
              p_event: target.id, p_revision: target.revision, p_patch: patch,
              p_method: "raceresult_official_date", p_version: "raceresult-date-v1",
              p_source: proof.sourceUrl, p_quote: proof.quote,
            });
            if (error) throw error;
            if (!data) continue;
            target.revision = data;
          }
          target.startDate = programme.startDate;
        }
      }
      const names = programme.names;
      const season = { refYear: Number(target.startDate.slice(0, 4)) };
      const mapped = programme.admissions.map((contest) => parseContestAdmission(contest, season.refYear).length ? parseContestAdmission(contest, season.refYear) : parseContestCategories([contest.name], season));
      const ages = AGE_CATEGORIES.filter((age) => mapped.some((bands) => bands.includes(age)));
      if (!programme.startDate || !programme.endDate || target.startDate < programme.startDate || target.startDate > programme.endDate || !ages.length || mapped.some((bands) => !bands.length) || names.some((name) => /\bberg?lauf|\blauf\b|\brun\b|swim|schwimm/i.test(name))) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, target.id, "raceresult_ages_v5", "silent");
        continue;
      }
      opts?.log?.(`${opts.dryRun ? "DRY" : "SET"} ${target.name}: ${ages.join(",")} ← ${names.join(" | ")}`);
      if (opts?.dryRun) { result.filled++; continue; }
      const { data: saved, error } = await supabase.rpc("pipeline_apply_catalogue_age_read", {
        p_event: target.id, p_revision: target.revision,
        p_patch: { age_categories: ages, age_confidence: "explicit", audience: audienceFromAgeCategories(ages as AgeCategory[]) },
        p_method: "raceresult_contests", p_version: "contest-categories-v5",
        p_source: `https://my.raceresult.com/${target.eventId}/`,
        p_quote: programme.admissions.map(contest => `${contest.name} (DOB ${contest.birthFrom ?? "?"} to ${contest.birthTo ?? "?"})`).join(" | "),
      });
      if (error) throw error;
      if (saved) result.filled += 1;
    } catch {
      result.failed += 1;
      if (!opts?.dryRun) await recordProbe(supabase, target.id, "raceresult_ages_v5", "failed");
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return result;
}

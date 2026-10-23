import { createServerSupabase } from "@/lib/supabase/server";
import { clearProbe, recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { ageCategoriesFromList } from "@/lib/age-bands";
import { audienceFromAgeCategories } from "@/lib/taxonomy";
import { renderCscRaceDetails } from "@/lib/watcher/extractors/csc-render";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import type { Update } from "@/lib/supabase/tables";

const PAGE = 1000;

/**
 * The classes the portal fills in when an organiser does not choose: the same
 * eight on a BMX derby, a pumptrack, a gravel ride and a women's race. That
 * list is the form's, not the organiser's, and reads as nothing.
 */
const PORTAL_DEFAULT_CLASSES = new Set([
  "elite",
  "junior",
  "juniorky",
  "zaci - mladsi",
  "zaci - starsi",
  "zakyne - mladsi",
  "zakyne - starsi",
  "zeny",
]);

export function isPortalDefaultClassList(categories: string[]): boolean {
  const norm = categories.map((c) =>
    c.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim(),
  );
  return norm.length === PORTAL_DEFAULT_CLASSES.size && norm.every((c) => PORTAL_DEFAULT_CLASSES.has(c));
}
const CSC_RACE = /portal\.czechcyclingfederation\.com\/RaceDetail\/Race\/\d+/i;

/**
 * Read the classes each Czech federation race runs from its own page.
 *
 * Two in three Czech races had no categories, and most of them come from the
 * federation portal, whose calendar lists a name, a place and a date — nothing
 * about who may start. The race page says it outright, as a list of the
 * federation's classes ("Žáci - mladší", "Kadetky", "Masters"), and that list
 * is the organiser's own answer: it replaces a guess from the discipline, and
 * is stored as stated.
 *
 * The page is a Blazor app, so this needs a local Chrome and does nothing on
 * Vercel. A page that lists no classes is remembered and asked again later.
 */
export async function fillCscAgeCategories(opts?: {
  max?: number;
  budgetMs?: number;
  dryRun?: boolean;
  log?: (line: string) => void;
}): Promise<{ attempted: number; filled: number; entryWindows: number; silent: number; failed: number }> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 200;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "csc_ages");

  const targets: { id: string; name: string; startDate: string; url: string; needsWindow: boolean; needsWeb: boolean; needsAges: boolean }[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    const { data } = await supabase
      .from("events")
      .select("id, name, start_date, age_categories, age_confidence, registration_closes_at, website_url, sources:event_sources(source_url)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      // Anything the source has not stated: nothing at all, or a guess.
      .or("age_categories.is.null,age_categories.eq.{},age_confidence.is.null,age_confidence.eq.default,website_url.is.null")
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const rows = data ?? [];
    for (const row of rows) {
      if (skip.has(row.id)) continue;
      const url = (row.sources ?? []).map((s) => s.source_url ?? "").find((u) => CSC_RACE.test(u));
      if (!url) continue;
      targets.push({
        id: row.id,
        name: row.name,
        startDate: row.start_date,
        url: url.match(/^https?:\/\/[^?#]+/)![0],
        needsWindow: row.registration_closes_at == null,
        needsWeb: row.website_url == null,
        needsAges: !(row.age_categories ?? []).length || row.age_confidence !== "explicit",
      });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result = { attempted: targets.length, filled: 0, entryWindows: 0, silent: 0, failed: 0 };
  const byUrl = new Map<string, typeof targets>();
  for (const t of targets) byUrl.set(t.url, [...(byUrl.get(t.url) ?? []), t]);

  await renderCscRaceDetails([...byUrl.keys()], {
    budgetMs: opts?.budgetMs,
    onPage: async (url, detail) => {
      for (const target of byUrl.get(url) ?? []) {
        if (!detail) {
          result.failed += 1;
          if (!opts?.dryRun) await recordProbe(supabase, target.id, "csc_ages", "failed");
          opts?.log?.(`FAIL  ${target.startDate}  ${target.name}`);
          continue;
        }
        const ages = isPortalDefaultClassList(detail.categories)
          ? []
          : ageCategoriesFromList(detail.categories.map((name) => ({ name })));
        const patch: Update<"events"> = {};
        // The organiser's own site, which the portal lists and we never kept:
        // a third of Czech races had no link at all.
        const web = (detail.web ?? "").trim().replace(/[.,;]+$/, "");
        if (target.needsWeb && web && !/facebook\.com|instagram\.com/i.test(web)) {
          patch.website_url = /^https?:\/\//i.test(web) ? web : `https://${web.replace(/^\/+/, "")}`;
        }
        if (ages.length && target.needsAges) {
          patch.age_categories = ages;
          patch.age_confidence = "explicit";
          patch.audience = audienceFromAgeCategories(ages);
        }
        // The deadline only when the page is plainly about this race's day,
        // and only when it is before it: most pages put the race day itself,
        // which says nothing more than "enter on the day".
        if (
          target.needsWindow &&
          detail.entriesCloseDate &&
          detail.startDate === target.startDate &&
          detail.entriesCloseDate < target.startDate
        ) {
          patch.registration_closes_at = detail.entriesCloseDate;
        }
        if (!Object.keys(patch).length) {
          result.silent += 1;
          if (!opts?.dryRun) await recordProbe(supabase, target.id, "csc_ages", "silent");
          opts?.log?.(`EMPTY ${target.startDate}  ${target.name}  [${detail.categories.join(", ")}]`);
          continue;
        }
        opts?.log?.(`${opts?.dryRun ? "DRY " : "SET "} ${target.startDate}  ${target.name}  → ${ages.join(", ")}`);
        if (opts?.dryRun) {
          result.filled += 1;
          continue;
        }
        patch.updated_at = new Date().toISOString();
        const { error } = await supabase.from("events").update(patch).eq("id", target.id);
        if (error) {
          result.failed += 1;
          await recordProbe(supabase, target.id, "csc_ages", "failed");
        } else {
          result.filled += 1;
          if (patch.registration_closes_at) result.entryWindows += 1;
          await clearProbe(supabase, target.id, "csc_ages");
        }
      }
    },
  });
  return result;
}

import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { mayInheritSeriesAges } from "@/lib/catalog/series-ages";
import { recordFacts } from "@/lib/catalog/facts";
import { raceResultEventId } from "@/lib/watcher/extractors/contest-categories";
import { htmlRegistrationCategories, partialCategoryPatch, raceResultRegistrationEvidence, registrationEditionMatches } from "@/lib/catalog/registration-categories";
import { fetchPage } from "@/lib/watcher/http";

/** Supplement gaps with positive category evidence; never claim an exhaustive list. */
export async function fillRegistrationAgeEvidence(opts?: { max?: number; dryRun?: boolean; log?: (line: string) => void }) {
  const supabase = createServerSupabase(), max = opts?.max ?? 400;
  const skip = await recentlyProbed(supabase, "registration_categories_v1", { silentDays: 1 });
  type Row = { id: string; name: string; start_date: string; registration_url: string | null; website_url: string | null; age_categories: string[] | null; age_confidence: string | null; sources: { source_url: string | null }[]; overrides: { locked_fields: string[] | null } | null };
  const targets: Row[] = [];
  for (let from = 0; targets.length < max; from += 1000) {
    const { data, error } = await supabase.from("events")
      .select("id,name,start_date,registration_url,website_url,age_categories,age_confidence,sources:event_sources(source_url),overrides:event_overrides(locked_fields)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", new Date().toISOString().slice(0, 10))
      .or("age_confidence.is.null,age_confidence.neq.explicit,age_categories.is.null,age_categories.eq.{}")
      .order("start_date").order("id").range(from, from + 999);
    if (error) throw error;
    for (const row of (data ?? []) as unknown as Row[]) {
      if (skip.has(row.id) || !mayInheritSeriesAges({ ...row, locked_fields: row.overrides?.locked_fields })) continue;
      if (row.registration_url || [row.website_url, ...(row.sources ?? []).map((s) => s.source_url)].some((url) => raceResultEventId(url))) targets.push(row);
      if (targets.length >= max) break;
    }
    if ((data ?? []).length < 1000) break;
  }
  const result = { attempted: targets.length, supplemented: 0, silent: 0, failed: 0 };
  opts?.log?.(`Reading public category fields for ${targets.length} races`);
  const cached = new Map<string, Awaited<ReturnType<typeof raceResultRegistrationEvidence>>>();
  for (const row of targets) {
    try {
      const rr = [row.registration_url, row.website_url, ...(row.sources ?? []).map((s) => s.source_url)].map(raceResultEventId).find(Boolean);
      let evidence: { labels: string[]; sourceUrl: string }[] = [];
      if (rr) {
        const cacheKey = `${rr}:${row.start_date}`;
        if (!cached.has(cacheKey)) cached.set(cacheKey, await raceResultRegistrationEvidence(rr, row.start_date));
        evidence = cached.get(cacheKey)!;
      } else if (row.registration_url && /^https?:\/\//.test(row.registration_url)) {
        const page = await fetchPage(row.registration_url, { retries: 1, timeoutMs: 20_000 });
        // A direct stored link still must refer to this edition, not last year's form.
        if (page.status === 200 && registrationEditionMatches(page.html, row.start_date)) {
          const labels = htmlRegistrationCategories(page.html);
          if (labels.length) evidence = [{ labels, sourceUrl: row.registration_url }];
        }
      }
      const labels = [...new Set(evidence.flatMap((item) => item.labels))];
      const patch = partialCategoryPatch(row.age_categories, labels, Number(row.start_date.slice(0, 4)));
      if (!patch) result.silent++;
      else if (opts?.dryRun) {
        opts.log?.(`DRY partial ${row.name}: ${patch.age_categories.join(",")} ← ${labels.join(" | ")}`);
        result.supplemented++;
      } else {
        // Compare-and-set avoids clobbering another reader's newly completed programme.
        let save = supabase.from("events").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", row.id);
        save = row.age_confidence == null ? save.is("age_confidence", null) : save.eq("age_confidence", row.age_confidence);
        save = row.age_categories == null ? save.is("age_categories", null) : save.eq("age_categories", row.age_categories);
        const { data, error } = await save.select("id");
        if (error) throw error;
        if (data?.length) {
          await recordFacts(supabase, row.id, [
            { field: "age_categories", value: patch.age_categories, previous: row.age_categories, sourceUrl: evidence[0]?.sourceUrl, quote: `Non-exhaustive positive evidence: ${evidence.map((item) => `${item.sourceUrl}: ${item.labels.join(" | ")}`).join("\n")}` },
            { field: "age_confidence", value: patch.age_confidence, previous: row.age_confidence, sourceUrl: evidence[0]?.sourceUrl },
          ], { method: "registration_categories", version: "registration-categories-v1" });
          result.supplemented++;
          opts?.log?.(`SET partial ${row.name}: ${patch.age_categories.join(",")} ← ${labels.join(" | ")}`);
        }
      }
      // Both positive and silent partial reads expire: new categories can appear later.
      if (!opts?.dryRun) await recordProbe(supabase, row.id, "registration_categories_v1", "silent");
      opts?.log?.(`READ ${row.name}: ${labels.length} category labels`);
    } catch {
      result.failed++;
      if (!opts?.dryRun) await recordProbe(supabase, row.id, "registration_categories_v1", "failed");
      opts?.log?.(`FAILED category source: ${row.name}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return result;
}

import { createServerSupabase } from "@/lib/supabase/server";
import { recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import {
  fciAdmittedText,
  fciFields,
  fciRegistrationWindow,
  parseFciCategories,
} from "@/lib/watcher/extractors/fci-categories";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import type { Update } from "@/lib/supabase/tables";
import { fetchBot } from "@/lib/http/fetch";

const PAGE = 1000;

/**
 * Read an Italian race's own page and fill what it states.
 *
 * Most races with no categories cannot be filled from anything we hold — the
 * name says nothing and guessing would put "kids" on a race no child may
 * enter. The Italian federation is the exception: every race page carries the
 * admitted categories, or a class that implies them, in the organiser's own
 * words — and, beside them, the dates entries open and close.
 *
 * The entry window is worth as much as the categories. Not one upcoming race
 * in the catalogue had one: the reader that finds a deadline in prose only runs
 * on a page describing a single race, and every source that reaches this
 * catalogue is a calendar. Here the page is a single race, and it says so
 * outright.
 *
 * The calendar the watcher follows carries none of this, only the per-race page
 * does, so this fetches them one at a time and is deliberately bounded. Forty a
 * run, three runs a day, is enough to keep up with a federation that adds a few
 * hundred races a season without turning the hygiene job into a crawler — and
 * what a page could not answer is remembered, so each run reaches further down
 * the list than the last.
 */
export async function fillFciAgeCategories(opts?: {
  max?: number;
  delayMs?: number;
}): Promise<{
  attempted: number;
  filled: number;
  ages: number;
  entryWindows: number;
  silent: number;
  failed: number;
}> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 40;
  const delayMs = opts?.delayMs ?? 400;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "fci_ages");

  const targets: { id: string; revision: string; url: string; needsAges: boolean; needsWindow: boolean; needsOpening: boolean }[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, public_revision, age_categories, registration_opens_at, registration_closes_at, sources:event_sources(source_url)",
      )
      .eq("visibility", "public")
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .or("age_categories.is.null,age_categories.eq.{},registration_closes_at.is.null")
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      if (skip.has(row.id)) continue;
      const url = (row.sources ?? [])
        .map((s) => s.source_url ?? "")
        .find((u) => /members\.federciclismo\.it\/race\/detail\/\d+/.test(u));
      if (url) {
        targets.push({
          id: row.id,
          revision: row.public_revision,
          url,
          needsAges: (row.age_categories ?? []).length === 0,
          needsWindow: row.registration_closes_at == null,
          needsOpening: row.registration_opens_at == null,
        });
      }
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result = {
    attempted: targets.length,
    filled: 0,
    ages: 0,
    entryWindows: 0,
    silent: 0,
    failed: 0,
  };
  for (const target of targets) {
    try {
      const res = await fetchBot(target.url);
      if (!res.ok) {
        result.failed += 1;
        await recordProbe(supabase, target.id, "fci_ages", "failed");
        continue;
      }
      const html = await res.text();
      const patch: Update<"events"> = {};

      if (target.needsAges) {
        // The categories line and the class, read together: the line is blank
        // on about half these pages and the class says it instead.
        const ages = parseFciCategories(fciAdmittedText(html));
        if (ages.length) {
          patch.age_categories = ages;
          patch.age_confidence = "explicit";
          patch.audience = audienceFromAgeCategories(ages as AgeCategory[]);
        }
      }
      if (target.needsWindow) {
        const window = fciRegistrationWindow(html);
        if (window.closesAt) patch.registration_closes_at = window.closesAt;
        if (window.opensAt && target.needsOpening) patch.registration_opens_at = window.opensAt;
      }

      if (Object.keys(patch).length === 0) {
        result.silent += 1;
        await recordProbe(supabase, target.id, "fci_ages", "silent");
        continue;
      }

      const { data: saved, error } = await supabase.rpc("pipeline_apply_catalogue_age_read", {
        p_event: target.id, p_revision: target.revision, p_patch: patch,
        p_method: "fci_ages", p_version: "atomic-v1", p_source: target.url,
        p_quote: [
          patch.age_categories ? fciAdmittedText(html) : null,
          patch.registration_opens_at || patch.registration_closes_at ? fciFields(html)["iscrizioni"] : null,
        ].filter(Boolean).join(" | ") || undefined,
      });
      if (error) {
        result.failed += 1;
        await recordProbe(supabase, target.id, "fci_ages", "failed");
      } else if (saved) {
        result.filled += 1;
        if (patch.age_categories) result.ages += 1;
        if (patch.registration_closes_at) result.entryWindows += 1;
      }
    } catch {
      result.failed += 1;
      await recordProbe(supabase, target.id, "fci_ages", "failed");
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return result;
}

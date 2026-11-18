import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { ageCategoriesFromList } from "@/lib/age-bands";
import { parseContestCategories } from "@/lib/watcher/extractors/contest-categories";
import { AGE_CATEGORIES, audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";

type Item = { label?: string; birthYears?: string; sourceUrl?: string };
type Field = { value?: Item[]; status?: string; editionYear?: number } | undefined;

/** Who one line of the regulations admits: its own name and birth years, else the contest vocabulary. */
function agesOf(item: Item, refYear: number): AgeCategory[] {
  const name = [item.label, item.birthYears].filter(Boolean).join(" ");
  const ages = ageCategoriesFromList([{ name }], { refYear });
  return ages.length ? ages : parseContestCategories([name], { refYear });
}

export type RegulationAges = { ages: AgeCategory[]; complete: boolean; labels: string[]; sourceUrl: string | null };

/**
 * The age classes this edition's regulations name, on our own fixed list.
 *
 * The category list, the fee table and the timetable are each judged on their own. One with at
 * least two different lines, every one of them a class we can place, is the organiser's full list
 * of classes. A fee table that prices courses ("90 km MTB") or dates ("Early Bird"), or a
 * timetable with a briefing in it, is not, and it can only add what it does name. A single line
 * ("Kids & juniors courses") says nothing about who else starts.
 */
export function regulationAges(details: Record<string, Field> | null, refYear: number): RegulationAges | null {
  const current = (key: string) => {
    const field = details?.[key];
    if (!field || !Array.isArray(field.value) || field.status !== "current") return [];
    if (field.editionYear && field.editionYear !== refYear) return [];
    return field.value.filter((item) => item.label);
  };
  const lists = [current("categories"), current("fees"), current("schedule")].filter((list) => list.length);
  if (!lists.length) return null;
  const named = new Set<AgeCategory>(), whole = new Set<AgeCategory>();
  let complete = false;
  for (const list of lists) {
    const read = list.map((item) => agesOf(item, refYear));
    for (const ages of read) for (const age of ages) named.add(age);
    const distinct = new Set(list.map((item) => item.label!.trim().toLowerCase()));
    if (distinct.size >= 2 && read.every((ages) => ages.length)) {
      complete = true;
      for (const ages of read) for (const age of ages) whole.add(age);
    }
  }
  const all = lists.flat();
  return {
    ages: AGE_CATEGORIES.filter((age) => (complete ? whole : named).has(age)),
    complete,
    labels: [...new Set(all.map((item) => item.label!))],
    sourceUrl: all.find((item) => item.sourceUrl)?.sourceUrl ?? null,
  };
}

/** What a race's age classes become once its regulations are read; null when nothing changes. */
export function regulationAgePatch(
  row: { age_categories: string[] | null; age_confidence: string | null },
  read: RegulationAges | null,
) {
  if (!read?.ages.length) return null;
  const previous = row.age_categories ?? [];
  // A full list replaces any guess. It does not narrow a set another source already confirmed:
  // there both are kept. A partial list adds what it names and confirms nothing.
  const narrows = read.complete && row.age_confidence === "explicit" && previous.some((age) => !read.ages.includes(age as AgeCategory));
  const replace = read.complete && !narrows;
  const ages = replace ? read.ages : AGE_CATEGORIES.filter((age) => previous.includes(age) || read.ages.includes(age));
  const confidence = read.complete ? "explicit" : (row.age_confidence ?? "default");
  if (ages.length === previous.length && ages.every((age) => previous.includes(age)) && confidence === row.age_confidence) return null;
  return { age_categories: ages, age_confidence: confidence, audience: audienceFromAgeCategories(ages) };
}

export async function fillAgesFromRegulations(opts?: { dryRun?: boolean; log?: (line: string) => void }) {
  const db = createServerSupabase();
  const result = { read: 0, complete: 0, updated: 0 };
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("events")
      .select("id,public_revision,name,start_date,age_categories,age_confidence,practical_details,overrides:event_overrides(locked_fields)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", new Date().toISOString().slice(0, 10)).neq("practical_details", "{}")
      .order("start_date").order("id").range(from, from + 999);
    if (error) throw error;
    for (const row of data ?? []) {
      // A person set these classes by hand; the regulations do not overrule them.
      const locked = (row.overrides as { locked_fields: string[] | null } | null)?.locked_fields ?? [];
      if (locked.some((field) => ["age_categories", "age_confidence", "audience", "categories"].includes(field))) continue;
      const read = regulationAges(row.practical_details as never, Number(row.start_date.slice(0, 4)));
      if (!read?.ages.length) continue;
      result.read++;
      if (read.complete) result.complete++;
      const patch = regulationAgePatch(row, read);
      if (!patch) continue;
      opts?.log?.(`${opts.dryRun ? "DRY " : ""}${read.complete ? "FULL" : "ADD "} ${row.name}: ${(row.age_categories ?? []).join(",")} → ${patch.age_categories.join(",")}`);
      if (opts?.dryRun) { result.updated++; continue; }
      // The gate lets this reader replace a set another source confirmed, never a locked one.
      const { data: ok, error: e } = await db.rpc("pipeline_apply_periodic_read", {
        p_event: row.id, p_revision: row.public_revision, p_patch: patch,
        p_method: "regulation_categories", p_version: "regulation-categories-v1", p_source: read.sourceUrl ?? undefined,
        p_quote: `${read.complete ? "Complete" : "Partial"} list of classes in the regulations: ${read.labels.join(" | ")}`.slice(0, 1500),
      });
      if (e) throw e;
      if (ok?.length) result.updated++;
    }
    if ((data ?? []).length < 1000) break;
  }
  return result;
}

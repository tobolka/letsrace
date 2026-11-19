import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { ageCategoriesFromList } from "@/lib/age-bands";
import { parseContestCategories } from "@/lib/watcher/extractors/contest-categories";
import { AGE_CATEGORIES, audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";

type Item = { label?: string; birthYears?: string; sourceUrl?: string };
type Field = { value?: Item[]; status?: string; editionYear?: number } | undefined;

/** Who one line of the regulations admits: its own name and birth years, else the contest vocabulary. */
function agesOf(item: Item, refYear: number): AgeCategory[] {
  // A class its name places ("Mladší žáci", "Muži") is that class: the birth years read beside it are
  // often cut or shifted ("MUŽI 2008", "MLADŠÍ ŽÁCI 2015–2017") and made juniors of men and children of pupils.
  const byName = ageCategoriesFromList([{ name: item.label ?? "" }], { refYear });
  const name = [item.label, item.birthYears].filter(Boolean).join(" ");
  const withYears = ageCategoriesFromList([{ name }], { refYear });
  // Children's and youth classes by their name alone. An adult class ("Muži", "Männer/Frauen") keeps what its
  // birth years add: in a regional race the men's class is the open one, which the years show.
  if (byName.length && byName.every((age) => !ADULT.includes(age))) return byName;
  const ages = AGE_CATEGORIES.filter((age) => byName.includes(age) || (withYears.includes(age) && ADULT.includes(age)));
  if (ages.length) return ages;
  return withYears.length ? withYears : parseContestCategories([name], { refYear });
}

export type RegulationAges = {
  ages: AgeCategory[];
  byCourse: boolean;
  /** The race's own category list (propozice) is read for this edition: what it names is the whole field. */
  ownList: boolean;
  labels: string[];
  sourceUrl: string | null;
};

/**
 * The age classes this edition's regulations name, on our own fixed list.
 *
 * Read from the category list, the fee table and the timetable together. What they name is
 * certain. What they leave out is not: the lists read from regulations are often a part of the
 * field (only the youth races of a cyclo-cross with a UCI elite race, only the children of a
 * marathon whose adults enter by course), so leaving a class out never by itself means it is not
 * run. `byCourse` says the fees are priced by course ("90 km MTB"), i.e. an open race no class
 * names.
 */
export function regulationAges(details: Record<string, Field> | null, refYear: number): RegulationAges | null {
  const current = (key: string) => {
    const field = details?.[key];
    if (!field || !Array.isArray(field.value) || field.status !== "current") return [];
    if (field.editionYear && field.editionYear !== refYear) return [];
    return field.value.filter((item) => item.label);
  };
  const all = [...current("categories"), ...current("fees"), ...current("schedule")];
  if (!all.length) return null;
  const found = new Set<AgeCategory>();
  for (const item of all) for (const age of agesOf(item, refYear)) found.add(age);
  return {
    ages: AGE_CATEGORIES.filter((age) => found.has(age)),
    byCourse: current("fees").some((item) => !agesOf(item, refYear).length),
    ownList: current("categories").some((item) => agesOf(item, refYear).length > 0),
    labels: [...new Set(all.map((item) => item.label!))],
    sourceUrl: all.find((item) => item.sourceUrl)?.sourceUrl ?? null,
  };
}

const KIDS: AgeCategory[] = ["kids", "u7", "u9", "u11"];
const ADULT: AgeCategory[] = ["u23", "elite", "amateur", "masters"];
const YOUNG_YOUTH: AgeCategory[] = ["u13", "u15"];

/**
 * What a race's age classes become once its regulations are read; null when nothing changes.
 *
 * A race's own category list (propozice for this edition) is final: the set becomes exactly the
 * classes it names and is confirmed, whatever was guessed or another source said. A later read does
 * not demote it again.
 *
 * Without such a list (classes read from fees or the timetable only, or a race priced by course) every class named is added, a
 * guessed class goes only where the regulations show that end of the field and leave it out
 * (children, when the youth ladder starts at U13 or U15), and the set is confirmed when the
 * regulations account for every class in it. A set another source confirmed loses nothing.
 */
export function regulationAgePatch(
  row: { age_categories: string[] | null; age_confidence: string | null },
  read: RegulationAges | null,
  /** The set now stored was written by this reader: an earlier read of the regulations, not another source. */
  ownPrevious = false,
) {
  if (!read?.ages.length) return null;
  const previous = (row.age_categories ?? []) as AgeCategory[];
  const named = new Set(read.ages);
  const confirmedElsewhere = row.age_confidence === "explicit" && !ownPrevious;
  const childrenRuledOut = !read.byCourse && YOUNG_YOUTH.some((age) => named.has(age)) && !KIDS.some((age) => named.has(age));
  const keep = (age: AgeCategory) => {
    if (named.has(age) || confirmedElsewhere) return true;
    if (KIDS.includes(age)) return !childrenRuledOut;
    return true;
  };
  // The race's own category list (propozice) is final: what it names is the whole field. Nothing guessed or
  // inherited stays beside it, and no other source's confirmed set outranks it. U23 rides with the elite
  // (kept if it was there), "youth" with the U13–U17 classes. Only a race priced by course names no one.
  const final = read.ownList && !read.byCourse;
  const implied = (age: AgeCategory) =>
    (age === "youth" && YOUNG_YOUTH.concat("u17").some((a) => named.has(a))) || (age === "u23" && named.has("elite") && previous.includes("u23"));
  const ages = AGE_CATEGORIES.filter((age) =>
    named.has(age) || (final ? implied(age) : previous.includes(age) && keep(age)));
  const accounted = ages.every((age) => named.has(age) || (age === "u23" && named.has("elite")) || (age === "youth" && YOUNG_YOUTH.concat("u17").some((a) => named.has(a))));
  const confidence = final || accounted || confirmedElsewhere ? "explicit" : ownPrevious ? "default" : (row.age_confidence ?? "default");
  if (ages.length === previous.length && ages.every((age) => previous.includes(age)) && confidence === row.age_confidence) return null;
  return { age_categories: ages, age_confidence: confidence, audience: audienceFromAgeCategories(ages) };
}

/** How this reader's writes are recorded, so its next read may correct them. */
const OWN_QUOTE = /^(Complete|Partial) list of classes in the regulations|^Categories named in the regulations/;
/** The text scanner (regulation-ages.ts) and this reader both read propozice; neither is "another source". */
const OWN_METHODS = new Set(["regulation_categories", "regulation_ages"]);

export async function fillAgesFromRegulations(opts?: { dryRun?: boolean; log?: (line: string) => void }) {
  const db = createServerSupabase();
  const result = { read: 0, updated: 0 };
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("events")
      .select("id,public_revision,name,start_date,age_categories,age_confidence,practical_details,overrides:event_overrides(locked_fields),facts:event_facts(field,quote,method,created_at)")
      .eq("facts.field", "age_categories")
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
      type Fact = { quote: string | null; method: string | null; created_at: string };
      const facts = (row.facts as Fact[] | null) ?? [];
      const last = facts.reduce<Fact | null>((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
      const patch = regulationAgePatch(row, read, OWN_QUOTE.test(last?.quote ?? "") || OWN_METHODS.has(last?.method ?? ""));
      if (!patch) continue;
      opts?.log?.(`${opts.dryRun ? "DRY " : ""}${patch.age_confidence === "explicit" ? "OK  " : "PART"} ${row.name}: ${(row.age_categories ?? []).join(",")} → ${patch.age_categories.join(",")}`);
      if (opts?.dryRun) { result.updated++; continue; }
      // The gate lets this reader replace a set another source confirmed, never a locked one.
      const { data: ok, error: e } = await db.rpc("pipeline_apply_periodic_read", {
        p_event: row.id, p_revision: row.public_revision, p_patch: patch,
        p_method: "regulation_categories", p_version: "regulation-categories-v1", p_source: read.sourceUrl ?? undefined,
        p_quote: `${patch.age_confidence === "explicit" ? "Complete" : "Partial"} list of classes in the regulations: ${read.labels.join(" | ")}`.slice(0, 1500),
      });
      if (e) throw e;
      if (ok?.length) result.updated++;
    }
    if ((data ?? []).length < 1000) break;
  }
  return result;
}

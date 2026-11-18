/**
 * Children's classes on international races (continental level and above) that nothing of the race's own shows.
 * Such a race almost never runs a children's race: the "kids" came from a guess made for national cups.
 * Kept where the race's regulations, its own categories or the quote of the source that set them name children.
 * Never touches a locked race. Dry unless --apply.
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fix-international-kids.ts [--apply] [--out=report.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";

const KIDS = ["kids", "u7", "u9", "u11"];
const KID_WORDS = /\b(kids?|kinder\w*|d[eě]ti|d[eě]tsk\w*|bambin\w*|giovanissim\w*|odr[aá][zž]edl\w*|p[rř][ií]pravk\w*|laufrad|u ?7|u ?9|u ?11|g[1-6]\b)/i;

async function main() {
  for (const [key, value] of Object.entries(parse(readFileSync(".env.local")))) process.env[key] ??= value;
  const apply = process.argv.includes("--apply");
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
  const { isInternationalLevel, audienceFromAgeCategories, AGE_CATEGORIES } = await import("../src/lib/taxonomy");
  const { regulationAges } = await import("../src/lib/catalog/practical-ages");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  type Row = { id: string; slug: string; name: string; start_date: string; level: string | null; age_categories: string[] | null; age_confidence: string | null; public_revision: string;
    practical_details: Record<string, never> | null; overrides: { locked_fields: string[] | null } | null; categories: { name: string | null; age_max: number | null }[];
    facts: { quote: string | null; created_at: string }[] };
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("events")
      .select("id,slug,name,start_date,level,age_categories,age_confidence,public_revision,practical_details,overrides:event_overrides(locked_fields),categories:event_categories(name,age_max),facts:event_facts(field,quote,created_at)")
      .eq("facts.field", "age_categories").is("merged_into_id", null).gte("start_date", today).overlaps("age_categories", KIDS)
      .order("start_date").order("id").range(from, from + 999).returns<Row[]>();
    if (error) throw Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const report: unknown[] = [];
  const stats = { international: 0, kept: 0, locked: 0, fixed: 0 };
  for (const r of rows) {
    if (!isInternationalLevel(r.level)) continue;
    stats.international++;
    const locked = r.overrides?.locked_fields ?? [];
    if (locked.some((f) => ["age_categories", "age_confidence", "audience", "categories"].includes(f))) { stats.locked++; continue; }
    const regs = regulationAges(r.practical_details, Number(r.start_date.slice(0, 4)));
    const lastQuote = [...r.facts].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.quote ?? "";
    const evidence = regs?.ages.some((a) => KIDS.includes(a)) ? "propozice"
      : r.categories.some((c) => (c.age_max != null && c.age_max <= 11) || KID_WORDS.test(c.name ?? "")) ? "kategorie závodu"
      : KID_WORDS.test(lastQuote) ? "citace zdroje"
      // A youth series in its own name ("Rookies Cup", "Youngsters") may well run children's classes: leave it.
      : /rookies|youngsters|nachwuchs|giovanil|ml[aá]de[zž]|youth|jugend|kids/i.test(r.name) ? "mládež v názvu" : null;
    if (evidence) { stats.kept++; report.push({ slug: r.slug, level: r.level, kept: evidence }); continue; }
    const ages = AGE_CATEGORIES.filter((a) => (r.age_categories ?? []).includes(a) && !KIDS.includes(a));
    report.push({ slug: r.slug, level: r.level, from: r.age_categories, to: ages });
    console.log(`${r.start_date} ${r.name.slice(0, 50)} (${r.level}): ${(r.age_categories ?? []).join(",")} → ${ages.join(",")}`);
    if (!apply) { stats.fixed++; continue; }
    const patch = { age_categories: ages, audience: audienceFromAgeCategories(ages as never) };
    const { data, error } = await db.from("events").update(patch).eq("id", r.id).eq("public_revision", r.public_revision).select("id");
    if (error) throw Error(error.message);
    if (!data?.length) continue;
    await db.from("event_facts").insert({ event_id: r.id, field: "age_categories", value: ages as never, previous: r.age_categories as never,
      quote: "International race: no children's class in its regulations, categories or source; the children's classes were a guess.", method: "international_kids", version: "international-kids-v1" });
    stats.fixed++;
  }
  console.log(JSON.stringify({ ...stats, apply }));
  if (out) writeFileSync(out, JSON.stringify(report, null, 1));
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });

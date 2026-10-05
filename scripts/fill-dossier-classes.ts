/**
 * Classes for races that state none yet: gather each race's documents, tie
 * them to the edition by its date, let the model point at the class lines,
 * derive the bands from those lines. Every write is kept in event_facts.
 *   LLM_BUDGET_USD=0.5 node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-dossier-classes.ts [--max=700] [--country=CZ] [--again] [--past] [--apply]
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }

const VERSION = "dossier-classes-v4";
const PROBE = "dossier_classes_v2";
type Row = { id: string; name: string; start_date: string; website_url: string | null; registration_url: string | null; regulations_url: string | null; age_confidence: string | null; age_categories: string[] | null; audience: string | null; overrides: { locked_fields: string[] | null } | null; location: { municipality: string | null; country_code: string | null } | null; sources: { source_url: string | null }[] | null };

async function main() {
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 700);
  const country = process.argv.find((a) => a.startsWith("--country="))?.slice(10);
  const again = process.argv.includes("--again");
  const ids = process.argv.find((a) => a.startsWith("--ids="))?.slice(6).split(",");
  // Last season's races: what they stated carries to this year's edition.
  const past = process.argv.includes("--past");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { gatherDossier } = await import("../src/lib/catalog/dossier");
  const { classesFromDossier, statable, auditDossierClasses } = await import("../src/lib/catalog/dossier-classes");
  const { recordFacts, textHash, alreadyRead, markRead } = await import("../src/lib/catalog/facts");
  const { recentlyProbed, recordProbe } = await import("../src/lib/catalog/probes");
  const { audienceFromAgeCategories } = await import("../src/lib/taxonomy");
  const { mayInheritSeriesAges } = await import("../src/lib/catalog/series-ages");
  const { LlmUnavailable, HAIKU, llmSpent } = await import("../src/lib/llm/anthropic");
  const { mapPool } = await import("../src/lib/watcher/pool");
  const s = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(s, PROBE, { silentDays: 7 });
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await s.from("events").select("id, name, start_date, website_url, registration_url, regulations_url, age_confidence, age_categories,audience,overrides:event_overrides(locked_fields), location:locations(municipality, country_code), sources:event_sources(source_url)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", past ? ["scheduled", "tbc", "confirmed", "completed"] : ["scheduled", "tbc", "confirmed"]).gte("start_date", past ? new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10) : today).lt("start_date", past ? today : "9999-12-31").order("start_date").order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  const targets = rows
    .filter((r) => !ids || ids.includes(r.id))
    .filter((r) => mayInheritSeriesAges({ ...r, locked_fields: r.overrides?.locked_fields }) && (again || !skip.has(r.id)))
    .filter((r) => !country || r.location?.country_code === country)
    .filter((r) => !process.env.CATALOG_COUNTRIES || process.env.CATALOG_COUNTRIES.split(",").includes(r.location?.country_code ?? ""))
    .slice(0, max);
  const result = { targets: targets.length, stated: 0, cached: 0, notSafe: 0, nothing: 0, failed: 0, costUsd: 0 };
  let stop = false;
  await mapPool(targets, 4, async (r) => {
    if (stop) return;
    try {
      const docs = await gatherDossier({ startDate: r.start_date, website: r.website_url, registration: r.registration_url, regulations: r.regulations_url, sources: (r.sources ?? []).map((x) => x.source_url).filter((u): u is string => Boolean(u)), render: process.argv.includes("--render") });
      const readUrl = docs[0]?.url ?? r.website_url ?? r.id;
      const reader = `${VERSION}:${r.id}`;
      const hash = textHash(JSON.stringify({ name: r.name, date: r.start_date, docs }));
      if (!again && await alreadyRead(s, readUrl, reader, hash)) { result.cached++; return; }
      const got = await classesFromDossier({ name: r.name, startDate: r.start_date, place: r.location?.municipality }, docs);
      const remember = async () => { if (apply) { if (got.usage) await markRead(s, readUrl, reader, hash); await recordProbe(s, r.id, PROBE, "silent"); } };
      console.log(`READ ${r.start_date} ${r.name}: ${docs.length} docs, ${docs.filter((d) => d.thisEdition).length} dated, ${got.lines.length} class lines, complete=${got.complete === true}, bands=${got.ages.join(",") || "none"}`);
      if (!got.ages.length) {
        result.nothing += 1;
        await remember();
        return;
      }
      if (!statable({ name: r.name }, got)) {
        result.notSafe += 1;
        await remember();
        return;
      }
      const audit = await auditDossierClasses({ name: r.name, startDate: r.start_date }, got, docs);
      if (!audit.keep) { result.notSafe++; console.log(`REJECT ${r.name}: ${audit.why}`); await remember(); return; }
      if (!apply) result.stated += 1;
      console.log(`${apply ? "SET" : "DRY"}  ${r.start_date}  ${r.name}  → ${got.ages.join(",")}  (had ${(r.age_categories ?? []).join(",") || "-"})\n      ${got.lines.slice(0, 4).map((l) => l.line.slice(0, 100)).join(" | ")}\n      ${got.lines[0]?.url}`);
      if (!apply) return;
      const { data: saved, error } = await s.from("events").update({ age_categories: got.ages, age_confidence: "explicit", audience: audienceFromAgeCategories(got.ages), updated_at: new Date().toISOString() }).eq("id", r.id).or("age_confidence.is.null,age_confidence.neq.explicit,age_categories.is.null,age_categories.eq.{}").select("id");
      if (error) throw error;
      if (saved?.length) {
        result.stated += 1;
        await recordFacts(s, r.id, [
          { field: "age_categories", value: got.ages, previous: r.age_categories, sourceUrl: got.lines[0]?.url, quote: got.lines.map((l) => l.line).join(" | ").slice(0, 2000) },
          { field: "age_confidence", value: "explicit", previous: r.age_confidence, sourceUrl: got.lines[0]?.url },
          { field: "audience", value: audienceFromAgeCategories(got.ages), previous: r.audience, sourceUrl: got.lines[0]?.url },
        ], { method: "llm", model: HAIKU, version: VERSION });
      }
      await remember();
    } catch (e) {
      result.failed += 1;
      console.log(`FAIL ${r.name}: ${e instanceof Error ? e.message : String(e)}`);
      if (e instanceof LlmUnavailable) stop = true;
    }
  });
  console.log({ ...result, costUsd: Number(llmSpent().toFixed(4)), dry: !apply });
}
main().catch((e) => { console.error(e); process.exit(1); });

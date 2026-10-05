/**
 * Classes for races that state none yet: gather each race's documents, tie
 * them to the edition by its date, let the model point at the class lines,
 * derive the bands from those lines. Every write is kept in event_facts.
 *   LLM_BUDGET_USD=0.5 node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-dossier-classes.ts [--max=700] [--country=CZ] [--again] [--past] [--apply]
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }

const VERSION = "dossier-classes-v1";
type Row = { id: string; name: string; start_date: string; website_url: string | null; registration_url: string | null; regulations_url: string | null; age_confidence: string | null; age_categories: string[] | null; location: { municipality: string | null; country_code: string | null } | null; sources: { source_url: string | null }[] | null };

async function main() {
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 700);
  const country = process.argv.find((a) => a.startsWith("--country="))?.slice(10);
  const again = process.argv.includes("--again");
  // Last season's races: what they stated carries to this year's edition.
  const past = process.argv.includes("--past");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { gatherDossier } = await import("../src/lib/catalog/dossier");
  const { classesFromDossier, statable } = await import("../src/lib/catalog/dossier-classes");
  const { recordFacts } = await import("../src/lib/catalog/facts");
  const { recentlyProbed, recordProbe } = await import("../src/lib/catalog/probes");
  const { audienceFromAgeCategories } = await import("../src/lib/taxonomy");
  const { CHAMPIONSHIP } = await import("../src/lib/catalog/regulation-ages");
  const { LlmUnavailable, HAIKU } = await import("../src/lib/llm/anthropic");
  const { mapPool } = await import("../src/lib/watcher/pool");
  const s = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(s, "dossier_classes");
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await s.from("events").select("id, name, start_date, website_url, registration_url, regulations_url, age_confidence, age_categories, location:locations(municipality, country_code), sources:event_sources(source_url)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", past ? ["scheduled", "tbc", "confirmed", "completed"] : ["scheduled", "tbc", "confirmed"]).gte("start_date", past ? new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10) : today).lt("start_date", past ? today : "9999-12-31").order("start_date").order("id").range(from, from + 999);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  const targets = rows
    .filter((r) => r.age_confidence !== "explicit" && (again || !skip.has(r.id)) && !CHAMPIONSHIP.test(r.name))
    .filter((r) => !country || r.location?.country_code === country)
    .filter((r) => !process.env.CATALOG_COUNTRIES || process.env.CATALOG_COUNTRIES.split(",").includes(r.location?.country_code ?? ""))
    .slice(0, max);
  const result = { targets: targets.length, stated: 0, notSafe: 0, nothing: 0, failed: 0, costUsd: 0 };
  let stop = false;
  await mapPool(targets, 4, async (r) => {
    if (stop) return;
    try {
      const docs = await gatherDossier({ startDate: r.start_date, website: r.website_url, registration: r.registration_url, regulations: r.regulations_url, sources: (r.sources ?? []).map((x) => x.source_url).filter((u): u is string => Boolean(u)), render: process.argv.includes("--render") });
      const got = await classesFromDossier({ name: r.name, startDate: r.start_date, place: r.location?.municipality }, docs);
      result.costUsd += got.usage?.costUsd ?? 0;
      if (!got.ages.length) {
        result.nothing += 1;
        if (apply) await recordProbe(s, r.id, "dossier_classes", "silent");
        return;
      }
      if (!statable({ name: r.name }, got)) {
        result.notSafe += 1;
        if (apply) await recordProbe(s, r.id, "dossier_classes", "silent");
        return;
      }
      result.stated += 1;
      console.log(`${apply ? "SET" : "DRY"}  ${r.start_date}  ${r.name}  → ${got.ages.join(",")}  (had ${(r.age_categories ?? []).join(",") || "-"})\n      ${got.lines.slice(0, 4).map((l) => l.line.slice(0, 100)).join(" | ")}\n      ${got.lines[0]?.url}`);
      if (!apply) return;
      const { error } = await s.from("events").update({ age_categories: got.ages, age_confidence: "explicit", audience: audienceFromAgeCategories(got.ages), updated_at: new Date().toISOString() }).eq("id", r.id);
      if (!error) {
        await recordFacts(s, r.id, [
          { field: "age_categories", value: got.ages, previous: r.age_categories, sourceUrl: got.lines[0]?.url, quote: got.lines.map((l) => l.line).join(" | ").slice(0, 2000) },
          { field: "age_confidence", value: "explicit", previous: r.age_confidence },
        ], { method: "llm", model: HAIKU, version: VERSION });
      }
      await recordProbe(s, r.id, "dossier_classes", "silent");
    } catch (e) {
      result.failed += 1;
      if (e instanceof LlmUnavailable) stop = true;
    }
  });
  console.log({ ...result, costUsd: Number(result.costUsd.toFixed(3)), dry: !apply });
}
main().catch((e) => { console.error(e); process.exit(1); });

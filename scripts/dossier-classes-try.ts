/**
 * Try the dossier class reader on the same sample as dossier-diagnose, dry.
 *   LLM_BUDGET_USD=0.3 node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/dossier-classes-try.ts [--n=80]
 */
import { readFileSync, writeFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }

type Row = { id: string; name: string; start_date: string; website_url: string | null; registration_url: string | null; regulations_url: string | null; age_confidence: string | null; age_categories: string[] | null; location: { country_code: string | null; municipality: string | null } | null; sources: { source_url: string | null }[] | null };

async function main() {
  const n = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 80);
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { gatherDossier } = await import("../src/lib/catalog/dossier");
  const { classesFromDossier, statable } = await import("../src/lib/catalog/dossier-classes");
  const { mapPool } = await import("../src/lib/watcher/pool");
  const s = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await s.from("events").select("id, name, start_date, website_url, registration_url, regulations_url, age_confidence, age_categories, location:locations(country_code, municipality), sources:event_sources(source_url)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", ["scheduled", "tbc", "confirmed"]).gte("start_date", today).lte("start_date", new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)).order("id").range(from, from + 999);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const sample = rows.filter((r) => r.age_confidence !== "explicit").sort(() => rnd() - 0.5).slice(0, n);
  let cost = 0, found = 0;
  const out: string[] = [];
  await mapPool(sample, 4, async (r) => {
    const docs = await gatherDossier({ startDate: r.start_date, website: r.website_url, registration: r.registration_url, regulations: r.regulations_url, sources: (r.sources ?? []).map((x) => x.source_url).filter((u): u is string => Boolean(u)), render: true }).catch(() => []);
    try {
      const got = await classesFromDossier({ name: r.name, startDate: r.start_date, place: r.location?.municipality }, docs);
      cost += got.usage?.costUsd ?? 0;
      const ok = statable({ name: r.name }, got);
      if (ok) found += 1;
      else if (got.ages.length) got.ages.unshift("REJECTED" as never);
      out.push(`${r.location?.country_code}  ${r.start_date}  ${r.name}\n   had: ${(r.age_categories ?? []).join(",") || "-"} (${r.age_confidence ?? "-"})   →  ${got.ages.join(",") || "—"}\n${got.lines.slice(0, 8).map((l) => `     · ${l.line.slice(0, 140)}`).join("\n")}${got.lines[0] ? `\n     from ${got.lines[0].url}` : ""}`);
    } catch (e) {
      out.push(`ERR ${r.name}: ${e instanceof Error ? e.message : e}`);
    }
  });
  writeFileSync("tmp/dossier-classes-try.txt", out.join("\n\n") + "\n");
  console.log({ races: sample.length, withClasses: found, costUsd: Number(cost.toFixed(3)) });
}
main().catch((e) => { console.error(e); process.exit(1); });

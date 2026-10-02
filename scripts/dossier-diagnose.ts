/**
 * Where does the missing information live? For races without stated classes,
 * gather every document (site, entry, regulations, linked pages, listings,
 * rendered shells) and count which name the race's date and which carry a
 * class list. No model, no cost.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/dossier-diagnose.ts [--n=80]
 */
import { readFileSync, writeFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }

type Row = { id: string; name: string; start_date: string; website_url: string | null; registration_url: string | null; regulations_url: string | null; age_confidence: string | null; location: { country_code: string | null } | null; sources: { source_url: string | null }[] | null };

async function main() {
  const n = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 80);
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { gatherDossier } = await import("../src/lib/catalog/dossier");
  const { mapPool } = await import("../src/lib/watcher/pool");
  const s = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await s.from("events").select("id, name, start_date, website_url, registration_url, regulations_url, age_confidence, location:locations(country_code), sources:event_sources(source_url)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", ["scheduled", "tbc", "confirmed"]).gte("start_date", today).lte("start_date", new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)).order("id").range(from, from + 999);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  const pool = rows.filter((r) => r.age_confidence !== "explicit");
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const sample = pool.sort(() => rnd() - 0.5).slice(0, n);
  const out: string[] = ["country\tdate\tname\tdocs\tthisEdition\tedition+classes\tany classes\tbest doc"];
  const tally: Record<string, { races: number; withDocs: number; edition: number; editionClasses: number; anyClasses: number }> = {};
  const byKind: Record<string, { docs: number; edition: number; classes: number; both: number }> = {};
  await mapPool(sample, 4, async (r) => {
    const docs = await gatherDossier({
      startDate: r.start_date,
      website: r.website_url,
      registration: r.registration_url,
      regulations: r.regulations_url,
      sources: (r.sources ?? []).map((x) => x.source_url).filter((u): u is string => Boolean(u)),
      render: process.argv.includes("--render"),
    }).catch(() => []);
    const c = r.location?.country_code ?? "?";
    for (const k of [c, "ALL"]) {
      tally[k] ??= { races: 0, withDocs: 0, edition: 0, editionClasses: 0, anyClasses: 0 };
      const t = tally[k]!;
      t.races += 1;
      if (docs.length) t.withDocs += 1;
      if (docs.some((d) => d.thisEdition)) t.edition += 1;
      if (docs.some((d) => d.thisEdition && d.classLines >= 3)) t.editionClasses += 1;
      if (docs.some((d) => d.classLines >= 3)) t.anyClasses += 1;
    }
    for (const d of docs) {
      const k = (byKind[d.kind] ??= { docs: 0, edition: 0, classes: 0, both: 0 });
      k.docs += 1;
      if (d.thisEdition) k.edition += 1;
      if (d.classLines >= 3) k.classes += 1;
      if (d.thisEdition && d.classLines >= 3) k.both += 1;
    }
    const best = docs.filter((d) => d.thisEdition).sort((a, b) => b.classLines - a.classLines)[0];
    out.push([c, r.start_date, r.name, docs.length, docs.filter((d) => d.thisEdition).length, docs.filter((d) => d.thisEdition && d.classLines >= 3).length, docs.filter((d) => d.classLines >= 3).length, best ? `${best.kind} ${best.url}` : ""].join("\t"));
  });
  writeFileSync("tmp/dossier-diagnose.tsv", out.join("\n") + "\n");
  console.table(tally);
  console.table(byKind);
}
main().catch((e) => { console.error(e); process.exit(1); });

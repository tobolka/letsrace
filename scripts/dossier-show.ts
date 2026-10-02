/**
 * What the dossier holds for races matching a name: every document, whether it
 * names the date, and its class-like lines. No model.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/dossier-show.ts "name fragment" [...]
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }
async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { gatherDossier } = await import("../src/lib/catalog/dossier");
  const { editionDocs, candidateLines } = await import("../src/lib/catalog/dossier-classes");
  const s = createServerSupabase();
  for (const frag of process.argv.slice(2)) {
    const { data } = await s.from("events").select("name, start_date, website_url, registration_url, regulations_url, location:locations(municipality), sources:event_sources(source_url)").ilike("name", `%${frag}%`).gte("start_date", new Date().toISOString().slice(0, 10)).is("merged_into_id", null).limit(1);
    const r = (data ?? [])[0] as unknown as { name: string; start_date: string; website_url: string | null; registration_url: string | null; regulations_url: string | null; location: { municipality: string | null } | null; sources: { source_url: string | null }[] } | undefined;
    if (!r) continue;
    const docs = await gatherDossier({ startDate: r.start_date, website: r.website_url, registration: r.registration_url, regulations: r.regulations_url, sources: r.sources.map((x) => x.source_url!).filter(Boolean), render: process.argv.includes("--render") });
    const ed = editionDocs(docs, r.start_date, [r.name, r.location?.municipality ?? ""]);
    console.log(`\n=== ${r.start_date} ${r.name}`);
    for (const d of docs) console.log(`  ${ed.includes(d) ? "ED" : "  "} ${d.kind.padEnd(12)} date:${d.thisEdition ? "y" : "n"} classes:${String(d.classLines).padStart(3)} len:${d.text.length}  ${d.url.slice(0, 110)}`);
    for (const l of candidateLines(ed).slice(0, 12)) console.log(`     ${l.n}. ${l.line.slice(0, 120)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

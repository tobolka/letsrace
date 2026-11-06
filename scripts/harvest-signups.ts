/** Reads sign-up portals' lists and gives matched races their exact sign-up link, regulations and contact. Dry unless --apply. */
import { appendFileSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  try { for (const [key, value] of Object.entries(parse(readFileSync(".env.local", "utf8")))) process.env[key] ??= value; } catch { /* the runner provides them */ }
  const arg = (name: string) => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
  const apply = process.argv.includes("--apply"), ledger = arg("ledger");
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const portals = await import("../src/lib/catalog/signup-portals");
  const { saveFoundLinks } = await import("../src/lib/catalog/practical-enrichment");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const read = async (url: string) => {
    const doc = await readDocument(url, { maxBytes: 3 * 1024 * 1024 }).catch(() => null);
    await wait(1000);
    return doc?.html ? pageAsText(doc.html, url).text : "";
  };
  const rows = [
    ...portals.maratonRows(await read("https://maraton.cz/terminovka")),
    ...portals.sportsoftRows(await read("https://cycling.sportsoft.cz/cyklokros/")),
    ...portals.wynikiRows(await read("https://wynikizawodow.eu/")),
    ...portals.elektroniczneRows(await read("https://elektronicznezapisy.pl/15/kolarstwo.html")),
    ...portals.elektroniczneRows(await read("https://elektronicznezapisy.pl/47/gravel.html")),
  ];
  const { data, error } = await db.from("events").select("id,name,start_date,end_date,public_revision,website_url,regulations_url,results_url,registration_url,location:locations(municipality)")
    .eq("visibility", "public").is("merged_into_id", null).gte("start_date", new Date().toISOString().slice(0, 10)).order("start_date").limit(5000)
    .returns<{ id: string; name: string; start_date: string; end_date: string | null; public_revision: string; website_url: string | null; regulations_url: string | null; results_url: string | null; registration_url: string | null; location: { municipality: string | null } | null }[]>();
  if (error) throw Error(error.message);
  const stats = { rows: rows.length, matched: 0, registration: 0, regulations: 0, unmatched: [] as string[] };
  for (const row of rows) {
    const races = portals.matchPortalRow(row, data ?? []);
    if (!races.length) { stats.unmatched.push(`${row.date} ${row.title.slice(0, 40)} / ${row.place}`); continue; }
    stats.matched++;
    const details = /\/zawody\/\d+/.test(row.signUp) ? portals.wynikiPage(await read(row.signUp)) : {};
    for (const race of races) {
      console.log(`${row.date} ${race.name.slice(0, 36)} <- ${row.title.slice(0, 30)} | ${race.registration_url ? "má" : row.signUp.slice(0, 50)}${details.regulations ? " | propozice" : ""}${details.email ? ` | ${details.email}` : ""}`);
      if (!apply) continue;
      const before = { registration: race.registration_url, regulations: race.regulations_url };
      const saved = await saveFoundLinks(race, { registration: row.signUp, ...(details.regulations ? { regulations: details.regulations } : {}) });
      if (!before.registration) stats.registration++;
      if (!before.regulations && details.regulations) stats.regulations++;
      if (ledger && saved) appendFileSync(ledger, `${JSON.stringify({ id: race.id, name: race.name, start_date: race.start_date, how: "signup-portal", documents: [row.signUp], expected: {} })}\n`);
    }
  }
  console.log(JSON.stringify({ ...stats, unmatched: stats.unmatched.length })); console.log(stats.unmatched.slice(0, 20).join(" | "));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

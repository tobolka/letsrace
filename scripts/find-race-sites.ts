/** Looks for a race's own site where we only know a calendar's page or nothing. Nothing is sent from here. */
import { readFile, writeFile } from "node:fs/promises";
import { parse } from "dotenv";

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
  const apply = process.argv.includes("--apply"), days = Number(arg("days") ?? 60), max = Number(arg("max") ?? 60), started = Date.now(), seconds = Number(arg("seconds") ?? 500);
  process.env.BRAVE_SEARCH_LIMIT = String(max * 2);
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { readAllRows } = await import("../src/lib/supabase/read-all");
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { braveSearch } = await import("../src/lib/catalog/brave");
  const { documentIsAboutRace, placeAndDayQuery, takeSearch, usableHits } = await import("../src/lib/catalog/race-completeness");
  const { siteOf } = await import("../src/lib/catalog/site-documents");
  const { searchableName } = await import("../src/lib/catalog/web-finder");
  const db = createServerSupabase();
  const now = Date.now(), from = new Date(now).toISOString().slice(0, 10), to = new Date(now + days * 86400000).toISOString().slice(0, 10);
  const first = new Set(["CZ", "SK"]);
  const races = (await readAllRows((a, b) => db.from("events").select("id,name,start_date,website_url,disciplines,overrides:event_overrides(locked_fields),location:locations(municipality,country_code)").eq("visibility", "public").is("merged_into_id", null).gte("start_date", from).lt("start_date", to).order("start_date").range(a, b)))
    .filter(race => !siteOf(race.website_url) || /uci\.org|raceresult|maraton\.cz|sumator|kalendar/i.test(race.website_url ?? ""))
    .sort((a, b) => Number(first.has(b.location?.country_code ?? "")) - Number(first.has(a.location?.country_code ?? "")) || a.start_date.localeCompare(b.start_date)).slice(0, max);
  const ledger = arg("search-ledger")!;
  const out: unknown[] = []; let searched = 0, found = 0, nohits = 0;
  for (const race of races) {
    if (Date.now() - started > seconds * 1000) break;
    const context = { name: race.name, start_date: race.start_date, municipality: race.location?.municipality, country: race.location?.country_code, discipline: race.disciplines?.[0] };
    const queries = [`${searchableName(race.name)} ${context.municipality ?? ""} ${race.start_date.slice(0, 4)}`.replace(/\s+/g, " ").trim(), placeAndDayQuery(context)].filter((q): q is string => Boolean(q));
    let accepted: string | null = null; const tried: string[] = [];
    for (const query of queries) {
      if (accepted || !takeSearch(ledger, { day: Number(arg("searches-a-day") ?? 200), month: 1000 })) break;
      searched++;
      const hits = await braveSearch(query, { count: 10 }).catch(() => []);
      if (!hits.length) nohits++;
      for (const url of usableHits(hits.map(hit => hit.url), race, new Set(tried), 5)) {
        tried.push(url);
        const doc = await readDocument(url, { maxBytes: 4194304 }).catch(() => null);
        if (!doc?.text?.trim()) continue;
        const text = doc.html ? pageAsText(doc.html, url).text : doc.text;
        if (documentIsAboutRace(text, context)) { accepted = url; break; }
      }
    }
    if (accepted) found++;
    out.push({ id: race.id, name: race.name, date: race.start_date, cc: context.country, was: race.website_url, found: accepted, tried: tried.slice(0, 5) });
    console.log(`${race.start_date} ${race.name.slice(0, 38)} => ${accepted ?? "-"}`);
    await writeFile(arg("out")!, JSON.stringify(out, null, 1));
  }
  console.log({ apply, races: out.length, searched, nohits, found });
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

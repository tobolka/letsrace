/** Finds regulations on the race's own site, without search or AI. Reading them is the next step's work. */
import { readFile, writeFile } from "node:fs/promises";
import { parse } from "dotenv";

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
  const apply = process.argv.includes("--apply"), seconds = Number(arg("seconds") ?? 480), started = Date.now();
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { readAllRows } = await import("../src/lib/supabase/read-all");
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { documentIsAboutRace } = await import("../src/lib/catalog/race-completeness");
  const { regulationsCandidates, siteDocuments, siteOf } = await import("../src/lib/catalog/site-documents");
  const db = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const races = await readAllRows((from, to) => db.from("events").select("id,name,start_date,website_url,regulations_url,overrides:event_overrides(locked_fields),location:locations(municipality,country_code)").eq("visibility", "public").is("merged_into_id", null).gte("start_date", today).is("regulations_url", null).not("website_url", "is", null).order("start_date").range(from, to));
  const bySite = new Map<string, typeof races>();
  for (const race of races) { const site = siteOf(race.website_url); if (site) bySite.set(site, [...(bySite.get(site) ?? []), race]); }
  const texts = new Map<string, string>();
  const found: unknown[] = [];
  let sites = 0, withDocuments = 0, readDocuments = 0, reached = 0;
  for (const [site, list] of bySite) {
    if (Date.now() - started > seconds * 1000) break;
    sites++;
    const documents = await siteDocuments(site, [...new Set(list.map(race => race.website_url as string))]);
    if (documents.length) withDocuments++;
    for (const race of list) {
      reached++;
      const context = { name: race.name, start_date: race.start_date, municipality: race.location?.municipality };
      for (const url of regulationsCandidates(documents, race)) {
        if (!texts.has(url)) { const doc = await readDocument(url, { maxBytes: 8 * 1024 * 1024 }).catch(() => null); readDocuments++; texts.set(url, doc?.text ?? ""); }
        if (!documentIsAboutRace(texts.get(url)!, context)) continue;
        found.push({ id: race.id, name: race.name, date: race.start_date, country: race.location?.country_code, url });
        const overrides = race.overrides as { locked_fields?: string[] } | { locked_fields?: string[] }[] | null;
        const locked = (Array.isArray(overrides) ? overrides[0]?.locked_fields : overrides?.locked_fields) ?? [];
        if (apply && !locked.includes("regulations_url")) {
          const { error } = await db.from("events").update({ regulations_url: url }).eq("id", race.id);
          if (error) throw Error(error.message);
          await db.from("event_facts").insert({ event_id: race.id, field: "regulations_url", value: url, previous: null, source_url: url, quote: texts.get(url)!.replace(/\s+/g, " ").slice(0, 300).padEnd(8, "."), method: "site_documents", version: "1" });
        }
        break;
      }
    }
  }
  const report = { apply, racesWithoutRegulations: races.length, sitesKnown: bySite.size, sites, withDocuments, racesReached: reached, readDocuments, found: found.length };
  if (arg("out")) await writeFile(arg("out")!, JSON.stringify({ ...report, foundList: found }, null, 1));
  console.log(report);
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

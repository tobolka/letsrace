/** Reads what we know about every upcoming race, with no AI and nothing written, and says what became of it. */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { parse } from "dotenv";

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
  const out = arg("out")!, concurrency = Number(arg("workers") ?? 8);
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { readAllRows } = await import("../src/lib/supabase/read-all");
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { practicalChildLinks, practicalSeedUrls } = await import("../src/lib/catalog/practical-enrichment");
  const { documentDetails, documentKind, onlyInBrowser } = await import("../src/lib/catalog/practical-sources");
  const { documentIsAboutRace } = await import("../src/lib/catalog/race-completeness");
  const { siteOf } = await import("../src/lib/catalog/site-documents");
  const db = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const races = await readAllRows((a, b) => db.from("events").select("id,name,start_date,website_url,regulations_url,registration_url,practical_details,location:locations(municipality,country_code)").eq("visibility", "public").is("merged_into_id", null).gte("start_date", today).order("start_date").range(a, b));
  await writeFile(out, "");
  const cache = new Map<string, Promise<{ text: string; html: boolean; links: string[]; browser: boolean } | null>>();
  const read = (url: string) => { if (!cache.has(url)) cache.set(url, readDocument(url, { maxBytes: 8388608 }).then(doc => { if (!doc?.text?.trim()) return null; const page = doc.html ? pageAsText(doc.html, url) : { text: doc.text, links: new Set<string>() }; return { text: page.text, html: Boolean(doc.html), links: [...page.links], browser: Boolean(doc.html && onlyInBrowser(doc.html, page.text)) }; }).catch(() => null)); return cache.get(url)!; };
  let index = 0, done = 0;
  const work = async () => {
    while (index < races.length) {
      const race = races[index++]!;
      const context = { name: race.name, startDate: race.start_date };
      const seeds = practicalSeedUrls(race);
      const line: Record<string, unknown> = { id: race.id, name: race.name, date: race.start_date, cc: race.location?.country_code, site: siteOf(race.website_url) ? "own" : race.website_url ? "calendar" : "none", website: race.website_url, regs: race.regulations_url, has: Object.keys(race.practical_details ?? {}), seeds: seeds.length };
      const docs: Record<string, unknown>[] = [];
      const queue = seeds.slice(0, 3), seen = new Set(queue);
      for (let i = 0; i < queue.length && i < 6; i++) {
        const url = queue[i]!, doc = await read(url);
        if (!doc) { docs.push({ url, state: "unreadable" }); continue; }
        const details = documentDetails({ text: doc.text });
        docs.push({ url, state: doc.browser ? "browser_only" : "read", chars: doc.text.length, kind: documentKind({ url, text: doc.text }, context), about: documentIsAboutRace(doc.text, { name: race.name, start_date: race.start_date, municipality: race.location?.municipality }), fees: details.fees, times: details.times, km: details.distance });
        if (i < 3) for (const link of practicalChildLinks(url, new Set(doc.links), race, doc.text).filter(link => !seen.has(link)).slice(0, 2)) { seen.add(link); queue.push(link); }
      }
      line.docs = docs;
      await appendFile(out, `${JSON.stringify(line)}\n`);
      done++; if (done % 100 === 0) console.log(`${done}/${races.length}`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, work));
  console.log(`hotovo ${done}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

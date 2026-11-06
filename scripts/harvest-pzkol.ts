/** Reads the Polish federation's page of each upcoming race that links to it: organiser and regulations. Dry unless --apply. */
import { appendFileSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  try { for (const [key, value] of Object.entries(parse(readFileSync(".env.local", "utf8")))) process.env[key] ??= value; } catch { /* the runner provides them */ }
  const arg = (name: string) => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
  const apply = process.argv.includes("--apply"), ledger = arg("ledger");
  const deadline = Date.now() + Number(arg("seconds") ?? 480) * 1000;
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { pzkolFacts, pzkolRegulations, isPzkolRace } = await import("../src/lib/catalog/pzkol");
  const { verifyPracticalExtraction } = await import("../src/lib/catalog/practical-extraction");
  const { savePracticalDetails } = await import("../src/lib/catalog/practical-enrichment");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const { data, error } = await db.from("events").select("id,name,start_date,end_date,public_revision,website_url,regulations_url,sources:event_sources(source_url)")
    .eq("visibility", "public").is("merged_into_id", null).gte("start_date", new Date().toISOString().slice(0, 10)).is("regulations_url", null).order("start_date").limit(3000)
    .returns<{ id: string; name: string; start_date: string; end_date: string | null; public_revision: string; website_url: string | null; regulations_url: string | null; sources: { source_url: string }[] }[]>();
  if (error) throw Error(error.message);
  const stats = { races: 0, read: 0, regulations: 0, organisers: 0 };
  for (const event of data ?? []) {
    const url = [event.website_url, ...event.sources.map(source => source.source_url)].find(candidate => candidate && isPzkolRace(candidate));
    if (!url) continue;
    stats.races++;
    if (Date.now() > deadline) break;
    const doc = await readDocument(url, { maxBytes: 2 * 1024 * 1024 }).catch(() => null);
    await wait(1000);
    if (!doc?.html) continue;
    const page = pageAsText(doc.html, url), document = { url, text: page.text, links: [...page.links] };
    stats.read++;
    const regulations = pzkolRegulations(page.text)[0];
    const checked = verifyPracticalExtraction(pzkolFacts(document), { name: event.name, startDate: event.start_date, endDate: event.end_date, ownUrls: [url], documents: [document], documentSettled: true });
    console.log(`${event.id.slice(0, 8)} ${event.start_date} ${event.name.slice(0, 36)} | ${(checked.details.organizer?.value.name ?? "-").slice(0, 44)} | ${regulations ?? "-"}`);
    if (regulations) stats.regulations++;
    if (checked.details.organizer) stats.organisers++;
    if (!apply) continue;
    if (Object.keys(checked.details).length) await savePracticalDetails(event.id, event.public_revision, checked.details);
    if (regulations) await db.from("events").update({ regulations_url: regulations }).eq("id", event.id);
    if (ledger && (regulations || checked.details.organizer)) appendFileSync(ledger, `${JSON.stringify({ id: event.id, name: event.name, start_date: event.start_date, how: "pzkol", documents: [url], expected: Object.fromEntries(Object.keys(checked.details).map(key => [key, true])) })}\n`);
  }
  console.log(JSON.stringify(stats));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

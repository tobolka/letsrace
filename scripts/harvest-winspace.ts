/** Czech calendar pages name each race's organiser on a fixed line. Reads those that still lack one. Dry unless --apply. */
import { appendFileSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const CZECH_MONTHS = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];

async function main() {
  try { for (const [key, value] of Object.entries(parse(readFileSync(".env.local", "utf8")))) process.env[key] ??= value; } catch { /* the runner provides them */ }
  const arg = (name: string) => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
  const apply = process.argv.includes("--apply"), ledger = arg("ledger"), deadline = Date.now() + Number(arg("seconds") ?? 300) * 1000;
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { verifyPracticalExtraction } = await import("../src/lib/catalog/practical-extraction");
  const { savePracticalDetails } = await import("../src/lib/catalog/practical-enrichment");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const { data, error } = await db.from("events").select("id,name,start_date,end_date,public_revision,practical_details,sources:event_sources!inner(source_url)")
    .eq("visibility", "public").is("merged_into_id", null).gte("start_date", new Date().toISOString().slice(0, 10)).like("sources.source_url", "%kalendar.winspace.cz/kalendar/%").order("start_date").limit(1500)
    .returns<{ id: string; name: string; start_date: string; end_date: string | null; public_revision: string; practical_details: { organizer?: unknown } | null; sources: { source_url: string }[] }[]>();
  if (error) throw Error(error.message);
  const stats = { races: data?.length ?? 0, read: 0, otherDay: 0, saved: 0 };
  for (const event of data ?? []) {
    if (event.practical_details?.organizer || Date.now() > deadline) continue;
    const url = event.sources[0]!.source_url, doc = await readDocument(url, { maxBytes: 1024 * 1024 }).catch(() => null);
    await wait(1000);
    if (!doc?.html) continue;
    const page = pageAsText(doc.html, url), rows = page.text.split("\n").map(row => row.trim()).filter(Boolean);
    stats.read++;
    const [year, month, day] = event.start_date.split("-").map(Number) as [number, number, number];
    // This calendar's dates can differ from the organiser's; its organiser then belongs to no race we can be sure of.
    const at = rows.findIndex(row => row.includes(`${day}. ${CZECH_MONTHS[month - 1]} ${year}`));
    if (at < 1) { stats.otherDay++; continue; }
    // With no organiser given, the next line is the town again.
    if (rows[at + 1]?.startsWith(rows[at + 2] ?? "\u0000")) continue;
    const name = rows[at + 2], contact = /Pořadatel:[^\n]*\n+\s*([^\s@]+@[^\s]+)/.exec(page.text)?.[1];
    if (!name || name.length < 4 || /^Zdroj:/.test(name)) continue;
    const raw = { facts: { organizer: { value: { name, ...(contact ? { email: contact } : {}) }, source_url: url, quote: name, identity_quote: rows[at - 1], edition_quote: rows[at], status: "current" } } };
    const checked = verifyPracticalExtraction(raw, { name: event.name, startDate: event.start_date, endDate: event.end_date, ownUrls: [url], documents: [{ url, text: page.text, links: [...page.links] }], documentSettled: true });
    if (process.argv.includes("--verbose")) console.log(`${event.start_date} ${event.name.slice(0, 36)} | ${name.slice(0, 50)} | ${contact ?? "-"} ${JSON.stringify(checked.reasons)}`);
    if (apply && checked.details.organizer) {
      const saved = await savePracticalDetails(event.id, event.public_revision, checked.details) as { changed?: string[] };
      if (saved.changed?.length) stats.saved++;
      if (ledger) appendFileSync(ledger, `${JSON.stringify({ id: event.id, name: event.name, start_date: event.start_date, how: "winspace", documents: [url], expected: { organizer: true } })}\n`);
    }
  }
  console.log(JSON.stringify(stats));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

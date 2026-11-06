/** Walks rad-net's calendar, matches its rows to our races and reads each race's page. Dry unless --apply. */
import { appendFileSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const words = (text: string) => new Set(fold(text).match(/[a-z0-9]{4,}/g) ?? []);
const COMMON = new Set(["cross", "cyclo", "cyclocross", "rennen", "race", "lauf", "2026", "2027", "radsport", "gravel", "cup", "pokal", "preis", "grosser"]);
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  try { for (const [key, value] of Object.entries(parse(readFileSync(".env.local", "utf8")))) process.env[key] ??= value; } catch { /* the runner provides them */ }
  const ledger = process.argv.find(arg => arg.startsWith("--ledger="))?.slice(9);
  const apply = process.argv.includes("--apply"), max = Number(process.argv.find(arg => arg.startsWith("--max="))?.slice(6) ?? 400);
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { radNetCalendarRows, radNetCalendarPages, radNetFacts } = await import("../src/lib/catalog/radnet");
  const { verifyPracticalExtraction } = await import("../src/lib/catalog/practical-extraction");
  const { savePracticalDetails } = await import("../src/lib/catalog/practical-enrichment");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const read = async (url: string) => {
    const doc = await readDocument(url, { maxBytes: 4 * 1024 * 1024 }).catch(() => null);
    if (!doc?.html) return null;
    const page = pageAsText(doc.html, url);
    return { url, text: page.text, links: [...page.links] };
  };
  const first = "https://www.rad-net.de/rad-net-portal/rad-net-ausschreibungen.htm?url=%2Fmodules.php%3Fname%3DAusschreibung&url_hash=uSwzL6PJy_k5sHq6-DL9JQLRhAKSLlHt_zLM8jYvlhU";
  const queue = [first], seen = new Set<string>(), rows: ReturnType<typeof radNetCalendarRows> = [];
  while (queue.length) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const page = await read(url);
    if (!page) { console.log(`nečitelné: ${url.slice(-60)}`); continue; }
    rows.push(...radNetCalendarRows(page.text));
    console.log(`strana ${seen.size}: ${radNetCalendarRows(page.text).length} / odkazů dál ${radNetCalendarPages(page.links).length}`);
    for (const next of radNetCalendarPages(page.links)) if (!seen.has(next)) queue.push(next);
    await wait(1000);
  }
  const details = new Map(rows.filter(row => !/typ%3Di/.test(row.url) || true).map(row => [`${row.date}|${row.title}`, row]));
  const today = new Date().toISOString().slice(0, 10);
  const { data: events, error } = await db.from("events").select("id,name,start_date,end_date,public_revision,website_url,regulations_url,practical_details,location:locations!inner(venue,municipality,country_code)").gte("start_date", today).eq("location.country_code", "DE").returns<{ id: string; name: string; start_date: string; end_date: string | null; public_revision: string; website_url: string | null; regulations_url: string | null; location: { venue: string | null; municipality: string | null } | null }[]>();
  if (error) throw Error(error.message);
  const stats = { rows: details.size, matched: 0, read: 0, saved: 0, fields: {} as Record<string, number> };
  const unmatched: string[] = [];
  for (const row of [...details.values()].slice(0, max)) {
    const titleWords = words(`${row.title} ${row.place}`);
    const candidates = (events ?? []).filter(event => event.start_date === row.date).map(event => {
      const own = words(`${event.name} ${event.location?.municipality ?? ""}`);
      const shared = [...own].filter(word => titleWords.has(word) && !COMMON.has(word));
      return { event, shared };
    }).filter(item => item.shared.length).sort((a, b) => b.shared.length - a.shared.length);
    // Two of ours sharing the same day and two distinctive words are one race held twice: both get the facts.
    const top = candidates[0]?.shared.length ?? 0, same = candidates.filter(item => item.shared.length === top);
    if (!candidates.length || same.length > 1 && top < 2) { unmatched.push(`${row.date} ${row.title} / ${row.place}`); continue; }
    stats.matched++;
    const page = await read(row.url);
    await wait(1000);
    if (!page) continue;
    stats.read++;
    for (const { event } of same) {
    const raw = radNetFacts(page) as { facts: Record<string, { value: unknown }> };
    if (raw.facts.schedule) raw.facts.schedule.value = (raw.facts.schedule.value as { date: string }[]).map(item => ({ ...item, date: event.start_date }));
    const context = { name: event.name, startDate: event.start_date, endDate: event.end_date, knownVenue: event.location?.venue ?? undefined, municipality: event.location?.municipality ?? null, ownUrls: [page.url, event.website_url, event.regulations_url], documents: [page] };
    const checked = verifyPracticalExtraction(raw, context);
    console.log(`${row.date} ${event.name.slice(0, 40)}: ${Object.keys(checked.details).join(",") || "-"} ${JSON.stringify(checked.reasons)}`);
    for (const key of Object.keys(checked.details)) stats.fields[key] = (stats.fields[key] ?? 0) + 1;
    if (apply && Object.keys(checked.details).length) {
      const saved = await savePracticalDetails(event.id, event.public_revision, checked.details) as { changed?: string[] };
      if (saved.changed?.length) stats.saved++;
      if (ledger) appendFileSync(ledger, `${JSON.stringify({ id: event.id, name: event.name, start_date: event.start_date, how: "rad-net", documents: [page.url], expected: Object.fromEntries(Object.keys(checked.details).map(key => [key, true])) })}\n`);
      // The race's own page beats a series' general rules as the link to its regulations.
      if (!event.regulations_url || /rad-net|reglement|regularien|generalausschreibung/i.test(event.regulations_url)) await db.from("events").update({ regulations_url: page.url }).eq("id", event.id);
    }
    }
  }
  console.log(JSON.stringify(stats)); console.log(`nenalezeno ${unmatched.length}:`, unmatched.slice(0, 15).join(" | "));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

/** Reads the Italian federation's page of each upcoming race that came from it, nearest first. Dry unless --apply. */
import { appendFileSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  try { for (const [key, value] of Object.entries(parse(readFileSync(".env.local", "utf8")))) process.env[key] ??= value; } catch { /* the runner provides them */ }
  const arg = (name: string) => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
  const apply = process.argv.includes("--apply"), ledger = arg("ledger"), max = Number(arg("max") ?? 400), days = Number(arg("days") ?? 400);
  const deadline = Date.now() + Number(arg("seconds") ?? 480) * 1000;
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { federciclismoFacts, rideAndRestFacts } = await import("../src/lib/catalog/federciclismo");
  const { verifyPracticalExtraction } = await import("../src/lib/catalog/practical-extraction");
  const { savePracticalDetails } = await import("../src/lib/catalog/practical-enrichment");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10), until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await db.from("events").select("id,name,start_date,end_date,public_revision,website_url,regulations_url,practical_details,location:locations(venue,municipality),sources:event_sources!inner(source_url)")
    .eq("visibility", "public").is("merged_into_id", null).gte("start_date", today).lte("start_date", until).like("sources.source_url", "%members.federciclismo.it/race/detail/%").order("start_date").limit(2000)
    .returns<{ id: string; name: string; start_date: string; end_date: string | null; public_revision: string; website_url: string | null; regulations_url: string | null; practical_details: { organizer?: { sourceUrl?: string; checkedAt?: string } } | null; location: { venue: string | null; municipality: string | null } | null; sources: { source_url: string }[] }[]>();
  if (error) throw Error(error.message);
  const freshAfter = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const due = (data ?? []).filter(event => process.argv.includes("--force") || !(event.practical_details?.organizer?.sourceUrl?.includes("federciclismo") && (event.practical_details.organizer.checkedAt ?? "") > freshAfter));
  const stats = { races: data?.length ?? 0, due: due.length, read: 0, saved: 0, unreadable: 0, fields: {} as Record<string, number>, refused: {} as Record<string, number> };
  for (const event of due.slice(0, max)) {
    if (Date.now() > deadline) break;
    const url = event.sources[0]!.source_url;
    const doc = await readDocument(url, { maxBytes: 2 * 1024 * 1024 }).catch(() => null);
    await wait(1000);
    if (!doc?.html) { stats.unreadable++; continue; }
    // Some pages sit behind the federation's sign-in; those stay unread.
    const page = pageAsText(doc.html, url), document = { url, text: page.text, links: [...page.links] };
    stats.read++;
    const raw = federciclismoFacts(document) as { facts: Record<string, { value: unknown }> };
    if (raw.facts.schedule) raw.facts.schedule.value = (raw.facts.schedule.value as { date: string }[]).map(item => ({ ...item, date: event.start_date }));
    const checked = verifyPracticalExtraction(raw, { name: event.name, startDate: event.start_date, endDate: event.end_date, knownVenue: event.location?.venue ?? undefined, municipality: event.location?.municipality ?? null, ownUrls: [url], documents: [document], documentSettled: true });
    for (const key of Object.keys(checked.details)) stats.fields[key] = (stats.fields[key] ?? 0) + 1;
    for (const [key, why] of Object.entries(checked.reasons)) stats.refused[`${key}:${why}`] = (stats.refused[`${key}:${why}`] ?? 0) + 1;
    if (process.argv.includes("--verbose")) console.log(`${event.start_date} ${event.name.slice(0, 40)}: ${Object.keys(checked.details).join(",") || "-"} ${JSON.stringify(checked.reasons)}`);
    if (apply && Object.keys(checked.details).length) {
      const saved = await savePracticalDetails(event.id, event.public_revision, checked.details) as { changed?: string[] };
      if (saved.changed?.length) stats.saved++;
      if (!event.regulations_url) await db.from("events").update({ regulations_url: url }).eq("id", event.id);
      if (ledger) appendFileSync(ledger, `${JSON.stringify({ id: event.id, name: event.name, start_date: event.start_date, how: "federciclismo", documents: [url], expected: Object.fromEntries(Object.keys(checked.details).map(key => [key, true])) })}\n`);
    }
  }
  // Races that came from the Italian calendar site rather than the federation.
  const { data: others, error: othersError } = await db.from("events").select("id,name,start_date,end_date,public_revision,website_url,practical_details,location:locations(municipality,venue)")
    .eq("visibility", "public").is("merged_into_id", null).gte("start_date", today).lte("start_date", until).like("website_url", "%rideandrest.net/manifestazione/%").order("start_date").limit(1000)
    .returns<{ id: string; name: string; start_date: string; end_date: string | null; public_revision: string; website_url: string; practical_details: { organizer?: unknown } | null; location: { municipality: string | null; venue: string | null } | null }[]>();
  if (othersError) throw Error(othersError.message);
  const calendar = { races: 0, saved: 0 };
  for (const event of others ?? []) {
    if (event.practical_details?.organizer || Date.now() > deadline) continue;
    const doc = await readDocument(event.website_url, { maxBytes: 2 * 1024 * 1024 }).catch(() => null);
    await wait(1000);
    if (!doc?.html) continue;
    const page = pageAsText(doc.html, event.website_url), document = { url: event.website_url, text: page.text, links: [...page.links] };
    calendar.races++;
    const raw = rideAndRestFacts(document) as { facts: Record<string, { value: unknown }> };
    if (raw.facts.schedule) raw.facts.schedule.value = (raw.facts.schedule.value as { date: string }[]).map(item => ({ ...item, date: event.start_date }));
    const checked = verifyPracticalExtraction(raw, { name: event.name, startDate: event.start_date, endDate: event.end_date, knownVenue: event.location?.venue ?? undefined, municipality: event.location?.municipality ?? null, ownUrls: [event.website_url], documents: [document], documentSettled: true });
    if (process.argv.includes("--verbose")) console.log(`${event.start_date} ${event.name.slice(0, 40)}: ${Object.keys(checked.details).join(",") || "-"} ${JSON.stringify(checked.reasons)}`);
    if (apply && Object.keys(checked.details).length) {
      const saved = await savePracticalDetails(event.id, event.public_revision, checked.details) as { changed?: string[] };
      if (saved.changed?.length) calendar.saved++;
      if (ledger) appendFileSync(ledger, `${JSON.stringify({ id: event.id, name: event.name, start_date: event.start_date, how: "rideandrest", documents: [event.website_url], expected: Object.fromEntries(Object.keys(checked.details).map(key => [key, true])) })}\n`);
    }
  }
  console.log(JSON.stringify({ ...stats, calendar }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

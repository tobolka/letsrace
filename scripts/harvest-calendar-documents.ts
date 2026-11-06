/** Regulations and results linked from calendars we already know, matched to races by day and place. Nothing is sent from here. */
import { readFile, writeFile } from "node:fs/promises";
import { parse } from "dotenv";

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
  const apply = process.argv.includes("--apply"), seconds = Number(arg("seconds") ?? 480), started = Date.now();
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { readAllRows } = await import("../src/lib/supabase/read-all");
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { calendarRows, rowOfRace } = await import("../src/lib/catalog/calendar-documents");
  const { websiteMayBeReplaced } = await import("../src/lib/catalog/race-completeness");
  const db = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const races = await readAllRows((from, to) => db.from("events").select("id,name,start_date,website_url,regulations_url,results_url,overrides:event_overrides(locked_fields),location:locations(municipality)").eq("visibility", "public").is("merged_into_id", null).gte("start_date", today).order("id").range(from, to));
  const sources = await readAllRows((from, to) => db.from("watched_urls").select("url,kind").eq("status", "active").in("kind", ["calendar", "series", "federation", "aggregator"]).order("url").range(from, to));
  const extra = arg("urls")?.split(",") ?? [];
  const urls = [...new Set([...extra, ...sources.map(source => source.url as string)])];
  const byHost: Record<string, { pages: number; rows: number; regulations: number; results: number; websites: number }> = {};
  const changes: unknown[] = [];
  let pages = 0;
  for (const url of urls) {
    if (Date.now() - started > seconds * 1000) break;
    if (/\.(?:pdf|docx?|zip)(?:$|\?)/i.test(url)) continue;
    const doc = await readDocument(url, { maxBytes: 4 * 1024 * 1024 }).catch(() => null);
    pages++;
    if (!doc?.html) continue;
    const rows = calendarRows(pageAsText(doc.html, url).text, url);
    if (!rows.length) continue;
    const host = new URL(url).hostname.replace(/^www\./, "");
    const seen = (byHost[host] ??= { pages: 0, rows: 0, regulations: 0, results: 0, websites: 0 });
    seen.pages++; seen.rows += rows.length;
    for (const race of races) {
      const row = rowOfRace(rows, { name: race.name, start_date: race.start_date, municipality: race.location?.municipality });
      if (!row) continue;
      const overrides = race.overrides as { locked_fields?: string[] } | { locked_fields?: string[] }[] | null;
      const locked = new Set((Array.isArray(overrides) ? overrides[0]?.locked_fields : overrides?.locked_fields) ?? []);
      const patch: { regulations_url?: string; results_url?: string; website_url?: string } = {};
      if (!locked.has("website_url") && websiteMayBeReplaced(race.website_url) && row.sites[0]) patch.website_url = row.sites[0];
      if (!race.regulations_url && !locked.has("regulations_url") && row.regulations[0]) patch.regulations_url = row.regulations[0];
      if (!race.results_url && !locked.has("results_url") && row.results[0]) patch.results_url = row.results[0];
      if (!Object.keys(patch).length) continue;
      Object.assign(race, patch);
      if (patch.regulations_url) seen.regulations++;
      if (patch.results_url) seen.results++;
      if (patch.website_url) seen.websites++;
      changes.push({ id: race.id, name: race.name, date: race.start_date, row: row.text.slice(0, 160), source: url, ...patch });
      if (apply) {
        const { error } = await db.from("events").update(patch).eq("id", race.id);
        if (error) throw Error(error.message);
        await db.from("event_facts").insert(Object.entries(patch).map(([field, value]) => ({ event_id: race.id, field, value, previous: null, source_url: url, quote: row.text.slice(0, 500).padEnd(8, "."), method: "calendar_row", version: "1" })));
      }
    }
  }
  const report = { apply, sources: urls.length, pages, races: races.length, changes: changes.length, byHost: Object.fromEntries(Object.entries(byHost).sort(([, a], [, b]) => b.regulations + b.results + b.websites - a.regulations - a.results - a.websites).slice(0, 40)) };
  if (arg("out")) await writeFile(arg("out")!, JSON.stringify({ ...report, changes }, null, 1));
  console.log(report);
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

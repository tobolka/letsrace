/**
 * What is behind the active sources the reader gets nothing from? Reads each page once,
 * politely, and sorts it by what a person would find there. Reports only; writes nothing.
 * Start through scripts/local-run.sh:  ... audit-unreadable-sources.ts --out=FILE
 */
import { writeFileSync } from "node:fs";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fetchPage } from "../src/lib/watcher/http";
import { pageAsText } from "../src/lib/watcher/extractors/llm-calendar";
import { hostnameOf, mapPool } from "../src/lib/watcher/pool";

const out = process.argv.find(arg => arg.startsWith("--out="))?.slice(6);
if (!out) throw Error("Use --out=FILE");
const HELPER_PAGE = /vysledky|výsledky|ergebnis|result|kontakt|contact|galerie|galeri|foto|impressum|gdpr|cookies|sponzor|partner|galavec|vyhlaseni|\.pdf$/i;
const FULL_DATE = /(?<!\d)\d{1,2}\.\s*\d{1,2}\.\s*(?:20)?2[67](?!\d)|(?<!\d)202[67]-\d{2}-\d{2}(?!\d)|(?<!\d)\d{1,2}\.?\s+[a-zà-ž]{3,12}\.?\s+202[67](?!\d)/giu;
const SHORT_DATE = /(?<!\d)\d{1,2}\.\s*\d{1,2}\.(?!\s*\d)/g;

async function main() {
  const db = createServerSupabase();
  const { data, error } = await db.from("watched_urls").select("id,url,kind,added_by,last_extract_status,operational_state,last_error,last_fetched_at").eq("status", "active").in("last_extract_status", ["error", "needs_review"]);
  if (error) throw error;
  const races = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data: rows, error: sourceError } = await db.from("event_sources").select("watched_url_id").range(from, from + 999);
    if (sourceError) throw sourceError;
    for (const row of rows) if (row.watched_url_id) races.set(row.watched_url_id, (races.get(row.watched_url_id) ?? 0) + 1);
    if (rows.length < 1000) break;
  }
  const rows = await mapPool(data, 6, async source => {
    const base = { id: source.id, url: source.url, kind: source.kind, addedBy: source.added_by, state: source.operational_state, error: (source.last_error ?? "").slice(0, 80), racesLinked: races.get(source.id) ?? 0, host: hostnameOf(source.url) };
    try {
      const page = await fetchPage(source.url, { timeoutMs: 20_000, retries: 0, fresh: true });
      if (page.status >= 400) return { ...base, verdict: `http_${page.status}` };
      const text = pageAsText(page.html, source.url).text;
      const full = text.match(FULL_DATE)?.length ?? 0, short = text.match(SHORT_DATE)?.length ?? 0;
      const verdict = HELPER_PAGE.test(source.url) ? "helper_page" : text.length < 300 ? "needs_browser_or_empty" : full >= 3 ? "lists_dates" : short >= 4 ? "lists_dates_without_year" : full >= 1 ? "one_or_two_dates" : "no_dates";
      return { ...base, verdict, full, short, length: text.length };
    } catch (failure) { return { ...base, verdict: "failed", detail: failure instanceof Error ? failure.message.slice(0, 60) : "" }; }
  });
  writeFileSync(out!, JSON.stringify(rows, null, 1));
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.verdict] = (counts[row.verdict] ?? 0) + 1;
  console.log(JSON.stringify({ total: rows.length, counts }));
  process.exit(0);
}
main().catch(failure => { console.error(failure); process.exit(1); });

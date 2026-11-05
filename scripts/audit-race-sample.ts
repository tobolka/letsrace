/**
 * Is a public race's date right? Draws a random sample and looks for the date on the race's own page.
 * Read-only. Start through scripts/local-run.sh:  ... audit-race-sample.ts --size=60 --seed=N --out=FILE
 * A page that does not show the date is not proof of a wrong date, only something to read.
 */
import { writeFileSync } from "node:fs";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fetchPage } from "../src/lib/watcher/http";
import { pageAsText } from "../src/lib/watcher/extractors/llm-calendar";
import { isCalendarPage } from "../src/lib/watcher/public-url";
import { textNamesDate } from "../src/lib/date-in-text";
import { mapPool } from "../src/lib/watcher/pool";

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const size = Number(arg("size") ?? 60), out = arg("out");
let seed = Number(arg("seed") ?? 1);
if (!out) throw Error("Use --out=FILE");
const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const COUNTRIES = ["CZ", "SK", "DE", "AT", "PL", "CH", "IT"];

async function main() {
  const db = createServerSupabase(), races = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("events").select("id,slug,name,start_date,website_url,event_type,location:locations(municipality,country_code)").eq("visibility", "public").is("merged_into_id", null).gte("start_date", "2027-01-01").lt("start_date", "2028-01-01").order("id").range(from, from + 999);
    if (error) throw error;
    races.push(...data);
    if (data.length < 1000) break;
  }
  const pool = races.filter(race => race.website_url && !isCalendarPage(race.website_url) && race.event_type !== "ride" && COUNTRIES.includes(race.location?.country_code ?? "")).map(race => ({ race, rank: random() })).sort((a, b) => a.rank - b.rank).slice(0, size).map(item => item.race);
  const rows = await mapPool(pool, 6, async race => {
    const base = { name: race.name, date: race.start_date, country: race.location?.country_code, place: race.location?.municipality, url: race.website_url };
    try {
      const page = await fetchPage(race.website_url!, { timeoutMs: 20_000, retries: 0, fresh: true });
      if (page.status >= 400) return { ...base, verdict: `http_${page.status}` };
      const text = pageAsText(page.html, race.website_url!).text;
      const lines = text.split("\n").map(line => line.replace(/\s+/g, " ").trim());
      const found = lines.filter(line => line.includes("2027") && textNamesDate(line, race.start_date)).slice(0, 2);
      const other = lines.filter(line => /2027/.test(line) && /\d{1,2}[./ ]/.test(line) && !textNamesDate(line, race.start_date)).slice(0, 4).map(line => line.slice(0, 110));
      return { ...base, verdict: found.length ? "date_on_page" : textNamesDate(text, race.start_date) ? "date_without_year" : other.length ? "other_2027_dates" : text.length < 300 ? "page_empty" : "date_not_on_page", found: found.map(line => line.slice(0, 110)), other, length: text.length };
    } catch (failure) { return { ...base, verdict: "failed", detail: failure instanceof Error ? failure.message.slice(0, 60) : "" }; }
  });
  writeFileSync(out!, JSON.stringify(rows, null, 1));
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.verdict] = (counts[row.verdict] ?? 0) + 1;
  console.log(JSON.stringify({ pool: races.length, sampled: rows.length, counts }));
  process.exit(0);
}
main().catch(failure => { console.error(failure); process.exit(1); });

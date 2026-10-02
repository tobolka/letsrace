/**
 * Attach existing XCO-NRW / Schüler-Cup 2026 events to regional series (M:N).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { attachEventSeries, attachSecondarySeries } from "../src/lib/catalog/event-series";
import { listEvents } from "../src/lib/events";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

async function main() {
  const sb = createServerSupabase();
  const { data: events } = await sb
    .from("events")
    .select("id, name, start_date, series_id")
    .ilike("name", "%XCO-NRW%")
    .gte("start_date", "2026-01-01")
    .lte("start_date", "2026-12-31")
    .is("merged_into_id", null);

  const clean = (events || []).filter((e) => /XCO-NRW\s*\/\s*Schüler-Cup/i.test(e.name) || /XCO-NRW-Cup/i.test(e.name));
  console.log("candidates", clean.length);
  for (const e of clean) console.log(e.start_date, e.name);

  const targets = ["mtb-nrw-fun-cup", "mtb-schuler-cup-nrw"];
  for (const slug of targets) {
    const { data: s } = await sb.from("series").select("id").eq("slug", slug).maybeSingle();
    if (!s) {
      console.log("missing series", slug);
      continue;
    }
    let attached = 0;
    for (const e of clean) {
      if (!e.series_id) await attachEventSeries(sb, e.id, s.id, { primary: true, source: "nrw-attach" });
      else if (e.series_id !== s.id) await attachSecondarySeries(sb, e.id, s.id, "nrw-attach");
      else await attachEventSeries(sb, e.id, s.id, { primary: true, source: "nrw-attach" });
      attached++;
    }
    console.log(slug, "attached", attached, "now", (await listEvents({ seriesSlug: slug })).length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

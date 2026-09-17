/**
 * For CSV series that are short vs preview: find matching events and attach
 * them via event_series (and set primary when empty).
 *
 * Usage: nvm use 22 && npx tsx scripts/attach-preview-to-series-2026-09-17.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { previewUrl } from "../src/lib/watcher/run";
import { listEvents } from "../src/lib/events";
import { attachEventSeries, attachSecondarySeries } from "../src/lib/catalog/event-series";
import { fingerprint, normalizeName } from "../src/lib/domain";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const JOBS: { slug: string; urls: string[] }[] = [
  { slug: "jesenicky-snek", urls: ["https://sumator.cz/cup/jesenicky-snek-2026", "https://jesenickysnek.cz/"] },
  { slug: "skoda-cup", urls: ["https://www.czechcyclingfederation.com/events/skoda-cup/", "https://sumator.cz/cup/skoda-cup-2026"] },
  { slug: "severoceska-amaterska-liga", urls: ["https://sumator.cz/cup/severoceska-amaterska-liga-2026"] },
  { slug: "zal", urls: ["https://zapadoceskaamaterskaliga.cz/kalendare/zal-2026"] },
  { slug: "jihoceska-amaterska-liga", urls: ["https://sumator.cz/cup/jihoceska-amaterska-liga-2026"] },
  { slug: "slezsky-pohar-amaterskych-cyklistu", urls: ["https://sumator.cz/cup/slezsky-pohar-amaterskych-cyklistu-2026"] },
  { slug: "peklo-severu-road", urls: ["https://sumator.cz/cup/peklo-severu-road-2026"] },
  { slug: "czech-enduro-series", urls: ["https://www.enduroserie.cz/zavody/"] },
  { slug: "fox-grom-enduro", urls: ["https://sumator.cz/cup/fox-grom-enduro-2026"] },
  { slug: "galaxy-serie", urls: ["https://sumator.cz/cup/galaxy-serie-2026"] },
  { slug: "povltavsky-bikersky-pohar", urls: ["https://sumator.cz/cup/povltavsky-bikersky-pohar-2026"] },
  { slug: "sumpersky-pohar-mtb", urls: ["https://www.spmtb.cz/"] },
];

async function main() {
  const supabase = createServerSupabase();
  for (const job of JOBS) {
    const { data: series } = await supabase.from("series").select("id").eq("slug", job.slug).maybeSingle();
    if (!series?.id) {
      console.log("MISSING", job.slug);
      continue;
    }
    let events: Awaited<ReturnType<typeof previewUrl>>["events"] = [];
    for (const url of job.urls) {
      try {
        const p = await previewUrl(url);
        if ((p.events?.length || 0) > events.length) events = p.events || [];
      } catch {
        /* try next */
      }
    }
    console.log(`\n${job.slug} preview=${events.length}`);
    let attached = 0;
    for (const ev of events) {
      if (!ev.startDate || !ev.name) continue;
      const fp = fingerprint({ startDate: ev.startDate, name: ev.name, lat: ev.lat, lng: ev.lng });
      let eventId: string | null = null;
      const { data: byFp } = await supabase
        .from("events")
        .select("id, series_id, status, visibility")
        .eq("fingerprint", fp)
        .is("merged_into_id", null)
        .maybeSingle();
      if (byFp) eventId = byFp.id as string;
      if (!eventId) {
        const tokens = normalizeName(ev.name).split(" ").filter((t) => t.length > 3).slice(0, 2);
        if (tokens.length) {
          const { data: day } = await supabase
            .from("events")
            .select("id, name, series_id")
            .eq("start_date", ev.startDate)
            .is("merged_into_id", null)
            .ilike("name", `%${tokens.join("%")}%`)
            .limit(8);
          const hit =
            (day || []).find((d) => normalizeName(d.name) === normalizeName(ev.name)) ||
            (day || [])[0];
          if (hit) eventId = hit.id as string;
        }
      }
      if (!eventId) {
        console.log("  MISS", ev.startDate, ev.name);
        continue;
      }
      const { data: cur } = await supabase.from("events").select("series_id").eq("id", eventId).maybeSingle();
      if (!cur?.series_id) {
        await attachEventSeries(supabase, eventId, series.id, { primary: true, source: "attach-preview" });
      } else if (cur.series_id !== series.id) {
        await attachSecondarySeries(supabase, eventId, series.id, "attach-preview");
      } else {
        await attachEventSeries(supabase, eventId, series.id, { primary: true, source: "attach-preview" });
      }
      // Unhide if watcher parked it
      await supabase
        .from("events")
        .update({ visibility: "public", updated_at: new Date().toISOString() })
        .eq("id", eventId)
        .eq("visibility", "hidden")
        .is("merged_into_id", null);
      attached++;
    }
    const listed = await listEvents({ seriesSlug: job.slug });
    console.log(`  attached=${attached} listEvents=${listed.length}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

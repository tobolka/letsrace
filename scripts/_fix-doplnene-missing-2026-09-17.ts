/**
 * Fix missing rounds + probe federation previews for remaining zeros.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";
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

const missing = [
  {
    slug: "3-nations-mtb-cup",
    website: "https://www.3nationscup.eu/de/",
    disciplines: ["mtb", "xco"],
    rounds: [
      { start: "2026-04-04", end: "2026-04-05", name: "3 Nations MTB Cup — Oldenzaal" },
      { start: "2026-04-11", end: "2026-04-12", name: "3 Nations MTB Cup — Sittard" },
    ],
  },
  {
    slug: "gravel-bohemia-cup",
    website: "https://www.graveltour-hlinsko.cz/gravel-bohemia-cup/",
    disciplines: ["gravel"],
    rounds: [{ start: "2026-06-20", name: "Gravel Bohemia Cup 3 — Proseč / Cyklo Maštale" }],
  },
];

async function main() {
  const sb = createServerSupabase();
  for (const plan of missing) {
    const { data: s } = await sb.from("series").select("id").eq("slug", plan.slug).maybeSingle();
    if (!s) {
      console.log("no series", plan.slug);
      continue;
    }
    for (const round of plan.rounds) {
      const fp = fingerprint({ startDate: round.start, name: round.name });
      const slug = slugifyEvent(round.name, round.start);
      const { data: byFp } = await sb
        .from("events")
        .select("id")
        .eq("fingerprint", fp)
        .is("merged_into_id", null)
        .maybeSingle();
      let id = byFp?.id as string | undefined;
      if (!id) {
        const now = new Date().toISOString();
        const { data, error } = await sb
          .from("events")
          .insert({
            slug,
            name: round.name,
            name_normalized: normalizeName(round.name),
            start_date: round.start,
            end_date: round.end ?? null,
            fingerprint: fp,
            disciplines: plan.disciplines,
            audience: "mixed",
            status: round.start < now.slice(0, 10) ? "completed" : "scheduled",
            visibility: "public",
            website_url: plan.website,
            source_kind: "official",
            event_type: "race",
            competition_type: "series_round",
            season: "2026",
            level: "regional",
            created_at: now,
            updated_at: now,
            last_seen_at: now,
          })
          .select("id")
          .single();
        if (error) {
          const suffix = Date.now().toString(36);
          const { data: d2, error: e2 } = await sb
            .from("events")
            .insert({
              slug: `${slug}-${suffix}`,
              name: round.name,
              name_normalized: normalizeName(round.name),
              start_date: round.start,
              end_date: round.end ?? null,
              fingerprint: `${fp}:${suffix}`,
              disciplines: plan.disciplines,
              audience: "mixed",
              status: "scheduled",
              visibility: "public",
              website_url: plan.website,
              source_kind: "official",
              event_type: "race",
              competition_type: "series_round",
              season: "2026",
              level: "regional",
              created_at: now,
              updated_at: now,
              last_seen_at: now,
            })
            .select("id")
            .single();
          if (e2) {
            console.log("FAIL", plan.slug, round.name, e2.message);
            continue;
          }
          id = d2!.id as string;
        } else {
          id = data!.id as string;
        }
      }
      const { data: ev } = await sb.from("events").select("series_id").eq("id", id!).maybeSingle();
      if (!ev?.series_id) await attachEventSeries(sb, id!, s.id, { primary: true, source: "doplnene-seed-fix" });
      else if (ev.series_id !== s.id) await attachSecondarySeries(sb, id!, s.id, "doplnene-seed-fix");
      else await attachEventSeries(sb, id!, s.id, { primary: true, source: "doplnene-seed-fix" });
      console.log("OK", plan.slug, round.start, round.name);
    }
    console.log("=>", (await listEvents({ seriesSlug: plan.slug })).length);
  }

  // Check if existing XCO NRW / DZKol events can be linked by name search
  for (const [slug, q] of [
    ["mtb-nrw-fun-cup", "%NRW%"],
    ["mtb-schuler-cup-nrw", "%Schüler%"],
    ["challenge-dzkol-mtb", "%DZKol%"],
    ["challenge-dzkol-szosa", "%DZKol%"],
  ] as const) {
    const { data } = await sb
      .from("events")
      .select("id, name, start_date, series_id")
      .ilike("name", q)
      .gte("start_date", "2026-01-01")
      .lte("start_date", "2026-12-31")
      .is("merged_into_id", null)
      .limit(15);
    console.log("\nEXISTING", slug, data?.length ?? 0);
    for (const e of data || []) console.log(" ", e.start_date, e.name, e.series_id?.slice(0, 8));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

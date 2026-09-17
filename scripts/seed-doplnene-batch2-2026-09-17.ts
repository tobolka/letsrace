/**
 * Seed batch 2: Zeitfahr-CUP + Allgäuer Alpenwasser Nachwuchs Cup.
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

type Round = { start: string; end?: string; name: string };
type Plan = { slug: string; website: string; disciplines: string[]; rounds: Round[] };

const PLANS: Plan[] = [
  {
    slug: "zeitfahr-cup",
    website: "https://zeitfahr-cup.at/wettkaempfe-2/",
    disciplines: ["tt", "road"],
    rounds: [
      { start: "2026-05-01", name: "ZeitFahr-CUP — EZF Perg (1600HM)" },
      { start: "2026-05-17", name: "ZeitFahr-CUP — Bike the Lies (1600HM)" },
      { start: "2026-05-30", name: "ZeitFahr-CUP — EZF Königswiesen (1600HM)" },
      { start: "2026-08-08", name: "ZeitFahr-CUP — EZF Seibersdorf22 (SPEED)" },
      { start: "2026-08-22", name: "ZeitFahr-CUP — EZF Seibersdorf44 (SPEED)" },
      { start: "2026-09-05", name: "ZeitFahr-CUP — EZF Bärnkopf (SPEED)" },
    ],
  },
  {
    slug: "allgauer-alpenwasser-nachwuchs-cup",
    website:
      "https://radsportbezirk-schwaben.de/wp-content/uploads/2026/03/202603_Allgaeuer-Alpenwasser-Nachwuchs-Cup-2026_GA_final.pdf",
    disciplines: ["road"],
    rounds: [
      { start: "2026-04-18", name: "Allgäuer Alpenwasser Nachwuchs Cup — Biberach Omnium" },
      { start: "2026-05-09", name: "Allgäuer Alpenwasser Nachwuchs Cup — Tettnang Zeitfahren" },
      { start: "2026-06-05", name: "Allgäuer Alpenwasser Nachwuchs Cup — Rettenberg Bergrennen" },
      { start: "2026-06-06", name: "Allgäuer Alpenwasser Nachwuchs Cup — Martinszell Rundstrecke" },
      { start: "2026-06-07", name: "Allgäuer Alpenwasser Nachwuchs Cup — Sonthofen Rundstrecke" },
      { start: "2026-07-17", name: "Allgäuer Alpenwasser Nachwuchs Cup — Kempten Kriterium" },
      { start: "2026-09-12", name: "Allgäuer Alpenwasser Nachwuchs Cup — Leutkirch (Finale)" },
    ],
  },
];

async function seriesId(sb: ReturnType<typeof createServerSupabase>, slug: string) {
  const { data } = await sb.from("series").select("id").eq("slug", slug).maybeSingle();
  return data?.id as string | undefined;
}

async function findOrCreate(sb: ReturnType<typeof createServerSupabase>, plan: Plan, round: Round) {
  const fp = fingerprint({ startDate: round.start, name: round.name });
  const slug = slugifyEvent(round.name, round.start);
  const { data: byFp } = await sb
    .from("events")
    .select("id")
    .eq("fingerprint", fp)
    .is("merged_into_id", null)
    .maybeSingle();
  if (byFp?.id) return byFp.id as string;

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
      console.error("ERR", plan.slug, round.name, e2.message);
      return null;
    }
    return d2!.id as string;
  }
  return data!.id as string;
}

async function main() {
  const sb = createServerSupabase();
  for (const plan of PLANS) {
    const sid = await seriesId(sb, plan.slug);
    if (!sid) {
      console.log("MISSING", plan.slug);
      continue;
    }
    for (const round of plan.rounds) {
      const id = await findOrCreate(sb, plan, round);
      if (!id) continue;
      const { data: ev } = await sb.from("events").select("series_id").eq("id", id).maybeSingle();
      if (!ev?.series_id) await attachEventSeries(sb, id, sid, { primary: true, source: "doplnene-seed-2" });
      else if (ev.series_id !== sid) await attachSecondarySeries(sb, id, sid, "doplnene-seed-2");
      else await attachEventSeries(sb, id, sid, { primary: true, source: "doplnene-seed-2" });
      console.log("OK", plan.slug, round.start, round.name);
    }
    console.log("=>", plan.slug, (await listEvents({ seriesSlug: plan.slug })).length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

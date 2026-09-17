/**
 * Seed CZ calendars from official pages while bulk ingest runs.
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

type Round = { start: string; end?: string; name: string; place: string; website?: string; disciplines?: string[] };
type Plan = { slug: string; website: string; disciplines: string[]; rounds: Round[] };

const PLANS: Plan[] = [
  {
    slug: "blinduro-king-queen",
    website: "https://www.blinduro.com/novinky/terminy-na-rok-2026/",
    disciplines: ["mtb", "enduro", "dh"],
    rounds: [
      { start: "2026-02-28", name: "Blinduro Zima 2026", place: "Česko" },
      { start: "2026-05-08", end: "2026-05-10", name: "Blinduro X 2026", place: "Česko" },
      { start: "2026-06-13", end: "2026-06-14", name: "Blinduro Fest 2026", place: "Česko" },
      { start: "2026-09-05", end: "2026-09-06", name: "Gravel Blinduro", place: "Česko", disciplines: ["gravel"] },
      { start: "2026-10-03", end: "2026-10-04", name: "Blinduro Podzim", place: "Česko" },
    ],
  },
  {
    slug: "japa-cup",
    website: "https://www.japasport.cz/japa-cup-2026/",
    disciplines: ["mtb", "xco"],
    rounds: [
      { start: "2026-04-19", name: "JAPA CUP — Pržno", place: "Pržno" },
      { start: "2026-05-17", name: "JAPA CUP — Hodoňovice", place: "Hodoňovice" },
      { start: "2026-05-31", name: "JAPA CUP — Frýdlant nad Ostravicí", place: "Frýdlant nad Ostravicí" },
      { start: "2026-07-25", name: "JAPA CUP — Hukvaldy", place: "Hukvaldy" },
      { start: "2026-09-12", name: "JAPA CUP — Janovice / Bystré (finále)", place: "Janovice / Bystré" },
    ],
  },
  {
    slug: "stredecni-pohar",
    website: "https://stredecnipohar.cz/",
    disciplines: ["mtb", "xco"],
    rounds: [
      { start: "2026-09-02", name: "Středeční pohár — Malé Svatoňovice / Odolov", place: "Malé Svatoňovice" },
      { start: "2026-09-09", name: "Středeční pohár — Úpice / Rtyňka", place: "Úpice" },
      { start: "2026-09-16", name: "Středeční pohár — Červený Kostelec / Skalka", place: "Červený Kostelec" },
      { start: "2026-09-23", name: "Středeční pohár — Adršpach / Křížová cesta", place: "Adršpach" },
      { start: "2026-09-30", name: "Středeční pohár — Jičín / Dřevěnice", place: "Dřevěnice" },
      { start: "2026-10-07", name: "Středeční pohár — Hronov / U hřbitova", place: "Hronov" },
      { start: "2026-10-17", name: "Středeční pohár — Police nad Metují / Zděřina", place: "Police nad Metují" },
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
  const { data: byFp } = await sb.from("events").select("id").eq("fingerprint", fp).is("merged_into_id", null).maybeSingle();
  if (byFp?.id) return byFp.id as string;
  const tokens = normalizeName(round.name).split(" ").filter((t) => t.length > 3).slice(0, 2);
  if (tokens.length) {
    const { data: day } = await sb
      .from("events")
      .select("id, name")
      .eq("start_date", round.start)
      .is("merged_into_id", null)
      .ilike("name", `%${tokens.join("%")}%`)
      .limit(5);
    const exact = (day || []).find((d) => normalizeName(d.name) === normalizeName(round.name));
    if (exact) return exact.id as string;
    if (day?.length === 1) return day[0]!.id as string;
  }
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
      disciplines: round.disciplines || plan.disciplines,
      audience: "mixed",
      status: round.start < now.slice(0, 10) ? "completed" : "scheduled",
      visibility: "public",
      website_url: round.website || plan.website,
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
        disciplines: round.disciplines || plan.disciplines,
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
      console.log("ERR", e2.message, round.name);
      return null;
    }
    return d2!.id as string;
  }
  return data!.id as string;
}

async function main() {
  const sb = createServerSupabase();
  const now = new Date().toISOString();
  for (const plan of PLANS) {
    console.log(`\n===== ${plan.slug}`);
    const sid = await seriesId(sb, plan.slug);
    if (!sid) {
      console.log("MISSING");
      continue;
    }
    await sb
      .from("series")
      .update({ website_url: plan.website, source_url: plan.website, updated_at: now, last_seen_at: now })
      .eq("id", sid);
    for (const round of plan.rounds) {
      const id = await findOrCreate(sb, plan, round);
      if (!id) continue;
      const { data: ev } = await sb.from("events").select("series_id").eq("id", id).maybeSingle();
      if (!ev?.series_id) await attachEventSeries(sb, id, sid, { primary: true, source: "cz-calendar-seed" });
      else if (ev.series_id !== sid) await attachSecondarySeries(sb, id, sid, "cz-calendar-seed");
      else await attachEventSeries(sb, id, sid, { primary: true, source: "cz-calendar-seed" });
      console.log("OK", round.start, round.name);
    }
    console.log("=>", (await listEvents({ seriesSlug: plan.slug })).length);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

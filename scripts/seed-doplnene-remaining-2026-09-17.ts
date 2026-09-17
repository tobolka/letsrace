/**
 * Seed remaining doplněné calendars parsed from official pages / PDFs.
 * Usage: npx tsx scripts/seed-doplnene-remaining-2026-09-17.ts [--dry]
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

const DRY = process.argv.includes("--dry");

type Round = { start: string; end?: string; name: string; place?: string; disciplines?: string[] };
type Plan = { slug: string; website: string; disciplines: string[]; rounds: Round[] };

const PLANS: Plan[] = [
  {
    slug: "garmin-gravel-race",
    website: "https://gravelrace.pl/",
    disciplines: ["gravel"],
    rounds: [
      { start: "2026-07-19", name: "Garmin Gravel Race — Tolkmicko", place: "Tolkmicko" },
      { start: "2026-10-04", name: "Garmin Gravel Race — Szklarska Poręba", place: "Szklarska Poręba" },
    ],
  },
  {
    slug: "enduro-mtb-series",
    website: "https://enduromtbseries.com.pl/pl/",
    disciplines: ["mtb", "enduro"],
    rounds: [
      {
        start: "2026-04-30",
        end: "2026-05-03",
        name: "Karkonoski Festiwal Rowerowy / Enduro MTB Series — Przesieka",
        place: "Przesieka",
      },
      {
        start: "2026-09-04",
        end: "2026-09-05",
        name: "Enduro MTB Series — Lądek-Zdrój",
        place: "Lądek-Zdrój",
      },
      {
        start: "2026-09-19",
        end: "2026-09-20",
        name: "Bosch Enduro MTB Series — Brenna",
        place: "Brenna",
      },
    ],
  },
  {
    slug: "robinsonada",
    website: "https://robinsonada.com.pl/",
    disciplines: ["gravel", "road"],
    rounds: [
      { start: "2026-06-27", end: "2026-06-28", name: "Robinsonada Dolnośląska — Wrocław", place: "Wrocław" },
      { start: "2026-07-18", end: "2026-07-19", name: "Robinsonada Mazowiecka — Warszawa", place: "Warszawa" },
      { start: "2026-08-08", end: "2026-08-09", name: "Robinsonada Kujawsko-Pomorska — Toruń", place: "Toruń" },
      { start: "2026-09-05", end: "2026-09-06", name: "Robinsonada Łódzka — Łódź", place: "Łódź" },
      { start: "2026-09-26", end: "2026-09-27", name: "Robinsonada Wielkopolska — Poznań", place: "Poznań" },
      { start: "2026-10-17", end: "2026-10-18", name: "Robinsonada Pomorska — Gdańsk", place: "Gdańsk" },
    ],
  },
  {
    slug: "poland-bike-road",
    website: "https://polandbikeroad.pl/",
    disciplines: ["road"],
    rounds: [
      {
        start: "2026-05-01",
        name: "XVII Memoriał Stanisława Królaka — Warszawa",
        place: "Warszawa",
      },
      {
        start: "2026-05-31",
        name: "X Starachowicka Strzała — Starachowice",
        place: "Starachowice",
      },
      {
        start: "2026-08-30",
        name: "II Wyścig z Naturą — Żabia Wola",
        place: "Żabia Wola",
      },
    ],
  },
  {
    slug: "szosomannia",
    website: "https://www.ztc.pl/wyscigi/szosomannia%2C4.html",
    disciplines: ["road"],
    rounds: [
      { start: "2026-05-03", name: "SZOSOMANNIA 1 — Chrzczonowice", place: "Chrzczonowice" },
      { start: "2026-05-17", name: "SZOSOMANNIA 2 — Wola Pękoszewska", place: "Wola Pękoszewska" },
      { start: "2026-05-31", name: "SZOSOMANNIA 3 — Grądy", place: "Grądy" },
      { start: "2026-06-21", name: "SZOSOMANNIA 4 — Chrzczonowice", place: "Chrzczonowice" },
      { start: "2026-07-12", name: "SZOSOMANNIA 5 — Marianów", place: "Marianów" },
      { start: "2026-07-19", name: "SZOSOMANNIA 6 — Grądy", place: "Grądy" },
      { start: "2026-08-16", name: "SZOSOMANNIA 7 — Marianów", place: "Marianów" },
      { start: "2026-08-30", name: "SZOSOMANNIA 8 — Chrzczonowice", place: "Chrzczonowice" },
      { start: "2026-09-20", name: "SZOSOMANNIA 9 — Wręcza (finał)", place: "Wręcza" },
    ],
  },
  {
    slug: "krol-i-krolowa-joya-joy-ride-gravity",
    website: "https://joyride.pl/kalendarz-wydarzen/",
    disciplines: ["mtb", "enduro", "dh"],
    rounds: [
      {
        start: "2026-07-25",
        end: "2026-08-01",
        name: "Joy Ride Gravity — Król i Królowa Joya (turnus 1)",
        place: "Polska",
      },
      {
        start: "2026-08-01",
        end: "2026-08-08",
        name: "Joy Ride Gravity — Król i Królowa Joya (turnus 2)",
        place: "Polska",
      },
    ],
  },
  {
    slug: "3-nations-mtb-cup",
    website: "https://www.3nationscup.eu/de/",
    disciplines: ["mtb", "xco"],
    rounds: [
      { start: "2026-04-04", end: "2026-04-05", name: "3 Nations MTB Cup — Oldenzaal", place: "Oldenzaal" },
      { start: "2026-04-11", end: "2026-04-12", name: "3 Nations MTB Cup — Sittard", place: "Sittard" },
      { start: "2026-04-25", end: "2026-04-26", name: "3 Nations MTB Cup — VAM Berg", place: "VAM Berg" },
      { start: "2026-05-16", end: "2026-05-17", name: "3 Nations MTB Cup — Langdorp", place: "Langdorp" },
      { start: "2026-05-29", end: "2026-05-30", name: "3 Nations MTB Cup — Genk", place: "Genk" },
      { start: "2026-06-06", end: "2026-06-07", name: "3 Nations MTB Cup — Remscheid", place: "Remscheid" },
      { start: "2026-08-08", end: "2026-08-09", name: "3 Nations MTB Cup — Winterberg", place: "Winterberg" },
    ],
  },
  {
    slug: "gunsha-cross-challenge",
    website: "https://crosscup.org/",
    disciplines: ["cyclocross"],
    rounds: [
      { start: "2026-10-11", name: "GUNSHA Cross Challenge — Borna", place: "Borna" },
      { start: "2026-10-25", name: "GUNSHA Cross Challenge — Radibor", place: "Radibor" },
      { start: "2026-11-01", name: "GUNSHA Cross Challenge — Granschütz", place: "Granschütz" },
      { start: "2026-11-07", name: "GUNSHA Cross Challenge — Erfurt", place: "Erfurt" },
      { start: "2026-11-08", name: "GUNSHA Cross Challenge — Jena", place: "Jena" },
      { start: "2026-11-21", name: "GUNSHA Cross Challenge — Frankenhain", place: "Frankenhain" },
      { start: "2026-11-29", name: "GUNSHA Cross Challenge — Wittenberg", place: "Wittenberg" },
    ],
  },
  {
    slug: "gravel-bohemia-cup",
    website: "https://www.graveltour-hlinsko.cz/gravel-bohemia-cup/",
    disciplines: ["gravel"],
    rounds: [
      { start: "2026-05-08", name: "Gravel Bohemia Cup 1 — Jabkenice", place: "Jabkenice" },
      { start: "2026-05-30", name: "Gravel Bohemia Cup 2 — Vír", place: "Vír" },
      { start: "2026-06-20", name: "Gravel Bohemia Cup 3 — Proseč / Cyklo Maštale", place: "Proseč" },
      { start: "2026-09-05", name: "Gravel Bohemia Cup 4 — Rváčov", place: "Rváčov" },
    ],
  },
  {
    slug: "skoda-bike-open-tour",
    website: "https://web.sbot.sk/kalendar.php",
    disciplines: ["mtb"],
    rounds: [
      { start: "2026-04-18", name: "Škoda Svätojurský MTB maratón", place: "Svätý Jur" },
      { start: "2026-05-23", name: "Škoda MTB maratón Rajecké Teplice", place: "Rajecké Teplice" },
      { start: "2026-06-06", name: "Škoda Slovenský raj", place: "Hrabušice – Podlesok" },
      { start: "2026-06-27", name: "Škoda MTB cyklomaratón Topoľčianky", place: "Topoľčianky" },
      { start: "2026-08-08", name: "Škoda HORAL MTB maratón", place: "Svit" },
      { start: "2026-09-12", name: "Škoda Stupava maratón", place: "Stupava" },
    ],
  },
  {
    slug: "mtb-cross-maraton",
    website: "https://www.mtbcross.pl/",
    disciplines: ["mtb"],
    rounds: [
      { start: "2026-04-04", name: "MTB Cross Maraton — Dallas", place: "Dallas" },
      { start: "2026-05-29", name: "MTB Cross Maraton", place: "Polska" },
      { start: "2026-08-28", name: "MTB Cross Maraton", place: "Polska" },
      { start: "2026-09-27", name: "MTB Cross Maraton — Chęciny (finał)", place: "Chęciny" },
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

  const tokens = normalizeName(round.name)
    .split(" ")
    .filter((t) => t.length > 3)
    .slice(0, 2);
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

  if (DRY) return `dry:${slug}`;
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
      console.error("insert fail", plan.slug, round.name, e2.message);
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
      console.log("MISSING SERIES", plan.slug);
      continue;
    }
    const before = (await listEvents({ seriesSlug: plan.slug })).length;
    let created = 0;
    for (const round of plan.rounds) {
      const eid = await findOrCreate(sb, plan, round);
      if (!eid || String(eid).startsWith("dry:")) {
        if (DRY) created++;
        continue;
      }
      if (!DRY) {
        const { data: ev } = await sb.from("events").select("series_id").eq("id", eid).maybeSingle();
        if (!ev?.series_id) await attachEventSeries(sb, eid, sid, { primary: true, source: "doplnene-seed" });
        else if (ev.series_id !== sid) await attachSecondarySeries(sb, eid, sid, "doplnene-seed");
        else await attachEventSeries(sb, eid, sid, { primary: true, source: "doplnene-seed" });
      }
      created++;
    }
    const after = DRY ? before + created : (await listEvents({ seriesSlug: plan.slug })).length;
    console.log(
      JSON.stringify({
        slug: plan.slug,
        before,
        after,
        rounds: plan.rounds.length,
        dry: DRY,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

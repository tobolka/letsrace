/**
 * Seed remaining stale series from official HTML/PDF calendars (user URLs).
 * Usage: npx tsx scripts/seed-stale-kalendare-2026-09-17.ts [--dry]
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
type Plan = {
  slug: string;
  website: string;
  disciplines: string[];
  rounds: Round[];
  note?: string;
};

const PLANS: Plan[] = [
  {
    slug: "austria-marathon-cup",
    website: "https://www.salzkammergut-trophy.at/austria_marathon_cup-pid1794",
    disciplines: ["mtb", "xcm"],
    rounds: [
      { start: "2026-07-04", name: "Austria Marathon Cup — Graz / Stattegg", place: "Graz/Stattegg" },
      { start: "2026-07-18", name: "Austria Marathon Cup — Bad Goisern", place: "Bad Goisern" },
      { start: "2026-08-08", name: "Austria Marathon Cup — Ischgl", place: "Ischgl" },
    ],
  },
  {
    slug: "cycling-cup-tirol",
    website: "https://www.lrv-tirol.at/news_1/neues-vom-cycling-cup-tirol-2026/",
    disciplines: ["road", "mtb", "xco"],
    rounds: [
      { start: "2026-04-05", name: "CCT — Hungerburg Classics", place: "Innsbruck", disciplines: ["road"] },
      { start: "2026-04-06", name: "CCT — Feuchtner Gedenkrennen", place: "Söll", disciplines: ["road"] },
      { start: "2026-05-10", name: "CCT — Ötztaler MTB Festival", place: "Haiming", disciplines: ["mtb", "xco"] },
      { start: "2026-05-17", name: "CCT — Wilder Kaiser MTB Race", place: "Scheffau", disciplines: ["mtb", "xco"] },
      { start: "2026-06-01", name: "CCT — Achensee Kidsrace", place: "Achenkirch", disciplines: ["mtb", "xco"] },
      { start: "2026-06-21", name: "CCT — Mieminger XC Nachwuchsrennen", place: "Mieming", disciplines: ["mtb", "xco"] },
      {
        start: "2026-08-07",
        end: "2026-08-08",
        name: "CCT — Ironbike Ischgl",
        place: "Ischgl",
        disciplines: ["mtb", "xco"],
      },
      { start: "2026-09-05", name: "CCT — Nachwuchspreis Schwaz", place: "Schwaz", disciplines: ["mtb", "xco"] },
      { start: "2026-09-27", name: "CCT — Schwalben Eliminator", place: "Innsbruck", disciplines: ["mtb", "xce"] },
      { start: "2026-10-11", name: "CCT — Finale Thaur", place: "Thaur", disciplines: ["mtb", "road"] },
    ],
  },
  {
    slug: "raiffeisen-rad-nachwuchs-trophy-steiermark-powered-by-energi",
    website:
      "https://lrvsteiermark.at/wp-content/uploads/2026/02/Ausschreibung-NEU_Raiffeisen-Nachwuchs-Trophy_2026.pdf",
    disciplines: ["road", "mtb"],
    rounds: [
      {
        start: "2026-04-12",
        name: "Raiffeisen Nachwuchs-Trophy — Straßenrennen St. Marein",
        place: "St. Marein bei Feistritz",
        disciplines: ["road"],
      },
      {
        start: "2026-04-19",
        name: "Raiffeisen Nachwuchs-Trophy — Stubalpen Kids-Trophy",
        place: "Maria Lankowitz",
        disciplines: ["mtb"],
      },
      {
        start: "2026-05-16",
        name: "Raiffeisen Nachwuchs-Trophy — Bergrennen Kindberg",
        place: "Kindberg",
        disciplines: ["road"],
      },
      {
        start: "2026-05-17",
        name: "Raiffeisen Nachwuchs-Trophy — EZF Großhartmannsdorf",
        place: "Großhartmannsdorf",
        disciplines: ["road", "tt"],
      },
      {
        start: "2026-06-04",
        name: "Raiffeisen Nachwuchs-Trophy — Kriterium Grafenstein",
        place: "Grafenstein",
        disciplines: ["road"],
      },
      {
        start: "2026-06-14",
        name: "Raiffeisen Nachwuchs-Trophy — Hügelland-Trophy",
        place: "Laßnitzhöhe",
        disciplines: ["mtb"],
      },
      {
        start: "2026-07-05",
        name: "Raiffeisen Nachwuchs-Trophy — Grazer Junior-Challenge",
        place: "Stattegg",
        disciplines: ["mtb"],
      },
      {
        start: "2026-10-03",
        name: "Raiffeisen Nachwuchs-Trophy — Pumpiläum Grazer Youngsters-Cup",
        place: "Stattegg",
        disciplines: ["mtb"],
      },
    ],
  },
  {
    slug: "vkct",
    website: "https://vkct.webnode.cz/",
    disciplines: ["mtb", "road"],
    rounds: [
      { start: "2026-05-23", name: "VKCT — Hradní okruh", place: "Brumov-Bylnice" },
      { start: "2026-06-13", name: "VKCT — Klobucká kola", place: "Klobouky" },
      { start: "2026-08-08", name: "VKCT — Bratřejovské kotáry", place: "Bratřejov" },
      { start: "2026-09-05", name: "VKCT — XC Cup Napajedla", place: "Napajedla" },
      {
        start: "2026-10-03",
        name: "VKCT — Ploština – Memoriál Josefa Valčíka",
        place: "Ploština",
      },
    ],
  },
  {
    slug: "3lions-gravel-cup",
    website: "https://wrsv.de/fileadmin/wrsv/downloads/Downloads_MTB/3Lions_2026_Flyer_1_final1.pdf",
    disciplines: ["gravel", "mtb"],
    rounds: [
      { start: "2026-04-18", name: "3Lions — KINETIXX Frühjahrs-Marathon" },
      { start: "2026-04-25", name: "3Lions — 10. Schönbuch-Trophy" },
      { start: "2026-07-04", name: "3Lions — 6. Härtsfeld MTB & Gravel Race" },
      { start: "2026-08-02", name: "3Lions — Fast & Forest MTB/Gravel-Rennen" },
      { start: "2026-09-13", name: "3Lions — 28. Schwarzwald Bike Marathon" },
      { start: "2026-09-26", name: "3Lions — 30. ALB-GOLD-Trophy" },
      { start: "2026-10-03", name: "3Lions — 6. GRAVEL-MTB-Race am Kastell" },
      { start: "2026-10-11", name: "3Lions — Gravel Race Weekend" },
      { start: "2026-10-17", name: "3Lions — 2. Deißlinger Gravel-Rennen" },
      { start: "2026-11-07", name: "3Lions — 6. RCV Gravel Cross Race" },
    ],
  },
  {
    slug: "cx-cup-niedersachsen-friends-2026-27",
    website: "https://www.braunschweiger-cross-serie-cx-niedersachsen.de/inhaltsverzeichnis/aktuelles-und-termine/",
    disciplines: ["cyclocross"],
    rounds: [
      { start: "2026-09-12", name: "CX-Cup NDS — Baunatal", place: "Baunatal" },
      { start: "2026-09-19", name: "CX-Cup NDS — Bad Salzdetfurth", place: "Bad Salzdetfurth" },
      { start: "2026-10-31", name: "CX-Cup NDS — Braunschweig Lehndorf", place: "Braunschweig" },
      { start: "2026-11-15", name: "CX-Cup NDS — Hardegsen", place: "Hardegsen" },
      // Duderstadt 21.11.2026 cancelled per source — skip
      { start: "2026-12-19", name: "CX-Cup NDS — Nienhagen (Finale)", place: "Nienhagen" },
    ],
  },
  {
    slug: "german-gravel-league",
    website: "https://germangravelleague.de/",
    disciplines: ["gravel"],
    rounds: [
      { start: "2026-05-01", name: "German Gravel League — Kloster Lehnin", place: "Kloster Lehnin" },
      { start: "2026-06-14", name: "German Gravel League — BOPs Gravel", place: "Bad Salzdetfurth" },
      {
        start: "2026-07-03",
        end: "2026-07-05",
        name: "German Gravel League — Gravelmania",
        place: "Lauchhammer OT Kostebrau",
      },
      { start: "2026-07-12", name: "German Gravel League — Sauerland Gravel", place: "Olsberg-Bruchhausen" },
      {
        start: "2026-09-11",
        end: "2026-09-13",
        name: "German Gravel League — Rennsteig Gravel",
        place: "Oberhof",
      },
    ],
  },
  {
    slug: "schwaben-gravel-trophy",
    website: "https://www.schwaben-gravel-trophy.de/",
    disciplines: ["gravel"],
    rounds: [
      { start: "2026-03-29", name: "Schwaben Gravel Trophy #1 — RSC Aichach", place: "Aichach" },
      { start: "2026-04-11", name: "Schwaben Gravel Trophy #2 — RSC Kempten", place: "Kempten" },
      { start: "2026-04-19", name: "Schwaben Gravel Trophy #3 — VC Mindelheim", place: "Mindelheim" },
      { start: "2026-04-26", name: "Schwaben Gravel Trophy #4 — SSV Wildpoldsried", place: "Wildpoldsried" },
      { start: "2026-06-20", name: "Schwaben Gravel Trophy #5", place: "Schwaben" },
    ],
  },
  {
    slug: "daretobe-maraton-mtb",
    website: "https://maratonmtb.pl/",
    disciplines: ["mtb", "xcm"],
    rounds: [
      { start: "2026-04-26", name: "DareToBe Maraton MTB — Daleszyce", place: "Daleszyce" },
      { start: "2026-05-09", name: "DareToBe Maraton MTB — Wadowice", place: "Wadowice" },
      { start: "2026-06-14", name: "DareToBe Maraton MTB — Stryszawa", place: "Stryszawa" },
      { start: "2026-06-21", name: "DareToBe Maraton MTB — Kielce", place: "Kielce" },
      { start: "2026-09-05", name: "DareToBe Maraton MTB — Szczawnica", place: "Szczawnica" },
      { start: "2026-09-19", name: "DareToBe Maraton MTB — Ostrowsko", place: "Ostrowsko" },
    ],
  },
  {
    slug: "legia-mtb-maraton",
    website: "https://www.legia-mtbmaraton.pl/kalendarz/",
    disciplines: ["mtb", "xcm"],
    rounds: [
      { start: "2026-05-09", name: "Legia MTB Maraton — Łaskarzew", place: "Łaskarzew" },
      { start: "2026-05-16", name: "Legia MTB Maraton — Leszno", place: "Leszno" },
      { start: "2026-05-31", name: "Legia MTB Maraton — Rząśnik-Porządzie", place: "Rząśnik-Porządzie" },
      { start: "2026-10-03", name: "Legia MTB Maraton — Warszawa-Wola (finał)", place: "Warszawa-Wola" },
    ],
  },
  {
    slug: "puchar-strefy-mtb-sudety",
    website: "https://www.strefamtbsudety.pl/zaproszenie-na-puchar-strefy/",
    disciplines: ["mtb"],
    rounds: [
      { start: "2026-05-17", name: "Puchar Strefy MTB Sudety — Bielawa", place: "Bielawa" },
      {
        start: "2026-07-05",
        name: "Puchar Strefy MTB Sudety — Gmina Świdnica (Bystrzyca Górna)",
        place: "Bystrzyca Górna",
      },
      { start: "2026-09-20", name: "Puchar Strefy MTB Sudety — Głuszyca", place: "Głuszyca" },
    ],
  },
  {
    slug: "hornonitrianska-enduro-seria-2026-mtbiker-hes",
    website: "https://www.enduroseria.sk/",
    disciplines: ["mtb", "enduro"],
    rounds: [
      {
        start: "2026-05-09",
        end: "2026-05-10",
        name: "MTBIKER HES / KENNY SPEN — Úvodné kolo",
        place: "Horná Nitra",
      },
      {
        start: "2026-05-30",
        name: "MTBIKER HES — Samostatné kolo SPEN (Biker magazine)",
        place: "Slovensko",
      },
      {
        start: "2026-06-19",
        end: "2026-06-20",
        name: "MTBIKER HES / KENNY SPEN — Majstrovstvá Slovenska",
        place: "Slovensko",
      },
      {
        start: "2026-09-12",
        end: "2026-09-13",
        name: "MTBIKER HES / KENNY SPEN — Spoločné kolo",
        place: "Horná Nitra",
      },
      {
        start: "2026-10-10",
        end: "2026-10-11",
        name: "MTBIKER HES / KENNY SPEN — Finále",
        place: "Horná Nitra",
      },
    ],
  },
  {
    slug: "mtb-liga-presovskeho-kraja",
    website: "https://www.mtbstupak.sk/podhoriansky-stupak-2/mtb-liga-presovskeho-kraja-2026/",
    disciplines: ["mtb"],
    rounds: [
      { start: "2026-06-13", name: "MTB Liga PK — MTB Slovenský opál", place: "Sigord" },
      { start: "2026-06-21", name: "MTB Liga PK — Humenský MTB maratón", place: "Hubková" },
      { start: "2026-07-18", name: "MTB Liga PK — Ondavský cyklomaratón", place: "Stropkov" },
      { start: "2026-07-26", name: "MTB Liga PK — Raslavický pedál", place: "Raslavice" },
      { start: "2026-08-22", name: "MTB Liga PK — Čarnohurec", place: "Brezovica" },
      { start: "2026-09-13", name: "MTB Liga PK — Podhoriansky stupák", place: "Podhorany" },
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

  if (DRY) return `dry:${slug}`;
  const now = new Date().toISOString();
  const payload = {
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
  };
  const { data, error } = await sb.from("events").insert(payload).select("id").single();
  if (error) {
    const suffix = Date.now().toString(36);
    const { data: d2, error: e2 } = await sb
      .from("events")
      .insert({ ...payload, slug: `${slug}-${suffix}`, fingerprint: `${fp}:${suffix}` })
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
  const now = new Date().toISOString();
  for (const plan of PLANS) {
    const sid = await seriesId(sb, plan.slug);
    if (!sid) {
      console.log("MISSING SERIES", plan.slug);
      continue;
    }
    if (!DRY) {
      await sb
        .from("series")
        .update({ website_url: plan.website, source_url: plan.website, updated_at: now, last_seen_at: now })
        .eq("id", sid);
    }
    const before = (await listEvents({ seriesSlug: plan.slug })).length;
    for (const round of plan.rounds) {
      const id = await findOrCreate(sb, plan, round);
      if (!id || String(id).startsWith("dry:")) continue;
      const { data: ev } = await sb.from("events").select("series_id").eq("id", id).maybeSingle();
      if (!ev?.series_id) await attachEventSeries(sb, id, sid, { primary: true, source: "stale-kalendar-seed" });
      else if (ev.series_id !== sid) await attachSecondarySeries(sb, id, sid, "stale-kalendar-seed");
      else await attachEventSeries(sb, id, sid, { primary: true, source: "stale-kalendar-seed" });
    }
    const after = DRY ? before + plan.rounds.length : (await listEvents({ seriesSlug: plan.slug })).length;
    console.log(JSON.stringify({ slug: plan.slug, before, after, rounds: plan.rounds.length }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

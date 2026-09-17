/**
 * Talent Cup, Pohár KV kraje HK, PPKBIKE, Peklo Severu and Šumavský pohár MTB
 * read exactly like their official calendars.
 *
 * All five had an official source in place; the damage came from the sides.
 * Hynek's calendar and sumator label their rows with the series and were
 * allowed to add rounds to it: ANTAL BIKE eleven times over in PKK, Talent
 * Cup's opener beside two more copies of itself, a PPKBIKE round filed under
 * a second series minted from a Hynek code, and the Šumavský parser writing
 * one slug while its rounds lived under another. The watcher now lets only
 * the series' own host attach rounds (see seriesAcceptsSource in run.ts);
 * this folds what already split.
 *
 * Ground truth read from talentcup.cz, pkk-hk.cz, ppkbike.cz/ppk-races.js,
 * pekloseveru.cz/cz/rocnik-2026/propozice-serialu/ and jcp-mtb.cz on
 * 2026-09-17. PPKBIKE's ninth entry on the site is the season party
 * (noRegistration) and stays out on purpose.
 *
 * Usage: nvm use 22 && npx tsx scripts/repair-series-round-2-2026-09-17.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { repairSeriesPlans, type SeriesPlan } from "../src/lib/catalog/repair-series";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may already be set */
  }
}
loadEnv();

const DRY = process.argv.includes("--dry");

const PLANS: SeriesPlan[] = [
  {
    slug: "talent-cup",
    name: "Talent Cup",
    duplicates: [],
    sourceUrl: "https://talentcup.cz/?tcdesignindex=data/zavody.php",
    officialHost: /talentcup\.cz/i,
    rounds: [
      { start: "2026-03-28", name: "Kemp Ejpovice - GOLF OPEN BIKE RACE - Časovka", place: "Ejpovice" },
      { start: "2026-05-02", name: "XCO města KRALOVICE - Hlavní závod seriálu", place: "Kralovice" },
      { start: "2026-07-11", name: "XCO města ÚTERÝ", place: "Úterý" },
      { start: "2026-08-01", name: "XCO obce LITOHLAVY", place: "Litohlavy" },
      { start: "2026-08-15", name: "Blovice - DÚŠA KAP", place: "Blovice" },
      // Hynek lists it on the Saturday, the site on the Sunday.
      { start: "2026-09-06", swallowUntil: "2026-09-06", name: "Plzeň - XCO ŠKODALAND", place: "Plzeň" },
      // Friday–Saturday eliminator; the Saturday rows belong to the finale.
      { start: "2026-09-25", end: "2026-09-26", swallowUntil: "2026-09-25", name: "IDEAX Skočice - ELIMINÁTOR Patrika Gemerského", place: "Skočice" },
      { start: "2026-09-26", name: "IDEAX Skočice - MEMORIÁL Patrika Gemerského - GRANDE FINALE", place: "Skočice" },
    ],
  },
  {
    slug: "pohar-kv-kraje-hk",
    name: "Pohár KV kraje HK",
    duplicates: [],
    sourceUrl: "https://www.pkk-hk.cz/?pkkdesignindex=data/zavody.php",
    officialHost: /pkk-hk\.cz/i,
    rounds: [
      { start: "2026-03-21", name: "Sokolov - JARNÍ BAHNA - XC MICHAL", place: "Sokolov" },
      { start: "2026-05-16", name: "XC CHEB - mistrovství KV kraje", place: "Cheb" },
      { start: "2026-05-30", name: "Ostrov - O POHÁR MĚSTA OSTROV", place: "Ostrov" },
      { start: "2026-06-14", name: "Chodov - SHORT TRACK CHODOV", place: "Chodov" },
      { start: "2026-06-27", name: "AŠ UCI C1", place: "Aš" },
      { start: "2026-08-29", name: "Klášterec nad Ohří - WEMBLOUDOVY HRBY", place: "Klášterec nad Ohří" },
      { start: "2026-09-04", name: "Sokolov - ČASOVKA DO KOPCE", place: "Sokolov" },
      { start: "2026-09-05", name: "Aš - ANTAL BIKE", place: "Aš" },
      { start: "2026-09-13", name: "Chodov - CHODOVSKÝ BIKE", place: "Chodov" },
      { start: "2026-10-03", name: "Ostrov - PARKBIKE OSTROV", place: "Ostrov" },
    ],
  },
  {
    slug: "ppkbike",
    name: "PPKBIKE",
    duplicates: ["ppk-hk"],
    sourceUrl: "https://ppkbike.cz/",
    officialHost: /ppkbike\.cz/i,
    rounds: [
      { start: "2026-03-28", name: "PPKBIKE — Ejpovice", place: "Ejpovice" },
      { start: "2026-04-12", name: "PPKBIKE — Touškov", place: "Město Touškov" },
      { start: "2026-04-25", name: "PPKBIKE — Klatovy", place: "Klatovy" },
      { start: "2026-05-03", name: "PPKBIKE — Domažlice", place: "Domažlice" },
      { start: "2026-06-13", name: "PPKBIKE — Litohlavy", place: "Litohlavy" },
      { start: "2026-06-20", name: "PPKBIKE — Přeštice", place: "Přeštice" },
      { start: "2026-09-12", name: "PPKBIKE — Plzeň", place: "Plzeň" },
      { start: "2026-09-20", name: "PPKBIKE — Čerchov", place: "Pec pod Čerchovem" },
    ],
    foreign: [{ test: /večírek|vecirek/i, seriesSlug: null, hide: true }],
  },
  {
    slug: "peklo-severu",
    name: "Peklo Severu",
    duplicates: [],
    sourceUrl: "https://www.pekloseveru.cz/cz/rocnik-2026/propozice-serialu/",
    officialHost: /pekloseveru\.cz/i,
    // The race pages already name the rounds ("PEKLO SEVERU 2026 #1 - …");
    // only the copies from sebnitzer-mtb-cup.de and Hynek fold in.
    rounds: [
      { start: "2026-04-18", place: "Varnsdorf" },
      { start: "2026-05-02", place: "Sebnitz" },
      { start: "2026-06-20", name: "PEKLO SEVERU 2026 #3 - Fofr cup – maraton", place: "Prysk" },
      { start: "2026-09-12", place: "Liberec" },
      { start: "2026-09-19", place: "Česká Kamenice" },
    ],
  },
  {
    slug: "sumavsky-mtb-pohar",
    name: "Šumavský pohár MTB",
    duplicates: ["sumavsky-pohar-mtb"],
    sourceUrl: "https://jcp-mtb.cz/",
    officialHost: /jcp-mtb\.cz/i,
    rounds: [
      { start: "2026-04-26", name: "Šumavský pohár MTB — Waldkirchen", place: "Waldkirchen" },
      { start: "2026-05-03", name: "Šumavský pohár MTB — Nová Pec", place: "Nová Pec" },
      { start: "2026-05-17", name: "Šumavský pohár MTB — Strakonice", place: "Strakonice" },
      { start: "2026-05-23", name: "Šumavský pohár MTB — Tábor - Čekanice - Cihelna", place: "Tábor" },
      { start: "2026-07-05", name: "Šumavský pohár MTB — Prachatice", place: "Prachatice" },
      { start: "2026-08-30", name: "ROUVY Velká cena Vimperka MTB XCO", place: "Vimperk" },
    ],
  },
];

async function main() {
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  // The Šumavský parser's slug row exists but empty, with the site as its
  // website; the populated row points at a club site. Give the canonical
  // row the calendar before folding.
  if (!DRY) {
    await supabase
      .from("series")
      .update({ website_url: "https://jcp-mtb.cz/", updated_at: now })
      .eq("slug", "sumavsky-mtb-pohar");
    // ČPP Extraliga Masters is a road series that borrowed Peklo Severu's site.
    await supabase
      .from("series")
      .update({ website_url: "https://extraligamasters.cz/", updated_at: now })
      .eq("slug", "cpp-extraliga-masters");
  }

  await repairSeriesPlans(PLANS, { dry: DRY, updatedBy: "series repair round 2 2026-09-17" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

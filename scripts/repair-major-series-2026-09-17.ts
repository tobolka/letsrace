/**
 * The major Czech series read exactly like their official calendars.
 *
 * Each of them had drifted the same way TBC did: a second series row minted
 * from an aggregator's label, the same weekend held three times over (Hynek's
 * Saturday and Sunday rows beside the official one), partner events and
 * awards nights filed as rounds, and — for Kolo pro život — thirty rows of nav
 * links scraped off race pages and all dated the first of May.
 *
 * This is the ground truth, round by round, taken from the series' own
 * calendar pages on 2026-09-17. For every series it:
 *   1. folds duplicate series rows into the canonical one,
 *   2. re-reads the official source so every round has an official row,
 *   3. merges everything in a round's date window into one keeper and gives
 *      it the official name, dates and website, locked so the watcher keeps
 *      them,
 *   4. detaches what is in the series but not a round (partner races keep
 *      their own life; junk and ceremonies are hidden).
 *
 * Usage: nvm use 22 && npx tsx scripts/repair-major-series-2026-09-17.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const PLANS: SeriesPlan[] = [
  {
    slug: "cesky-pohar-mtb",
    name: "Český pohár MTB",
    duplicates: ["cp-mtb", "cesky-pohar-horskych-kol", "mcr-mtb"],
    sourceUrl: "https://www.poharmtb.cz/cross-country",
    officialHost: /poharmtb\.cz/i,
    rounds: [
      { start: "2026-04-18", end: "2026-04-19", name: "ČP MTB — Město Touškov — Touškovská rokle", place: "Město Touškov" },
      { start: "2026-05-09", end: "2026-05-10", name: "ČP MTB — Vimperk — Vodník", place: "Vimperk" },
      { start: "2026-05-31", name: "MČR — Praha — Motol", place: "Praha" },
      { start: "2026-06-06", end: "2026-06-07", name: "ČP MTB — Bedřichov — Jizerská 50 aréna", place: "Bedřichov" },
      { start: "2026-07-17", end: "2026-07-19", name: "MČR — Stupno — Ultramarínka", place: "Stupno" },
      { start: "2026-08-15", end: "2026-08-16", name: "ČP MTB — Ostrava — Hulváky", place: "Ostrava" },
      { start: "2026-09-05", end: "2026-09-06", name: "ČP MTB — Nové Město na Moravě — Vysočina aréna", place: "Nové Město na Moravě" },
    ],
    foreign: [
      { test: /allwyn|bmx czech cup|bmx racing/i, seriesSlug: "cesky-pohar-bmx" },
      { test: /\bf?bmx\b/i, seriesSlug: null },
    ],
  },
  {
    slug: "primacup",
    name: "Prima Cup",
    duplicates: ["prima-cup", "prima-cup-xcm"],
    sourceUrl: "https://www.iprimacup.cz/zavody-2026/",
    officialHost: /iprimacup\.cz/i,
    rounds: [
      { start: "2026-04-11", name: "BEST Hradec Králové", place: "Hradec Králové", website: "https://www.iprimacup.cz/26-hk/" },
      { start: "2026-05-09", name: "BEST Harrachov – Szklarska Poręba, Jakuszyce", place: "Harrachov", website: "https://www.iprimacup.cz/freedom-race/", adopt: /harrachov/i },
      { start: "2026-05-16", name: "Silesia Bike Marathon", place: "Opava", website: "https://www.iprimacup.cz/26-op/", adopt: /silesia bike/i },
      { start: "2026-06-06", name: "BAIC Dolní Morava", place: "Dolní Morava", website: "https://www.iprimacup.cz/26-dm/" },
      { start: "2026-06-13", name: "TCHIBO COFFIZZ Sázava", place: "Sázava", website: "https://www.iprimacup.cz/26-sa/" },
      { start: "2026-07-04", end: "2026-07-06", name: "KupKolo.cz MTB Trilogy", place: "Teplice nad Metují", website: "https://www.iprimacup.cz/26-te/", adopt: /mtb trilogy/i },
      { start: "2026-08-01", name: "FILIPA Podkrkonošský maraton", place: "Lázně Bělohrad", website: "https://www.iprimacup.cz/pm-2026/", adopt: /podkrkono/i },
      { start: "2026-08-08", name: "LEADER FOX Karlovy Vary", place: "Karlovy Vary", website: "https://www.iprimacup.cz/26-kv/" },
      { start: "2026-08-22", name: "BAIC Valtice", place: "Valtice", website: "https://www.iprimacup.cz/26-va/" },
      { start: "2026-09-05", name: "Českopetrovická koolna", place: "České Petrovice", website: "https://www.iprimacup.cz/26-ck/", adopt: /koolna/i },
      { start: "2026-09-28", name: "YATE Gočárovy schody", place: "Hradec Králové", website: "https://www.iprimacup.cz/26-gs/" },
    ],
    foreign: [
      { test: /vyhlášení|vyhlaseni/i, seriesSlug: null, hide: true },
      { test: /šumavsk|sumavsk/i, seriesSlug: null },
    ],
  },
  {
    slug: "kolo-pro-zivot",
    name: "Kolo pro život",
    duplicates: [],
    sourceUrl: "https://www.kolopro.cz/zavody",
    officialHost: /kolopro\.cz/i,
    rounds: [
      { start: "2026-04-25", name: "Bikemaraton Beroun", place: "Beroun", website: "https://www.kolopro.cz/zavody/bikemaraton-beroun/" },
      { start: "2026-05-09", name: "Oderská mlýnice", place: "Odry", website: "https://www.kolopro.cz/zavody/oderska-mlynice/" },
      { start: "2026-05-16", name: "Mladá Boleslav Tour", place: "Mladá Boleslav", website: "https://www.kolopro.cz/zavody/mlada-boleslav-tour/" },
      { start: "2026-06-07", name: "Soumar Trophy Prachatice", place: "Prachatice", website: "https://www.kolopro.cz/zavody/soumar-trophy-prachatice/" },
      { start: "2026-06-27", name: "Bikemaraton Drásal", place: "Holešov", website: "https://www.kolopro.cz/zavody/bikemaraton-drasal-27-06/" },
      { start: "2026-08-15", name: "Manitou Železné hory", place: "Třemošnice", website: "https://www.kolopro.cz/zavody/manitou-zelezne-hory/" },
      { start: "2026-09-05", end: "2026-09-06", name: "Znojmo Burčák Tour", place: "Znojmo", website: "https://www.kolopro.cz/zavody/znojmo-burcak-tour-5-6-9/" },
      { start: "2026-09-26", name: "Ralsko MTB Tour", place: "Ralsko", website: "https://www.kolopro.cz/zavody/ralsko-mtb-tour-26-9/" },
    ],
    // Partner events are listed beside the series, not in it.
    foreign: [
      { test: /malevil|fanatik|salzkammergut|lawi tour/i, seriesSlug: null },
    ],
    // Nav links scraped off race pages: every one dated the first of May.
    junk: (e) => e.start_date === "2026-05-01",
  },
  {
    slug: "detsky-mtb-cup",
    name: "Dětský MTB Cup",
    duplicates: [],
    sourceUrl: "https://www.detskymtbcup.cz/",
    officialHost: /detskymtbcup\.cz/i,
    rounds: [
      { start: "2026-04-26", name: "Dětský MTB Cup — Sobotka", place: "Sobotka" },
      { start: "2026-05-01", name: "Dětský MTB Cup — Turnov Rohozec", place: "Turnov" },
      { start: "2026-05-03", name: "Dětský MTB Cup — Turnov Struhy", place: "Turnov" },
      { start: "2026-06-14", name: "Dětský MTB Cup — Bedřichov", place: "Bedřichov" },
      { start: "2026-06-27", name: "Dětský MTB Cup — Tanvald", place: "Tanvald" },
      { start: "2026-09-13", name: "Dětský MTB Cup — Vratislavice nad Nisou", place: "Vratislavice nad Nisou" },
      { start: "2026-09-20", name: "Dětský MTB Cup — Liberec", place: "Liberec" },
      { start: "2026-09-27", name: "Dětský MTB Cup — Nové Město pod Smrkem", place: "Nové Město pod Smrkem" },
    ],
  },
  {
    slug: "prazsky-mtb-pohar",
    name: "Pražský MTB pohár",
    duplicates: ["prazsky-pohar-mtb"],
    sourceUrl: "https://prahamtb.cz/",
    officialHost: /prahamtb\.cz/i,
    rounds: [
      { start: "2026-04-11", name: "Pražský MTB pohár — 1. kolo Motol XCC", place: "Praha" },
      { start: "2026-04-12", name: "Pražský MTB pohár — 2. kolo Motol XCO", place: "Praha" },
      { start: "2026-05-16", name: "Pražský MTB pohár — 3. kolo Letňany", place: "Praha" },
      { start: "2026-05-17", name: "Pražský MTB pohár — 4. kolo Kbely", place: "Praha" },
    ],
    foreign: [{ test: /slavnostní|vyhlášení/i, seriesSlug: null, hide: true }],
  },
];

/** Empty series rows that only duplicate a populated one. */
const EMPTY_DUPLICATE_SERIES = [
  "cyklo-x",
  "gravel",
  "silnice",
  "silnice-ml-z",
  "prima-cup-xcm",
  "autovinkler-jihocesky-mtb-pohar",
];

repairSeriesPlans(PLANS, {
  dry: process.argv.includes("--dry"),
  updatedBy: "major series repair 2026-09-17",
  emptyDuplicateSeries: EMPTY_DUPLICATE_SERIES,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

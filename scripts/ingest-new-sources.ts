/**
 * One-off ingest for newly watched official calendars.
 * Usage: nvm use 22 && npx tsx scripts/ingest-new-sources.ts
 *        nvm use 22 && npx tsx scripts/ingest-new-sources.ts velky-haj
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { watchOne } from "../src/lib/watcher/run";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const val = m[2]!.replace(/^["']|["']$/g, "");
      if (!process.env[m[1]!]) process.env[m[1]!] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const TARGETS: { url: string; kind: string }[] = [
  { url: "https://www.rookiescup.bike/en/race-calendar", kind: "series" },
  { url: "https://www.ixsdownhillcup.com/en/race-calendar", kind: "series" },
  { url: "https://www.iprimacup.cz/zavody-2026/", kind: "series" },
  { url: "https://www.kolopro.cz/zavody/", kind: "series" },
  { url: "https://maraton.cz/terminovka", kind: "aggregator" },
  { url: "https://www.poharmtb.cz/cross-country", kind: "series" },
  { url: "https://zapadoceskaamaterskaliga.cz/", kind: "series" },
  { url: "https://zapadoceskaamaterskaliga.cz/kalendare/zal-2026", kind: "series" },
  { url: "https://prahamtb.cz/?page_id=12", kind: "series" },
  { url: "https://www.enduroserie.cz/zavody/", kind: "series" },
  { url: "https://www.jihoceskymtbpohar.cz/", kind: "series" },
  { url: "https://www.cyclingaustria.at/kalender?sparten=mtb&view=events", kind: "federation" },
  {
    url: "https://cyclingaustria.at/images/Cup/26%20Cup%20Ausschreibungen/MTB%20Austria%20Youngsters%20Cup%202026.pdf",
    kind: "series",
  },
  { url: "http://www.youngsters-cup.at/", kind: "series" },
  { url: "http://www.youngsters-cup.at/termine_2026-pid444", kind: "series" },
  { url: "http://www.mtb-liga.at/", kind: "series" },
  { url: "http://www.mtb-liga.at/termine_2026-pid443", kind: "series" },
  { url: "http://www.sportklasse-cup.at/", kind: "series" },
  { url: "http://www.sportklasse-cup.at/termine_2026-pid439", kind: "series" },
  { url: "http://www.downhill-cup.at/", kind: "series" },
  { url: "https://www.lines-mag.at/austrian-gravity-series/", kind: "series" },
  {
    url: "https://cyclingaustria.at/images/Cup/26%20Cup%20Ausschreibungen/MTB%20Austrian%20Gravity%20Series%202026.pdf",
    kind: "series",
  },
  { url: "https://www.ucimtbworldseries.com/calendar", kind: "series" },
  {
    url: "https://www.swiss-cycling.ch/de/veranstaltungen/kalender/?discipline=mtb&save=true",
    kind: "federation",
  },
  { url: "https://www.cyklokros.cz/kalendar", kind: "aggregator" },
  { url: "https://www.cyklokros.cz/janev-cup-2026", kind: "series" },
  { url: "https://www.detskymtbcup.cz/", kind: "series" },
  { url: "https://skvelopraha.cz/velky-haj/", kind: "series" },
  { url: "http://vangillerncup.cz", kind: "race" },
  { url: "https://jesenickysnek.cz/", kind: "series" },
  { url: "https://sumator.cz/cup/jesenicky-snek-2026", kind: "calendar" },
  { url: "https://ppkbike.cz/", kind: "series" },
  { url: "https://ppkbike.cz/ppk-races.js", kind: "series" },
  { url: "https://www.cyklistikaszc.sk/sk/mtb-cross-country/kalendar", kind: "federation" },
  { url: "https://albgold-juniorscup.de/", kind: "series" },
  { url: "https://cup.cube.eu/", kind: "series" },
  { url: "https://rookiescup-ostbayern.de/rennen/", kind: "series" },
  { url: "https://xco-bikecup.de/", kind: "series" },
  { url: "https://schwarzwaelder-mtb-cup.de/", kind: "series" },
  { url: "https://rhein-eifel-mtb-cup.de/", kind: "series" },
  { url: "https://mtb-oberschwaben-cup.de/", kind: "series" },
  { url: "https://mtbsaarlandliga.de/rennen/", kind: "series" },
  { url: "https://www.juniorbikecup.at/termine/", kind: "series" },
  { url: "https://on-offteam.cz/on-off-mtb-pohar-2026/", kind: "series" },
  { url: "https://polandbike.pl/kalendarz-wydarzen/", kind: "series" },
  { url: "https://polandbike.pl/junior-race/", kind: "series" },
  { url: "https://www.mtb-bundesliga.net/rennen/", kind: "series" },
  {
    url: "https://www.mtb-bundesliga.net/nachwuchs-bl/veranstaltungen.html",
    kind: "series",
  },
  { url: "https://tourofaustria.com/", kind: "race" },
  { url: "https://www.salzkammergut-trophy.at/", kind: "series" },
  { url: "https://www.pekloseveru.cz/cz/registrace/", kind: "series" },
  {
    url: "https://www.pekloseveru.cz/cz/rocnik-2026/propozice-serialu/",
    kind: "series",
  },
  { url: "https://www.ustimtbcup.cz/", kind: "series" },
  { url: "https://jcp-mtb.cz/", kind: "series" },
  { url: "https://www.bayerwald-mtb-cup.com/", kind: "series" },
  { url: "https://mtb.skiclub-bb.com/werdenfelscup.html", kind: "series" },
  { url: "https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2026", kind: "race" },
  { url: "https://www.mtb-rhein-main-cup.de/", kind: "series" },
  { url: "https://mtb-kidscup.de/start/termine-2/", kind: "series" },
  { url: "https://www.mountainbike-challenge.at/", kind: "series" },
  { url: "https://www.soof.sk/podujatia-a-akcie", kind: "aggregator" },
  { url: "https://www.mpdv-cup.de/", kind: "series" },
  { url: "https://schulsportverein.de/stadtmeisterschaft/", kind: "series" },
  { url: "https://globmetalxc.pl/", kind: "race" },
  { url: "https://my.raceresult.com/events/", kind: "aggregator" },
  { url: "https://kalendar.sportsoft.cz/", kind: "aggregator" },
  { url: "https://kamptaltrophy.at/", kind: "race" },
  { url: "https://kamptaltrophy.at/de/ergebnisse", kind: "race" },
  { url: "https://www.datasport.de/anmeldeservice/mtbwildpoldsried2026", kind: "race" },
  { url: "https://www.swissbikecup.ch/", kind: "series" },
  { url: "https://mtb-cup.ch/en/race", kind: "series" },
  { url: "https://valais-cycling.ch/de/kids-bike-cup-valais-wallis/", kind: "series" },
  { url: "https://www.eigerbike.ch/de/kids-race/informationen/", kind: "series" },
  { url: "https://www.bikekingdom.ch/en/Events/Kids-Cup", kind: "series" },
  { url: "https://www.bikeclub-engelberg.ch/wp/valiant-gp/", kind: "series" },
  { url: "https://www.brvinfo.ch/bundicycling-kidscup/", kind: "series" },
  { url: "https://www.xco-nrw-cup.de/", kind: "series" },
  {
    url: "https://www.schwarzwald-bike-marathon.de/rennen-strecken/rena-kids-cup/",
    kind: "series",
  },
  { url: "https://www.albstadt-bike-marathon.de/", kind: "series" },
  { url: "https://rsv-bad-griesbach.de/", kind: "series" },
  { url: "https://bahno.ambike.com/", kind: "series" },
  {
    url: "https://bike-revolution.ch/en/about/news/anmeldung-2026/",
    kind: "series",
  },
  { url: "https://www.bikeside.ch/kategorien", kind: "series" },
  { url: "https://mtbraceseries.ch/egg/", kind: "race" },
  {
    url: "https://fmciclismo.com/es/smartweb/seccion/seccion/madrid/ESCUELAS/Clasificaciones-BTT-Escuelas",
    kind: "series",
  },
  { url: "https://my.raceresult.com/377510/info", kind: "race" },
  { url: "https://www.marathon-man.eu/", kind: "series" },
  { url: "https://www.authorkralsumavy.cz/", kind: "race" },
  { url: "https://www.malevilcup.cz/", kind: "race" },
  { url: "https://www.horal.sk/", kind: "race" },
  { url: "https://www.bike-marathon.com/de", kind: "race" },
  { url: "https://grand-raid-bcvs.ch/", kind: "race" },
  { url: "https://raidevolenard-fmv.ch/", kind: "race" },
  { url: "https://www.eigerbike.ch/en/race/informations/", kind: "race" },
  { url: "https://mtbpomerania.pl/", kind: "series" },
  { url: "https://silesia.bike/", kind: "series" },
  { url: "https://www.herodolomites.com/", kind: "race" },
  { url: "https://www.troitrek.it/", kind: "race" },
  { url: "https://www.sloenduro.com/2026-sloenduro-calendar/?lang=en", kind: "series" },
  { url: "https://www.sloxcup.com/dirke-2026/", kind: "series" },
  { url: "https://www.sloveniadownhillcup.si/en/races-2026/", kind: "series" },
  {
    url: "https://www.federciclismo.it/fuoristrada/mtb-xco-xcm-dh-4x-ed/circuiti-mtb/italia-bike-cup/",
    kind: "series",
  },
  {
    url: "https://www.federciclismo.it/fuoristrada/mtb-xco-xcm-dh-4x-ed/circuiti-mtb/coppa-italia-giovanile/",
    kind: "series",
  },
  {
    url: "https://www.ciclisme.cat/campionat/btt/copa-catalana-internacional-btt-2",
    kind: "series",
  },
  { url: "https://www.ciclisme.cat/campionat/btt/copa-catalunya-btt-2", kind: "series" },
  {
    url: "https://esmtb.com/calendario-de-las-copas-de-espana-de-xcm-enduro-y-descenso-2026/",
    kind: "series",
  },
  {
    url: "https://www.belgiancycling.be/disciplines/mtb/competities-m/mtb-3-nations-cup/kalender/",
    kind: "series",
  },
  { url: "https://cycling.vlaanderen/competitie/mtb/xco-series", kind: "series" },
  { url: "https://cycling.vlaanderen/competitie/mtb/kids-series", kind: "series" },
  {
    url: "https://www.mtbcompetitieoostnederland.nl/3503/0/agenda-mbt-cup",
    kind: "series",
  },
  { url: "https://www.knwu.nl/kampioenschappen/nk-mountainbike", kind: "race" },
  {
    url: "https://www.knwu.nl/nieuws/klaar-voor-mtb-streetrace-competitie-2026",
    kind: "series",
  },
  { url: "https://www.mb-race.com/", kind: "race" },
  { url: "https://www.transmaurienne-vanoise.com/", kind: "race" },
  { url: "https://www.rocazur.com/", kind: "race" },
  { url: "https://ryebikefestival.no/", kind: "race" },
  { url: "https://www.crosskovacsi.hu/", kind: "race" },
  { url: "https://www.hbs.hr/kalendar/mtb/", kind: "federation" },
  { url: "https://www.hbs.hr/kalendar/", kind: "federation" },
  { url: "https://www.hbs.hr/kalendar/page/2/", kind: "federation" },
  { url: "https://www.hbs.hr/kalendar/page/3/", kind: "federation" },
  {
    url: "https://pyoraily.fi/tapahtumat-ja-kilpailut/kultainen-kampi-cup/",
    kind: "series",
  },
  { url: "https://www.alpen-tour.at/", kind: "race" },
  { url: "https://riojabikeexperience.com/", kind: "race" },
  { url: "https://www.superprestigecyclocross.be/nl/kalender", kind: "series" },
  { url: "https://www.ucicyclocrossworldcup.com/en/calendar", kind: "series" },
  { url: "https://uec.ch/en/calendar", kind: "federation" },
  { url: "https://uec.ch/en/calendar?page=2", kind: "federation" },
  { url: "https://uec.ch/en/calendar?page=3", kind: "federation" },
  { url: "https://www.letour.fr/en", kind: "race" },
  { url: "https://www.paris-roubaix.fr/en", kind: "race" },
  { url: "https://www.ffc.fr/agenda/", kind: "federation" },
  { url: "https://www.ffc.fr/calendrier/", kind: "federation" },
  { url: "https://www.ffvelo.fr/agenda", kind: "federation" },
  { url: "https://www.rocazur.com/", kind: "race" },
  { url: "https://www.transmaurienne-vanoise.com/", kind: "race" },
  { url: "https://www.mb-race.com/", kind: "race" },
  { url: "https://www.grandraidreunion.com/", kind: "race" },
  { url: "https://www.raid-transvosgienne.com/", kind: "race" },
  { url: "https://www.alpes-granfondo.com/", kind: "race" },
  { url: "https://www.ucimtbworldseries.com/calendar", kind: "series" },
  { url: "https://www.oesterreich-rundfahrt.at/", kind: "race" },
  { url: "https://www.tourdesuisse.ch/en/", kind: "race" },
  { url: "https://www.quebrantahuesos.com/", kind: "race" },
  { url: "https://www.lapuritoandorra.com/", kind: "race" },
  { url: "https://www.kotl.at/", kind: "race" },
  { url: "https://www.faustocoppi.net/", kind: "race" },
  { url: "https://haervejsloebet.dk/", kind: "race" },
  { url: "https://detskatour.sk/", kind: "series" },
  { url: "https://www.czechtour.com/", kind: "race" },
  { url: "https://www.letapeczech.cz/", kind: "race" },
  { url: "https://houffagravel.be/nl/", kind: "race" },
  { url: "https://alsovka.cz/wh/", kind: "race" },
  { url: "https://velkacenaklatov.cz/", kind: "race" },
  { url: "https://www.rad-bundesliga.net/männer/termine.html", kind: "series" },
  { url: "https://www.rad-bundesliga.net/junioren/termine.html", kind: "series" },
  { url: "https://www.rad-bundesliga.net/juniorinnen/termine.html", kind: "series" },
  { url: "https://www.rad-bundesliga.net/frauen/termine2.html", kind: "series" },
  { url: "https://www.cyklistikaszc.sk/sk/cestna-cyklistika/kalendar", kind: "federation" },
  { url: "https://www.cyklistikaszc.sk/sk/cyklokros/kalendar", kind: "federation" },
  { url: "https://www.cyklistikaszc.sk/sk/bmx-racing/kalendar", kind: "federation" },
  { url: "https://www.cyklistikaszc.sk/sk/bmx-freestyle/kalendar", kind: "federation" },
  { url: "https://www.cyklistikaszc.sk/sk/mtb-downhill-fourcross/kalendar", kind: "federation" },
  { url: "https://www.cyklistikaszc.sk/sk/cyklotrial/kalendar", kind: "federation" },
  { url: "https://www.cyklistikaszc.sk/sk/drahova-cyklistika/kalendar", kind: "federation" },
  { url: "https://pucharmtb.pl/kalendarz-2026/", kind: "series" },
  {
    url: "https://www.cyclingaustria.at/kalender?sparten=strasse&view=events",
    kind: "federation",
  },
  {
    url: "https://www.cyclingaustria.at/kalender?sparten=cyclocross&view=events",
    kind: "federation",
  },
  {
    url: "https://cyclingaustria.at/news/allgemein/cycling-austria-cups-2026",
    kind: "series",
  },
  { url: "https://www.czechcyclingfederation.com/events/mnd-cup/", kind: "series" },
  { url: "https://www.czechcyclingfederation.com/en/events/skoda-cup/", kind: "series" },
  { url: "https://www.czechcyclingfederation.com/en/events/cesky-pohar-bmx/", kind: "series" },
  { url: "https://zavodmiru.com/", kind: "race" },
  { url: "https://www.deutschland-tour.com/", kind: "race" },
  {
    url: "https://static.rad-net.de/html/bdr/generalausschreibungen/2026/ga-bl-cyclo-cross_26-27.pdf",
    kind: "series",
  },
  { url: "https://bratislavskymtbmaraton.biker.sk/preteky/maraton", kind: "race" },
  { url: "https://bratislavskymtbmaraton.biker.sk/preteky/detske-preteky-2026", kind: "race" },
];

async function main() {
  const supabase = createServerSupabase();
  const filter = process.argv[2]?.toLowerCase();
  const list = filter
    ? TARGETS.filter((t) => t.url.toLowerCase().includes(filter))
    : TARGETS;
  if (!list.length) {
    console.error("no targets match", filter);
    process.exit(1);
  }
  for (const t of list) {
    let { data: row, error } = await supabase
      .from("watched_urls")
      .select("*")
      .eq("url", t.url)
      .maybeSingle();
    if (!row) {
      const inserted = await supabase
        .from("watched_urls")
        .insert({
          url: t.url,
          kind: t.kind,
          status: "active",
          added_by: "admin",
          notes: t.url.includes("velky-haj")
            ? "O Pohár MČ Praha 4 — off-season watch for next year"
            : t.url.includes("gillern")
              ? "Kamenice family MTB — adults + kids"
                : t.url.includes("jesenicky")
                ? "Jesenický šnek — Jeseníky XC + šneček"
                : t.url.includes("jcp-mtb")
                  ? "Šumavský pohár MTB — South Bohemia XC + Waldkirchen"
                  : t.url.includes("janev-cup")
                    ? "JANEV Cup 2026 — Czech UCI cyclocross"
                    : t.url.includes("mtb-bundesliga.net/nachwuchs")
                      ? "German MTB Nachwuchsbundesliga U15/U17"
                    : t.url.includes("mtb-bundesliga.net")
                      ? "German MTB XCO Bundesliga elite/U19"
                    : t.url.includes("junior-race")
                      ? "PKO Junior Race — Poland Bike kids series"
                    : t.url.includes("kamptaltrophy")
                      ? "KTM Kamptal Trophy — official UCI C1 + Saturday youngsters, results hub"
                    : t.url.includes("kalendar.sportsoft")
                      ? "SportSoft timing calendar — CZ/SK cycling only"
                    : t.url.includes("rad-bundesliga.net")
                      ? "German road Rad-Bundesliga — Männer / Junioren / Juniorinnen / Frauen"
                    : t.url.includes("cestna-cyklistika")
                      ? "SZC road calendar — SP CC, Okolo Slovenska, V4"
                    : t.url.includes("cyklokros/kalendar")
                      ? "SZC cyclocross calendar — NoLimited CX cup"
                    : t.url.includes("bmx-racing")
                      ? "SZC BMX Racing cup"
                    : t.url.includes("bmx-freestyle")
                      ? "SZC BMX Freestyle cup"
                    : t.url.includes("mtb-downhill-fourcross")
                      ? "SZC downhill + enduro cups — SPDH / SPEN"
                    : t.url.includes("cyklotrial")
                      ? "SZC trial cup"
                    : t.url.includes("drahova-cyklistika")
                      ? "SZC track cup"
                    : t.url.includes("pucharmtb.pl")
                      ? "Puchar Polski MTB XCO"
                    : t.url.includes("cycling-austria-cups")
                      ? "Cycling Austria 2026 cups — Road League + Junior Series + BMX Racing League"
                    : t.url.includes("sparten=strasse")
                      ? "Cycling Austria road calendar — Road League + Junior Series"
                    : t.url.includes("sparten=cyclocross")
                      ? "Cycling Austria cyclocross calendar"
                    : t.url.includes("events/mnd-cup")
                      ? "ČSC MND CUP road youth"
                    : t.url.includes("events/skoda-cup")
                      ? "ČSC ŠKODA CUP road elite"
                    : t.url.includes("cesky-pohar-bmx")
                      ? "ČSC Český pohár BMX Racing"
                    : t.url.includes("ga-bl-cyclo-cross")
                      ? "German Cyclo-Cross Bundesliga 2026/27"
                    : t.url.includes("zavodmiru")
                      ? "Závod míru — official Peace Race"
                    : t.url.includes("deutschland-tour")
                      ? "Lidl Deutschland Tour"
                    : t.url.includes("raceresult.com/events")
                      ? "RaceResult cycling listing — CZ/DE/SK/AT/PL"
                    : t.url.includes("sportklasse-cup")
                      ? "Sportklasse / Amateur Cup Austria — adult XCO, keep separate from AYC + MLA"
                      : t.url.includes("downhill-cup") || t.url.includes("austrian-gravity")
                        ? "auner Austrian Gravity Series / Downhill Cup — DH U13–Elite"
                      : t.url.includes("bratislavskymtbmaraton")
                        ? "GARMIN Bratislavský MTB maratón — adult XCM + kids loop, keep pins separate"
                      : null,
          next_poll_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      row = inserted.data;
      error = inserted.error;
    }
    if (error || !row) {
      console.log("missing", t.url, error?.message);
      continue;
    }
    console.log("watching", t.url, "…");
    const started = Date.now();
    const out = await watchOne({
      id: row.id,
      url: row.url,
      etag: null, // force extract
      last_modified: null,
      content_hash: null,
      kind: row.kind,
      last_extract_status: row.last_extract_status,
    });
    console.log({
      url: out.url,
      ok: out.ok,
      events: out.eventsUpserted,
      strategy: out.strategy,
      error: out.error,
      preview: out.preview?.map((e) => `${e.startDate} ${e.name}`),
      ms: Date.now() - started,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

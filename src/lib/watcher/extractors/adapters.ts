import type { ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { parseCscCalendar } from "@/lib/watcher/extractors/csc";
import { isSumatorHost, parseSumator } from "@/lib/watcher/extractors/sumator";
import { parseMtbs } from "@/lib/watcher/extractors/mtbs";
import { parseHynekMusil } from "@/lib/watcher/extractors/hynek";
import { parseFederciclismo } from "@/lib/watcher/extractors/federciclismo";
import { parseVelokal } from "@/lib/watcher/extractors/velokal";
import { parseRadsportEvents } from "@/lib/watcher/extractors/radsport";
import { parseEventiv } from "@/lib/watcher/extractors/eventiv";
import { parseRaceresultEvents } from "@/lib/watcher/extractors/raceresult";
import { isRacementHost, parseRacement } from "@/lib/watcher/extractors/racement";
import {
  isHynekSeriesCalendarHost,
  parseHynekSeriesCalendar,
} from "@/lib/watcher/extractors/hynek-series";
import { parseCubeCup } from "@/lib/watcher/extractors/cubecup";
import { parseTbcSerie } from "@/lib/watcher/extractors/tbcserie";
import {
  parseAlbGoldJuniors,
  parseAllgaeuKidsCup,
  parseBayerwaldCup,
  parseDetskaTour,
  parseDetskaTourPropozicie,
  parseAustriaKidsXc2026,
  parseYoungstersCup,
  parseMtbLiga,
  parseSportklasseCup,
  parseAustrianGravitySeries,
  parseDownhillCup,
  parseGermanCxBundesliga,
  parseEldoradoKidsCup,
  parseGlobmetalXc,
  parseJuniorBikeCup,
  parseKtmJuniorChallenge,
  parseMpdvCup,
  parseOberschwabenCup,
  parseOnOffMtb,
  parsePodkrkonosskyMaraton,
  parsePolandBike,
  parseRheinEifelCup,
  parseRheinMainCup,
  parseRookiesOstbayern,
  parseSaarlandliga,
  parseSalzkammergutTrophy,
  parseSchwarzwalderCup,
  parseSumavskyPohar,
  enrichSumavskyPohar,
  parseSoofSk,
  parseSzcMtb,
  parseWerdenfelserCup,
  parseWiesbadenStadtmeisterschaft,
  parseXcoBikecup,
  parseZanzenbergOem,
  enrichDeAtRacePages,
} from "@/lib/watcher/extractors/kids-mtb-cups";
import {
  parseCyklokros,
  parseDetskyMtbCup,
  enrichDetskyMtbCup,
  parseEnduroSerie,
  enrichEnduroSerie,
  parseEnduroSportsoft,
  parseMaratonTerminovka,
  parsePoharMtb,
  parsePekloSeveru,
  parsePpkBike,
  parsePrahaMtb,
  parsePrimaCup,
  parseVelkyHaj,
  parseVanGillern,
  parseKonarovickyKoren,
  parseJesenickySnek,
  parseZal,
  parseUstiMtbCup,
} from "@/lib/watcher/extractors/cz-calendars";
import { parseCyclingAustria } from "@/lib/watcher/extractors/cyclingaustria";
import { parseUciMtbWorldSeries } from "@/lib/watcher/extractors/uciws";
import { parseSwissCycling } from "@/lib/watcher/extractors/swisscycling";
import {
  parseBikeKingdomKidsCup,
  parseBundiKidsCup,
  parseEigerKidsRace,
  parseSwissBikeCup,
  parseValaisKidsCup,
  parseValiantGp,
  parseVittoriaCup,
} from "@/lib/watcher/extractors/swiss-kids";
import {
  parseAlbstadtKidsCup,
  parseBahno,
  parseBikeRevolutionKids,
  parseBikeSideKids,
  parseCopaMadridKids,
  parseLillelundsCup,
  parseMtbRaceSeriesEgg,
  parseRenaKidsCup,
  parseStoakartMoasta,
  parseXcoNrw,
} from "@/lib/watcher/extractors/more-kids";
import {
  parseAlpentour,
  parseCrosskovacsi,
  parseEigerAdult,
  parseGrandRaid,
  parseHeroDolomites,
  parseHoral,
  parseKralSumavy,
  parseMalevilCup,
  parseMarathonMan,
  parseMbRace,
  parseMtbPomerania,
  parseNationalparkBike,
  parseRaidEvolenard,
  parseRiojaBike,
  parseRocAzur,
  parseRyeBikeFestival,
  parseSilesiaBike,
  parseSloEnduro,
  parseTransmaurienne,
  parseTroiTrek,
} from "@/lib/watcher/extractors/adult-mtb";
import {
  parseSloXcup,
  parseSloveniaDhCup,
} from "@/lib/watcher/extractors/slo-kids";
import {
  parse3NationsCup,
  parseNkMtb,
  parseOostNederland,
  parseStreetrace,
  parseVlaanderenKids,
  parseVlaanderenXco,
} from "@/lib/watcher/extractors/nl-be-dk";
import {
  parseCopaCatalanaInternacional,
  parseCopaCatalunyaBtt,
  parseCopasEspana,
  parseCoppaItaliaGiovanile,
  parseItaliaBikeCup,
} from "@/lib/watcher/extractors/it-es-fr";
import { parseHbsCalendar, parseHbsMtb, parseKultainenKampi } from "@/lib/watcher/extractors/hr-fi";
import {
  parseAlsovkaWh,
  parseCzechTour,
  parseFaustoCoppi,
  parseGravelChallengeDk,
  parseHaervejsloebet,
  parseHouffaGravel,
  parseKingOfTheLake,
  parseKlatovyXco,
  parseLetapeCzech,
  parseParisRoubaix,
  parsePuritoAndorra,
  parseQuebrantahuesos,
  parseSuperprestige,
  parseTourDeFrance,
  parseTourDeSuisse,
  parseTourOfAustria,
  parseUciCxWorldCup,
  parseUecCalendar,
} from "@/lib/watcher/extractors/road-cx-gravel";
import * as cheerio from "cheerio";

type AdapterResult = { events: ParsedEvent[]; strategy: string };

export async function extractWithAdapter(
  host: string,
  url: string,
  html: string,
): Promise<AdapterResult | null> {
  // Club hub + trainings — not an official race calendar.
  if (host.includes("jiskra.potocky.cz")) {
    return { events: [], strategy: "adapter:jiskra-skip" };
  }
  if (host.includes("juniorcup.net")) {
    return { events: parseJuniorCup(url, html), strategy: "adapter:juniorcup" };
  }
  if (isSumatorHost(host)) {
    return { events: await parseSumator(url, html), strategy: "adapter:sumator" };
  }
  if (host.includes("kolopro.cz")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/zavody") {
        return { events: [], strategy: "adapter:kolopro-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:kolopro-skip" };
    }
    return { events: parseKolopro(url, html), strategy: "adapter:kolopro" };
  }
  if (host.includes("portal.czechcyclingfederation.com")) {
    return { events: await parseCscCalendar(url, html), strategy: "adapter:csc" };
  }
  if (host.includes("czechcyclingfederation.com")) {
    // Marketing WP site — calendar there is a 2021 snapshot, not the live IS.
    return { events: [], strategy: "adapter:csc-skip-marketing" };
  }
  if (host.includes("ceskysvazcyklistiky.cz")) {
    return { events: await parseCscCalendar(url, html), strategy: "adapter:csc" };
  }
  if (host.includes("mtbs.cz")) {
    return { events: await parseMtbs(url, html), strategy: "adapter:mtbs" };
  }
  if (host.includes("hynekmusil.cz")) {
    const events = parseHynekMusil(url, html);
    const { discoverHynekSeriesUrls } = await import("@/lib/watcher/extractors/hynek");
    const seriesUrls = discoverHynekSeriesUrls(html);
    if (seriesUrls.length && events[0]) {
      events[0] = {
        ...events[0],
        childUrls: [...new Set([...(events[0].childUrls ?? []), ...seriesUrls])],
      };
    }
    return { events, strategy: "adapter:hynek" };
  }
  if (host.includes("members.federciclismo.it")) {
    // List calendar only — detail/ical pages are single-race and covered by the list crawl
    if (/\/race\/detail\//i.test(url) || /\/race\/icald\//i.test(url)) {
      return { events: [], strategy: "adapter:fci-skip-detail" };
    }
    return { events: await parseFederciclismo(url, html), strategy: "adapter:fci" };
  }
  if (host.includes("federciclismo.it")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (/\/circuiti-mtb\/italia-bike-cup$/i.test(path)) {
        return { events: parseItaliaBikeCup(url, html), strategy: "adapter:ibc" };
      }
      if (/\/circuiti-mtb\/coppa-italia-giovanile$/i.test(path)) {
        return { events: parseCoppaItaliaGiovanile(url, html), strategy: "adapter:cig-mtb" };
      }
    } catch {
      return { events: [], strategy: "adapter:fci-www-skip" };
    }
    return { events: [], strategy: "adapter:fci-www-skip" };
  }
  if (host.includes("ciclisme.cat")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (/\/campionat\/btt\/copa-catalana-internacional-btt/i.test(path)) {
        return { events: parseCopaCatalanaInternacional(url, html), strategy: "adapter:copa-cat-int" };
      }
      if (/\/campionat\/btt\/copa-catalunya-btt/i.test(path)) {
        return { events: parseCopaCatalunyaBtt(url, html), strategy: "adapter:copa-cat-btt" };
      }
    } catch {
      return { events: [], strategy: "adapter:ciclisme-skip" };
    }
    return { events: [], strategy: "adapter:ciclisme-skip" };
  }
  if (host.includes("esmtb.com")) {
    if (!/calendario-de-las-copas-de-espana/i.test(url)) {
      return { events: [], strategy: "adapter:esmtb-skip" };
    }
    return { events: parseCopasEspana(url, html), strategy: "adapter:copas-espana" };
  }
  if (host.includes("velokal.de")) {
    return { events: parseVelokal(url, html), strategy: "adapter:velokal" };
  }
  if (host.includes("radsport-events.de")) {
    return { events: await parseRadsportEvents(url, html), strategy: "adapter:radsport" };
  }
  if (host.includes("eventivsport.com")) {
    return { events: await parseEventiv(url, html), strategy: "adapter:eventiv" };
  }
  if (isRacementHost(host)) {
    return {
      events: await enrichDeAtRacePages(parseRacement(url, html)),
      strategy: "adapter:racement",
    };
  }
  if (host.includes("ppkbike.cz") || host.includes("ppk-hk.cz")) {
    return { events: await parsePpkBike(url, html), strategy: "adapter:ppkbike" };
  }
  if (isHynekSeriesCalendarHost(host)) {
    // Prefer /zavody calendar pages; homepage news alone is noisy
    const events = parseHynekSeriesCalendar(url, html);
    if (events.length || /designindex=data\/zavody\.php/i.test(url)) {
      return { events, strategy: "adapter:hynek-series" };
    }
  }
  if (host.includes("cup.cube.eu")) {
    if (/rennen-detail/i.test(url)) {
      return { events: [], strategy: "adapter:cubecup-skip" };
    }
    return {
      events: await enrichDeAtRacePages(parseCubeCup(url, html)),
      strategy: "adapter:cubecup",
    };
  }
  if (host.includes("tbcserie.cz")) {
    return { events: await parseTbcSerie(url, html), strategy: "adapter:tbcserie" };
  }
  if (host.includes("iprimacup.cz")) {
    if (!/\/zavody-20\d{2}/i.test(url)) {
      return { events: [], strategy: "adapter:prima-skip-detail" };
    }
    return { events: await parsePrimaCup(url, html), strategy: "adapter:prima" };
  }
  if (host.includes("maraton.cz")) {
    if (!/terminovka/i.test(url)) {
      return { events: [], strategy: "adapter:maraton-skip" };
    }
    return { events: parseMaratonTerminovka(url, html), strategy: "adapter:maraton" };
  }
  if (host.includes("poharmtb.cz")) {
    return { events: parsePoharMtb(url, html), strategy: "adapter:poharmtb" };
  }
  if (host.includes("zapadoceskaamaterskaliga.cz")) {
    return { events: parseZal(url, html), strategy: "adapter:zal" };
  }
  if (host.includes("prahamtb.cz")) {
    return { events: parsePrahaMtb(url, html), strategy: "adapter:prahamtb" };
  }
  if (host.includes("enduroserie.cz")) {
    return {
      events: await enrichEnduroSerie(parseEnduroSerie(url, html)),
      strategy: "adapter:enduroserie",
    };
  }
  if (host.includes("enduro.sportsoft.cz")) {
    return { events: parseEnduroSportsoft(url, html), strategy: "adapter:enduro-sportsoft" };
  }
  if (host.includes("cyklokros.cz")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(kalendar|janev-cup(-20\d{2})?)$/i.test(path)) {
        return { events: [], strategy: "adapter:cyklokros-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:cyklokros-skip" };
    }
    return { events: parseCyklokros(url, html), strategy: "adapter:cyklokros" };
  }
  if (host.includes("detskymtbcup.cz")) {
    return {
      events: await enrichDetskyMtbCup(parseDetskyMtbCup(url, html)),
      strategy: "adapter:detsky-mtb",
    };
  }
  if (host.includes("vangillerncup.cz")) {
    if (/\/(fotky|tym|vysledky)\/?$/i.test(url)) {
      return { events: [], strategy: "adapter:van-gillern-skip" };
    }
    return { events: parseVanGillern(url, html), strategy: "adapter:van-gillern" };
  }
  if (host.includes("jesenickysnek.cz")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/" && !/^\/event\/\d+$/.test(path)) {
        return { events: [], strategy: "adapter:jesenicky-snek-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:jesenicky-snek-skip" };
    }
    return { events: parseJesenickySnek(url, html), strategy: "adapter:jesenicky-snek" };
  }
  if (host.includes("k-koren.cz")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/") {
        return { events: [], strategy: "adapter:k-koren-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:k-koren-skip" };
    }
    return { events: parseKonarovickyKoren(url, html), strategy: "adapter:k-koren" };
  }
  if (host.includes("skvelopraha.cz")) {
    if (!/\/velky-haj/i.test(url)) {
      return { events: [], strategy: "adapter:skvelo-skip" };
    }
    return { events: parseVelkyHaj(url, html), strategy: "adapter:velky-haj" };
  }
  if (host.includes("pekloseveru.cz")) {
    if (!/\/(registrace|registration|propozice-serialu|series-regulations)\/?$/i.test(url)) {
      return { events: [], strategy: "adapter:peklo-skip" };
    }
    return { events: await parsePekloSeveru(url, html), strategy: "adapter:peklo-severu" };
  }
  if (host.includes("ustimtbcup.cz")) {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/\/$/, "") || "/";
      if (path !== "/" || /page=/.test(u.search)) {
        return { events: [], strategy: "adapter:usti-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:usti-skip" };
    }
    return { events: parseUstiMtbCup(url, html), strategy: "adapter:usti-mtb" };
  }
  if (host.includes("youngsters-cup.at")) {
    if (/ergebnisse|youngsters_team|impressum|kontakt/i.test(url)) {
      return { events: [], strategy: "adapter:ayc-skip" };
    }
    return {
      events: parseYoungstersCup(url, html),
      strategy: "adapter:ayc",
    };
  }
  if (host.includes("mtb-liga.at")) {
    if (/ergebnisse|impressum|kontakt/i.test(url)) {
      return { events: [], strategy: "adapter:mla-skip" };
    }
    return {
      events: parseMtbLiga(url, html),
      strategy: "adapter:mla",
    };
  }
  if (host.includes("sportklasse-cup.at")) {
    if (/ergebnisse|impressum|kontakt/i.test(url)) {
      return { events: [], strategy: "adapter:skc-skip" };
    }
    return {
      events: parseSportklasseCup(url, html),
      strategy: "adapter:skc",
    };
  }
  if (host.includes("downhill-cup.at")) {
    if (/ergebnisse|impressum|kontakt|termine_2023/i.test(url)) {
      return { events: [], strategy: "adapter:ags-skip" };
    }
    return {
      events: parseDownhillCup(url, html),
      strategy: "adapter:ags-dhc",
    };
  }
  if (host.includes("lines-mag.at")) {
    if (!/austrian-gravity-series/i.test(url) || /2025|reglement/i.test(url)) {
      return { events: [], strategy: "adapter:ags-lines-skip" };
    }
    return {
      events: parseAustrianGravitySeries(url, html),
      strategy: "adapter:ags-lines",
    };
  }
  if (host.includes("cyclingaustria.at")) {
    let decoded = url;
    try {
      decoded = decodeURIComponent(url);
    } catch {
      /* keep raw */
    }
    if (/austria.?youngsters.?cup/i.test(decoded)) {
      return {
        events: parseAustriaKidsXc2026(url, html),
        strategy: "adapter:at-kids-xc",
      };
    }
    if (/austria.?n.?gravity.?series|auner.?gravity|austrian.?gravity/i.test(decoded)) {
      return {
        events: parseAustrianGravitySeries(url, html),
        strategy: "adapter:at-ags",
      };
    }
    if (!/kalender/i.test(url)) {
      return { events: [], strategy: "adapter:oerv-skip" };
    }
    const ca = await enrichDeAtRacePages(parseCyclingAustria(url, html));
    const kids = /cyclocross/i.test(url) ? [] : parseAustriaKidsXc2026(url, html);
    return {
      events: [...kids, ...ca],
      strategy: kids.length ? "adapter:oerv+at-kids-xc" : "adapter:oerv",
    };
  }
  if (host.includes("rad-net.de")) {
    if (!/cyclo-cross/i.test(url)) {
      return { events: [], strategy: "adapter:radnet-skip" };
    }
    return {
      events: parseGermanCxBundesliga(url, html),
      strategy: "adapter:cx-bundesliga",
    };
  }
  if (host.includes("ucimtbworldseries.com")) {
    return { events: parseUciMtbWorldSeries(url, html), strategy: "adapter:uciws" };
  }
  if (host.includes("swiss-cycling.ch")) {
    if (!/\/kalender/i.test(url)) {
      return { events: [], strategy: "adapter:swiss-skip" };
    }
    return {
      events: await enrichDeAtRacePages(parseSwissCycling(url, html)),
      strategy: "adapter:swiss-cycling",
    };
  }
  if (host.includes("swissbikecup.ch")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(en|de|fr)?$/.test(path)) return { events: [], strategy: "adapter:sbc-skip" };
    } catch {
      return { events: [], strategy: "adapter:sbc-skip" };
    }
    return { events: await parseSwissBikeCup(url, html), strategy: "adapter:swiss-bike-cup" };
  }
  if (host.includes("mtb-cup.ch")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "");
      if (!/^\/(en\/)?race$/.test(path)) {
        return { events: [], strategy: "adapter:vittoria-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:vittoria-skip" };
    }
    return { events: parseVittoriaCup(url, html), strategy: "adapter:vittoria" };
  }
  if (host.includes("mso.swiss")) {
    return { events: [], strategy: "adapter:mso-skip" };
  }
  if (host.includes("valais-cycling.ch")) {
    if (!/kids-bike-cup-valais/i.test(url)) {
      return { events: [], strategy: "adapter:valais-skip" };
    }
    return {
      events: [...parseValaisKidsCup(url, html), ...parseValiantGp(url, html)],
      strategy: "adapter:valais-kids",
    };
  }
  if (host.includes("eigerbike.ch")) {
    if (/kids-race/i.test(url)) {
      return { events: parseEigerKidsRace(url, html), strategy: "adapter:eiger-kids" };
    }
    if (/\/(en|de|fr)\/race\/informations/i.test(url)) {
      return { events: parseEigerAdult(url, html), strategy: "adapter:eiger-adult" };
    }
    return { events: [], strategy: "adapter:eiger-skip" };
  }
  if (host.includes("bikekingdom.ch")) {
    if (!/kids-cup/i.test(url)) {
      return { events: [], strategy: "adapter:kingdom-skip" };
    }
    return { events: parseBikeKingdomKidsCup(url, html), strategy: "adapter:bike-kingdom" };
  }
  if (host.includes("bikeclub-engelberg.ch")) {
    if (!/valiant-gp/i.test(url)) {
      return { events: [], strategy: "adapter:engelberg-skip" };
    }
    return { events: parseValiantGp(url, html), strategy: "adapter:valiant-gp" };
  }
  if (host.includes("brvinfo.ch")) {
    if (!/bundicycling-kidscup/i.test(url)) {
      return { events: [], strategy: "adapter:brv-skip" };
    }
    return { events: parseBundiKidsCup(url, html), strategy: "adapter:bundi-kids" };
  }
  if (host.includes("cyklistikaszc.sk")) {
    if (!/mtb-cross-country\/kalendar/i.test(url)) {
      return { events: [], strategy: "adapter:szc-skip" };
    }
    return { events: parseSzcMtb(url, html), strategy: "adapter:szc-mtb" };
  }
  if (host.includes("albgold-juniorscup.de")) {
    return {
      events: await enrichDeAtRacePages(await parseAlbGoldJuniors(url, html)),
      strategy: "adapter:alb-gold",
    };
  }
  if (host.includes("rookiescup-ostbayern.de")) {
    return {
      events: await enrichDeAtRacePages(parseRookiesOstbayern(url, html)),
      strategy: "adapter:rookies-ob",
    };
  }
  if (host.includes("xco-bikecup.de")) {
    return { events: parseXcoBikecup(url, html), strategy: "adapter:xco-bikecup" };
  }
  if (host.includes("schwarzwaelder-mtb-cup.de")) {
    return { events: parseSchwarzwalderCup(url, html), strategy: "adapter:smc" };
  }
  if (host.includes("rhein-eifel-mtb-cup.de")) {
    return { events: parseRheinEifelCup(url, html), strategy: "adapter:rhein-eifel" };
  }
  if (host.includes("mtb-oberschwaben-cup.de")) {
    return { events: parseOberschwabenCup(url, html), strategy: "adapter:omv" };
  }
  if (host.includes("mtbsaarlandliga.de")) {
    return {
      events: await enrichDeAtRacePages(parseSaarlandliga(url, html)),
      strategy: "adapter:saarlandliga",
    };
  }
  if (host.includes("juniorbikecup.at")) {
    return { events: parseJuniorBikeCup(url, html), strategy: "adapter:jbc" };
  }
  if (host.includes("on-offteam.cz")) {
    return { events: parseOnOffMtb(url, html), strategy: "adapter:on-off" };
  }
  if (host.includes("polandbike.pl")) {
    if (!/kalendarz/i.test(url)) {
      return { events: [], strategy: "adapter:polandbike-skip" };
    }
    return { events: parsePolandBike(url, html), strategy: "adapter:polandbike" };
  }
  if (host.includes("salzkammergut-trophy.at") || host.includes("trophy.at")) {
    return { events: parseSalzkammergutTrophy(url, html), strategy: "adapter:skgtrophy" };
  }
  if (host.includes("jcp-mtb.cz")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/") return { events: [], strategy: "adapter:sumavsky-skip" };
    } catch {
      return { events: [], strategy: "adapter:sumavsky-skip" };
    }
    return {
      events: await enrichSumavskyPohar(parseSumavskyPohar(url, html)),
      strategy: "adapter:sumavsky",
    };
  }
  if (host.includes("bayerwald-mtb-cup.com")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/") return { events: [], strategy: "adapter:bayerwald-skip" };
    } catch {
      return { events: [], strategy: "adapter:bayerwald-skip" };
    }
    return {
      events: parseBayerwaldCup(url, html),
      strategy: "adapter:bayerwald",
    };
  }
  if (host.includes("skiclub-bb.com")) {
    if (!/werdenfelscup/i.test(url)) {
      return { events: [], strategy: "adapter:werdenfels-skip" };
    }
    return { events: parseWerdenfelserCup(url, html), strategy: "adapter:werdenfels" };
  }
  if (host.includes("sportchallenge.cz")) {
    if (!/podkrkonosskymaraton\/2026/i.test(url)) {
      return { events: [], strategy: "adapter:podkrkonos-skip" };
    }
    return { events: parsePodkrkonosskyMaraton(url, html), strategy: "adapter:podkrkonos" };
  }
  if (host.includes("mtb-rhein-main-cup.de")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/") return { events: [], strategy: "adapter:rhein-main-skip" };
    } catch {
      return { events: [], strategy: "adapter:rhein-main-skip" };
    }
    return { events: parseRheinMainCup(url, html), strategy: "adapter:rhein-main" };
  }
  if (host.includes("mtb-kidscup.de")) {
    if (!/termine-2/i.test(url)) {
      return { events: [], strategy: "adapter:eldorado-skip" };
    }
    return {
      events: await enrichDeAtRacePages(parseEldoradoKidsCup(url, html)),
      strategy: "adapter:eldorado",
    };
  }
  if (host.includes("mountainbike-challenge.at")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/") return { events: [], strategy: "adapter:ktm-skip" };
    } catch {
      return { events: [], strategy: "adapter:ktm-skip" };
    }
    return { events: parseKtmJuniorChallenge(url, html), strategy: "adapter:ktm-junior" };
  }
  if (host.includes("soof.sk")) {
    if (!/podujatia-a-akcie/i.test(url)) {
      return { events: [], strategy: "adapter:soof-skip" };
    }
    return { events: parseSoofSk(url, html), strategy: "adapter:soof-sk" };
  }
  if (host.includes("mpdv-cup.de")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/") return { events: [], strategy: "adapter:mpdv-skip" };
    } catch {
      return { events: [], strategy: "adapter:mpdv-skip" };
    }
    return { events: parseMpdvCup(url, html), strategy: "adapter:mpdv" };
  }
  if (host.includes("schulsportverein.de")) {
    if (!/stadtmeisterschaft/i.test(url)) {
      return { events: [], strategy: "adapter:wiesbaden-skip" };
    }
    return {
      events: parseWiesbadenStadtmeisterschaft(url, html),
      strategy: "adapter:wiesbaden",
    };
  }
  if (host.includes("globmetalxc.pl")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/") return { events: [], strategy: "adapter:globmetal-skip" };
    } catch {
      return { events: [], strategy: "adapter:globmetal-skip" };
    }
    return { events: parseGlobmetalXc(url, html), strategy: "adapter:globmetal" };
  }
  if (host.includes("raceresult.com")) {
    try {
      const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
      if (path === "/events" || path === "/RREvents/list") {
        return {
          events: await parseRaceresultEvents(url, html),
          strategy: "adapter:raceresult",
        };
      }
    } catch {
      /* fall through to event-id adapters */
    }
    if (/\/387659\b/.test(url)) {
      return { events: parseZanzenbergOem(url, html), strategy: "adapter:zanzenberg" };
    }
    if (/\/377510\b/.test(url)) {
      return { events: parseLillelundsCup(url, html), strategy: "adapter:lillelunds" };
    }
  }
  if (host.includes("datasport.de") && /mtbwildpoldsried2026/i.test(url)) {
    return { events: parseAllgaeuKidsCup(url, html), strategy: "adapter:allgaeu-kids" };
  }
  if (host.includes("xco-nrw-cup.de")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/") return { events: [], strategy: "adapter:nrw-skip" };
    } catch {
      return { events: [], strategy: "adapter:nrw-skip" };
    }
    return {
      events: await enrichDeAtRacePages(parseXcoNrw(url, html)),
      strategy: "adapter:xco-nrw",
    };
  }
  if (host.includes("schwarzwald-bike-marathon.de")) {
    if (!/rena-kids-cup/i.test(url)) {
      return { events: [], strategy: "adapter:rena-skip" };
    }
    return { events: await parseRenaKidsCup(url, html), strategy: "adapter:rena-kids" };
  }
  if (host.includes("albstadt-bike-marathon.de")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/") return { events: [], strategy: "adapter:albstadt-skip" };
    } catch {
      return { events: [], strategy: "adapter:albstadt-skip" };
    }
    return { events: parseAlbstadtKidsCup(url, html), strategy: "adapter:albstadt-kids" };
  }
  if (host.includes("rsv-bad-griesbach.de")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/") return { events: [], strategy: "adapter:stoakart-skip" };
    } catch {
      return { events: [], strategy: "adapter:stoakart-skip" };
    }
    return { events: parseStoakartMoasta(url, html), strategy: "adapter:stoakart" };
  }
  if (host.includes("bahno.ambike.com")) {
    return { events: await parseBahno(url, html), strategy: "adapter:bahno" };
  }
  if (host.includes("bike-revolution.ch")) {
    if (!/anmeldung-2026/i.test(url)) {
      return { events: [], strategy: "adapter:br-skip" };
    }
    return { events: parseBikeRevolutionKids(url, html), strategy: "adapter:bike-revolution" };
  }
  if (host.includes("bikeside.ch")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/" && path !== "/kategorien") {
        return { events: [], strategy: "adapter:bikeside-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:bikeside-skip" };
    }
    return { events: await parseBikeSideKids(url, html), strategy: "adapter:bikeside" };
  }
  if (host.includes("mtbraceseries.ch")) {
    if (!/\/egg/i.test(url)) {
      return { events: [], strategy: "adapter:egg-skip" };
    }
    return { events: parseMtbRaceSeriesEgg(url, html), strategy: "adapter:egg" };
  }
  if (host.includes("fmciclismo.com")) {
    if (!/ESCUELAS/i.test(url)) {
      return { events: [], strategy: "adapter:madrid-skip" };
    }
    return { events: parseCopaMadridKids(url, html), strategy: "adapter:copa-madrid" };
  }
  if (host.includes("marathon-man.eu")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:mm-skip" };
    return { events: parseMarathonMan(url, html), strategy: "adapter:marathon-man" };
  }
  if (host.includes("authorkralsumavy.cz")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:kral-skip" };
    return { events: parseKralSumavy(url, html), strategy: "adapter:kral-sumavy" };
  }
  if (host.includes("malevilcup.cz")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:malevil-skip" };
    return { events: parseMalevilCup(url, html), strategy: "adapter:malevil" };
  }
  if (host.includes("horal.sk")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:horal-skip" };
    return { events: parseHoral(url, html), strategy: "adapter:horal" };
  }
  if (host.includes("bike-marathon.com")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(de|en)?$/.test(path)) return { events: [], strategy: "adapter:npbm-skip" };
    } catch {
      return { events: [], strategy: "adapter:npbm-skip" };
    }
    return { events: parseNationalparkBike(url, html), strategy: "adapter:np-bike" };
  }
  if (host.includes("grand-raid-bcvs.ch") || host.includes("grand-raid.ch")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:grandraid-skip" };
    return { events: parseGrandRaid(url, html), strategy: "adapter:grand-raid" };
  }
  if (host.includes("raidevolenard-fmv.ch") || host.includes("raidevolenard.ch")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:evol-skip" };
    return { events: parseRaidEvolenard(url, html), strategy: "adapter:evolenard" };
  }
  if (host.includes("mtbpomerania.pl")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:pomerania-skip" };
    return { events: parseMtbPomerania(url, html), strategy: "adapter:pomerania" };
  }
  if (host.includes("silesia.bike") || host.includes("bikeateliermaraton.pl")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:silesia-skip" };
    return { events: parseSilesiaBike(url, html), strategy: "adapter:silesia-bike" };
  }
  if (host.includes("herodolomites.com")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(en|it|de|fr)?$/.test(path)) return { events: [], strategy: "adapter:hero-skip" };
    } catch {
      return { events: [], strategy: "adapter:hero-skip" };
    }
    return { events: parseHeroDolomites(url, html), strategy: "adapter:hero" };
  }
  if (host.includes("troitrek.it")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:troi-skip" };
    return { events: parseTroiTrek(url, html), strategy: "adapter:troi-trek" };
  }
  if (host.includes("sloenduro.com")) {
    if (!/sloenduro-calendar/i.test(url)) {
      return { events: [], strategy: "adapter:sloenduro-skip" };
    }
    return { events: parseSloEnduro(url, html), strategy: "adapter:sloenduro" };
  }
  if (host.includes("sloxcup.com")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/dirke-2026/i.test(path)) {
        return { events: [], strategy: "adapter:sloxcup-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:sloxcup-skip" };
    }
    return { events: parseSloXcup(url, html), strategy: "adapter:sloxcup" };
  }
  if (host.includes("sloveniadownhillcup.si")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/((en|sl)\/)?(races|dirke)-2026/i.test(path)) {
        return { events: [], strategy: "adapter:slodh-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:slodh-skip" };
    }
    return { events: parseSloveniaDhCup(url, html), strategy: "adapter:slovenia-dh" };
  }
  if (host.includes("belgiancycling.be")) {
    if (!/3-nations-cup\/kalender/i.test(url)) {
      return { events: [], strategy: "adapter:3nations-skip" };
    }
    return { events: parse3NationsCup(url, html), strategy: "adapter:3-nations" };
  }
  if (host.includes("cycling.vlaanderen")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (/\/competitie\/mtb\/kids-series$/i.test(path)) {
        return { events: parseVlaanderenKids(url, html), strategy: "adapter:vl-kids" };
      }
      if (/\/competitie\/mtb\/xco-series$/i.test(path)) {
        return { events: parseVlaanderenXco(url, html), strategy: "adapter:vl-xco" };
      }
    } catch {
      return { events: [], strategy: "adapter:vl-skip" };
    }
    return { events: [], strategy: "adapter:vl-skip" };
  }
  if (host.includes("mtbcompetitieoostnederland.nl")) {
    if (!/agenda-mbt-cup/i.test(url)) {
      return { events: [], strategy: "adapter:oost-skip" };
    }
    return { events: parseOostNederland(url, html), strategy: "adapter:oost-nl" };
  }
  if (host.includes("knwu.nl")) {
    if (/kampioenschappen\/nk-mountainbike/i.test(url)) {
      return { events: parseNkMtb(url, html), strategy: "adapter:nk-mtb" };
    }
    if (/streetrace-competitie-2026/i.test(url)) {
      return { events: parseStreetrace(url, html), strategy: "adapter:streetrace" };
    }
    return { events: [], strategy: "adapter:knwu-skip" };
  }
  if (host.includes("mb-race.com")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:mbrace-skip" };
    return { events: parseMbRace(url, html), strategy: "adapter:mb-race" };
  }
  if (host.includes("transmaurienne-vanoise.com")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:tmv-skip" };
    return { events: parseTransmaurienne(url, html), strategy: "adapter:transmaurienne" };
  }
  if (host.includes("rocazur.com")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(fr|en)?$/.test(path)) return { events: [], strategy: "adapter:roc-skip" };
    } catch {
      return { events: [], strategy: "adapter:roc-skip" };
    }
    return { events: parseRocAzur(url, html), strategy: "adapter:roc-azur" };
  }
  if (host.includes("ryebikefestival.no")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:rye-skip" };
    return { events: parseRyeBikeFestival(url, html), strategy: "adapter:rye" };
  }
  if (host.includes("crosskovacsi.hu")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/" && path !== "/hu/nyitolap") {
        return { events: [], strategy: "adapter:crk-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:crk-skip" };
    }
    return { events: parseCrosskovacsi(url, html), strategy: "adapter:crosskovacsi" };
  }
  if (host.includes("alpen-tour.at")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:alpentour-skip" };
    return { events: parseAlpentour(url, html), strategy: "adapter:alpentour" };
  }
  if (host.includes("riojabikeexperience.com") || host.includes("lariojabikerace.com")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:rioja-skip" };
    return { events: parseRiojaBike(url, html), strategy: "adapter:rioja" };
  }
  if (host.includes("hbs.hr")) {
    if (/\/kalendar\/mtb/i.test(url)) {
      return { events: parseHbsMtb(url, html), strategy: "adapter:hbs-mtb" };
    }
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path === "/kalendar" || /^\/kalendar\/page\/\d+$/i.test(path)) {
        return { events: parseHbsCalendar(url, html), strategy: "adapter:hbs-cal" };
      }
    } catch {
      return { events: [], strategy: "adapter:hbs-skip" };
    }
    return { events: [], strategy: "adapter:hbs-skip" };
  }
  if (host.includes("superprestigecyclocross.be")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(nl|en|fr)?\/?kalender$/i.test(path) && path !== "/") {
        return { events: [], strategy: "adapter:sp-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:sp-skip" };
    }
    return { events: parseSuperprestige(url, html), strategy: "adapter:superprestige" };
  }
  if (host.includes("ucicyclocrossworldcup.com")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(en|nl|fr)?\/?calendar$/i.test(path)) {
        return { events: [], strategy: "adapter:cxwc-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:cxwc-skip" };
    }
    return { events: parseUciCxWorldCup(url, html), strategy: "adapter:uci-cx-wc" };
  }
  if (host.includes("uec.ch")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(en|fr|de)\/calendar$/i.test(path)) {
        return { events: [], strategy: "adapter:uec-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:uec-skip" };
    }
    return { events: parseUecCalendar(url, html), strategy: "adapter:uec" };
  }
  if (host.includes("letour.fr")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(en|fr|de|es)?$/.test(path)) {
        return { events: [], strategy: "adapter:tdf-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:tdf-skip" };
    }
    return { events: parseTourDeFrance(url, html), strategy: "adapter:tdf" };
  }
  if (host.includes("paris-roubaix.fr")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(en|fr)?$/.test(path)) {
        return { events: [], strategy: "adapter:roubaix-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:roubaix-skip" };
    }
    return { events: parseParisRoubaix(url, html), strategy: "adapter:paris-roubaix" };
  }
  if (host.includes("oesterreich-rundfahrt.at") || host.includes("tourofaustria.com")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:toa-skip" };
    return { events: parseTourOfAustria(url, html), strategy: "adapter:tour-austria" };
  }
  if (host.includes("tourdesuisse.ch")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(en|de|fr|it)?$/.test(path)) {
        return { events: [], strategy: "adapter:tds-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:tds-skip" };
    }
    return { events: parseTourDeSuisse(url, html), strategy: "adapter:tour-suisse" };
  }
  if (host.includes("gravelchallenge.dk")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:gcdk-skip" };
    return { events: parseGravelChallengeDk(url, html), strategy: "adapter:gravel-dk" };
  }
  if (host.includes("quebrantahuesos.com")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:qh-skip" };
    return { events: parseQuebrantahuesos(url, html), strategy: "adapter:qh" };
  }
  if (host.includes("lapuritoandorra.com")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:purito-skip" };
    return { events: parsePuritoAndorra(url, html), strategy: "adapter:purito" };
  }
  if (host.includes("kotl.at")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:kotl-skip" };
    return { events: parseKingOfTheLake(url, html), strategy: "adapter:kotl" };
  }
  if (host.includes("faustocoppi.net")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path !== "/" && path !== "/new") {
        return { events: [], strategy: "adapter:coppi-skip" };
      }
    } catch {
      return { events: [], strategy: "adapter:coppi-skip" };
    }
    return { events: parseFaustoCoppi(url, html), strategy: "adapter:fausto-coppi" };
  }
  if (host.includes("haervejsloebet.dk")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:haervej-skip" };
    return { events: parseHaervejsloebet(url, html), strategy: "adapter:haervej" };
  }
  if (host.includes("detskatour.sk")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (path === "/") {
        return { events: parseDetskaTour(url, html), strategy: "adapter:dtps" };
      }
      if (
        /\/category\/propozicie/i.test(path) ||
        (/\/20\d{2}\//.test(path) && /kolo|propoz|dtps|dpts/i.test(path))
      ) {
        return {
          events: parseDetskaTourPropozicie(url, html),
          strategy: "adapter:dtps-propozicie",
        };
      }
    } catch {
      return { events: [], strategy: "adapter:dtps-skip" };
    }
    return { events: [], strategy: "adapter:dtps-skip" };
  }
  if (host.includes("czechtour.com")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:czechtour-skip" };
    return { events: parseCzechTour(url, html), strategy: "adapter:czech-tour" };
  }
  if (host.includes("letapeczech.cz")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:letape-skip" };
    return { events: parseLetapeCzech(url, html), strategy: "adapter:letape-cz" };
  }
  if (host.includes("houffagravel.be")) {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "") || "/";
      if (!/^\/(en|nl|fr)$/.test(path)) return { events: [], strategy: "adapter:houffa-skip" };
    } catch {
      return { events: [], strategy: "adapter:houffa-skip" };
    }
    return { events: parseHouffaGravel(url, html), strategy: "adapter:houffa" };
  }
  if (host.includes("alsovka.cz")) {
    if (!/\/wh\/?$/i.test(new URL(url).pathname)) {
      return { events: [], strategy: "adapter:alsovka-skip" };
    }
    return { events: parseAlsovkaWh(url, html), strategy: "adapter:alsovka" };
  }
  if (host.includes("velkacenaklatov.cz")) {
    if (!isBareHome(url)) return { events: [], strategy: "adapter:klatovy-skip" };
    return { events: parseKlatovyXco(url, html), strategy: "adapter:klatovy" };
  }
  if (host.includes("pyoraily.fi")) {
    if (!/kultainen-kampi/i.test(url)) {
      return { events: [], strategy: "adapter:pyoraily-skip" };
    }
    return { events: parseKultainenKampi(url, html), strategy: "adapter:kampi" };
  }
  return null;
}

function isBareHome(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "") || "/";
    return path === "/";
  } catch {
    return false;
  }
}

function parseJuniorCup(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const text = $("body").text();
  const dateMatch = text.match(/(\d{1,2})\.\s*([a-zá-ž]+)\s+(\d{4})/i);
  const placeMatch = text.match(/Hradec\s+Králové[^,]*/i);
  const months: Record<string, string> = {
    ledna: "01",
    února: "02",
    března: "03",
    dubna: "04",
    května: "05",
    června: "06",
    července: "07",
    srpna: "08",
    září: "09",
    října: "10",
    listopadu: "11",
    prosince: "12",
  };
  let startDate = "";
  if (dateMatch) {
    const m = months[dateMatch[2].toLowerCase()];
    if (m) {
      startDate = `${dateMatch[3]}-${m}-${dateMatch[1].padStart(2, "0")}`;
    }
  }
  if (!startDate) return [];
  return [
    {
      externalId: `juniorcup-${startDate}`,
      name: "Junior Cup",
      startDate,
      placeText: placeMatch?.[0] ?? "Hradec Králové",
      countryHint: "CZ",
      discipline: ["xco"],
      audience: "kids",
      categories: [
        { name: "200 m", distanceKm: 0.2, ageMin: 4, ageMax: 6 },
        { name: "1 km", distanceKm: 1, ageMin: 7, ageMax: 10 },
        { name: "2.2 km", distanceKm: 2.2, ageMin: 11, ageMax: 14 },
      ],
      sourceUrl: url,
      confidence: 0.9,
    },
  ];
}

function parseKolopro(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const year =
    Number(html.match(/Kolo pro život[^<]{0,40}(20\d{2})/i)?.[1]) ||
    Number(html.match(/20(2[6-9]|3\d)/)?.[0]) ||
    new Date().getFullYear();
  const seriesRegs = $("a[href*='pravidla'][href$='.pdf'], a[href*='pravidla_kpz']")
    .first()
    .attr("href");
  let regulationsUrl: string | undefined;
  if (seriesRegs) {
    try {
      regulationsUrl = new URL(seriesRegs, url).toString();
    } catch {
      /* ignore */
    }
  }

  $('a[href*="/zavody/"]').each((_, a) => {
    const href = $(a).attr("href") || "";
    const label = $(a).text().replace(/\s+/g, " ").trim();
    if (!href || !label) return;
    if (/\/zavody\/?$/i.test(href) || /partnersk/i.test(label)) return;
    const range = label.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/);
    const one = label.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*$/);
    let startDate: string | null = null;
    let endDate: string | undefined;
    if (range) {
      const mo = range[3]!.padStart(2, "0");
      startDate = `${year}-${mo}-${range[1]!.padStart(2, "0")}`;
      endDate = `${year}-${mo}-${range[2]!.padStart(2, "0")}`;
    } else if (one) {
      startDate = `${year}-${one[2]!.padStart(2, "0")}-${one[1]!.padStart(2, "0")}`;
    }
    if (!startDate) return;

    let abs: string;
    try {
      abs = new URL(href, url).toString();
    } catch {
      return;
    }
    const name = label
      .replace(/\s+\d{1,2}\s*[-–]\s*\d{1,2}\s*\/\s*\d{1,2}\s*$/, "")
      .replace(/\s+\d{1,2}\s*\/\s*\d{1,2}\s*$/, "")
      .replace(/\s+proběhl\s*$/i, "")
      .trim();
    if (!name || name.length < 6) return;
    const externalId = `kolopro-${startDate}-${normalizeName(name)}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);
    const place =
      name
        .replace(/^(DIRECT|ŠKODA AUTO|VEOLIA|CARDION|NOVA SPORT)\s+/i, "")
        .replace(/\s+(TOUR|CUP|TROPHY).*$/i, "")
        .replace(/^Bikemaraton\s+/i, "")
        .trim() || name;
    events.push({
      externalId,
      name,
      startDate,
      endDate: endDate && endDate !== startDate ? endDate : undefined,
      placeText: place.slice(0, 80),
      countryHint: "CZ",
      discipline: ["xcm"],
      audience: "mixed",
      seriesName: "Kolo pro život",
      seriesSlug: "kolo-pro-zivot",
      seriesWebsite: "https://www.kolopro.cz/",
      sourceUrl: abs,
      websiteUrl: abs,
      regulationsUrl,
      confidence: 0.9,
    });
  });
  return events;
}

function dedupe(events: ParsedEvent[]): ParsedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const k = `${e.startDate}:${normalizeName(e.name)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

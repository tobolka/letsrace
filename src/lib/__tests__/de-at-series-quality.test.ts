import { describe, expect, it } from "vitest";
import { parseCubeCup } from "@/lib/watcher/extractors/cubecup";
import {
  cyclingAustriaPageUrls,
  parseCyclingAustria,
} from "@/lib/watcher/extractors/cyclingaustria";
import {
  deAtPageLinks,
  parseBayerwaldCup,
  parseAustriaKidsXc2026,
  parseYoungstersCup,
  parseMtbLiga,
  parseKamptalTrophy,
  parseSportklasseCup,
  parseAustrianGravitySeries,
  parseDownhillCup,
  parseGermanCxBundesliga,
  parseJuniorBikeCup,
  parseOberschwabenCup,
  parseRookiesOstbayern,
  parseSaarlandliga,
  parseSchwarzwalderCup,
  parseSoofSk,
  parseDetskaTourPropozicie,
} from "@/lib/watcher/extractors/kids-mtb-cups";
import { parseXcoNrw } from "@/lib/watcher/extractors/more-kids";

describe("deAtPageLinks", () => {
  it("prefers RaceResult registration and Generalausschreibung over leftover pages", () => {
    const html = `
      <a href="/anmeldung-alb-gold-juniorscup-2023/">Meldungen</a>
      <a href="https://my.raceresult.com/379367/registration">Anmeldung</a>
      <a href="https://schwarzwaelder-mtb-cup.de/generalausschreibung/">Generalausschreibung</a>
      <a href="https://my.raceresult.com/379367/results">Ergebnisse</a>
    `;
    const links = deAtPageLinks("https://schwarzwaelder-mtb-cup.de/", html);
    expect(links.registrationUrl).toBe("https://my.raceresult.com/379367/registration");
    expect(links.regulationsUrl).toContain("generalausschreibung");
  });

  it("reads Zur Website as the official race site, not the federation page", () => {
    const html = `
      <a href="https://www.eisenwadl.com">zur Website</a>
      <a href="https://my.raceresult.com/379367/registration">Anmeldung</a>
      <a href="/components/com_events/src/functions/download_pdf.php?id=BEE6092">PDF</a>
    `;
    const links = deAtPageLinks(
      "https://www.cyclingaustria.at/index.php?option=com_events&view=event&id=BEE6092",
      html,
    );
    expect(links.websiteUrl).toBe("https://www.eisenwadl.com/");
    expect(links.registrationUrl).toContain("raceresult.com");
    expect(links.regulationsUrl).toContain("download_pdf.php");
  });
});

describe("Rookies Cup Ostbayern", () => {
  it("uses the race page as source, not the listing", () => {
    const html = `
      <article class="rco-upcoming-race-card">
        <div class="rco-upcoming-race-date">12. September 2026</div>
        <div class="rco-upcoming-race-title">Waldkirchen 2026</div>
        <div class="rco-upcoming-race-place">Waldkirchen, Bayern</div>
        <a href="/races/waldkirchen-2026">Details</a>
      </article>
    `;
    const events = parseRookiesOstbayern("https://rookiescup-ostbayern.de/rennen/", html);
    expect(events).toHaveLength(1);
    expect(events[0]?.sourceUrl).toBe(
      "https://rookiescup-ostbayern.de/races/waldkirchen-2026",
    );
    expect(events[0]?.websiteUrl).toBe(events[0]?.sourceUrl);
    expect(events[0]?.startDate).toBe("2026-09-12");
  });
});

describe("CUBE Cup", () => {
  it("points each race at rennen-detail and the series Anmeldung hub", () => {
    const html = `
      <h1>CUBE Cup 2026</h1>
      <a class="event-link" href="/rennen-detail/bad-duerkheim">
        <div class="event-date"><span>06</span>.<span>09</span></div>
        <div class="event-type">XCO</div>
        <div class="event-name">Bad Dürkheim</div>
      </a>
    `;
    const events = parseCubeCup("https://cup.cube.eu/", html);
    expect(events[0]?.sourceUrl).toBe("https://cup.cube.eu/rennen-detail/bad-duerkheim");
    expect(events[0]?.websiteUrl).toBe(events[0]?.sourceUrl);
    expect(events[0]?.registrationUrl).toBe("https://cup.cube.eu/anmeldung");
    expect(events[0]?.startDate).toBe("2026-09-06");
  });
});

describe("Saarlandliga", () => {
  it("uses /rennen/{place}/ as source and series Datasport as registration", () => {
    const html = `
      <p>Neunkirchen 12.+13.09.2026 XCO</p>
      <p>Eppelborn 26.09.2026 XCC</p>
      <a href="http://www.datasport.de/anmeldeservice/mtbsaarlandliga2026">Anmeldung</a>
      <a href="/generalausschreibung/">Generalausschreibung</a>
    `;
    const events = parseSaarlandliga("https://mtbsaarlandliga.de/rennen/", html);
    expect(events.map((e) => e.sourceUrl)).toEqual([
      "https://mtbsaarlandliga.de/rennen/neunkirchen/",
      "https://mtbsaarlandliga.de/rennen/eppelborn/",
    ]);
    expect(events[0]?.registrationUrl).toContain("datasport.de/anmeldeservice");
    expect(events[0]?.regulationsUrl).toContain("generalausschreibung");
    expect(events[1]?.discipline).toEqual(["xcc"]);
  });
});

describe("Oberschwaben Cup", () => {
  it("maps each place to its venue, Anmeldung and Ausschreibung pages", () => {
    const html = `
      <h1>OMV Cup 2026</h1>
      <a href="/rot-an-der-rot.html">12.9 Rot an der Rot</a>
      <a href="/rot-an-der-rot/anmeldung-2026">Anmeldung Rot an der Rot</a>
      <a href="/rot-an-der-rot/ausschreibung-2026">Ausschreibung Rot an der Rot</a>
    `;
    const events = parseOberschwabenCup("https://mtb-oberschwaben-cup.de/", html);
    expect(events).toHaveLength(1);
    expect(events[0]?.sourceUrl).toBe("https://mtb-oberschwaben-cup.de/rot-an-der-rot.html");
    expect(events[0]?.registrationUrl).toContain("/rot-an-der-rot/anmeldung-2026");
    expect(events[0]?.regulationsUrl).toContain("/rot-an-der-rot/ausschreibung-2026");
    const vogtHtml = html + `<a href="/vogt.html">10.10 Vogt</a>`;
    const withVogt = parseOberschwabenCup("https://mtb-oberschwaben-cup.de/", vogtHtml);
    const vogt = withVogt.find((e) => e.placeText === "Vogt");
    expect(vogt?.sourceUrl).toBe("https://mtb-oberschwaben-cup.de/vogt.html");
    expect(vogt?.registrationUrl).toBeUndefined();
  });
});

describe("Schwarzwälder MTB Cup", () => {
  it("attaches the series RaceResult hub", () => {
    const html = `
      <p>R1 – Baiersbronn</p>
      <p>R1 So 03.05.2026</p>
      <a href="https://my.raceresult.com/379367/registration">Anmeldung</a>
      <a href="/generalausschreibung/">Generalausschreibung</a>
    `;
    const events = parseSchwarzwalderCup("https://schwarzwaelder-mtb-cup.de/", html);
    expect(events[0]?.registrationUrl).toContain("raceresult.com/379367/registration");
    expect(events[0]?.regulationsUrl).toContain("generalausschreibung");
  });
});

describe("Junior Bike Cup", () => {
  it("follows Link zur Veranstaltung instead of the listing", () => {
    const html = `
      <p>18.04.2026 &#8211; Bike Infection / Bruck &#8222;XC battle&#8220;
      <a href="https://www.bikeinfection.at">Link zur Veranstaltung&gt;&gt;&gt;</a></p>
      <p>02.08.2026 &#8211; Rad am Ring Salzburgring &#8222;Straße&#8220;
      <a href="https://www.radteamsalzburg.at/">Link</a></p>
    `;
    const events = parseJuniorBikeCup("https://www.juniorbikecup.at/termine/", html);
    expect(events).toHaveLength(1);
    expect(events[0]?.placeText).toBe("Bruck");
    expect(events[0]?.sourceUrl).toBe("https://www.bikeinfection.at");
    expect(events.map((e) => e.placeText)).not.toContain("Rad am Ring Salzburgring");
  });
});

describe("Bayerwald MTB Cup", () => {
  it("uses the club website as source and series Anmeldung as hub", () => {
    const html = `
      <table id="tablepress-4">
        <tr>
          <td>13.09.2026</td>
          <td>Waldkirchen</td>
          <td>XCO</td>
          <td><a href="https://www.rscwaldkirchen.de/">Verein</a></td>
        </tr>
      </table>
      <a href="/anmeldung/">Anmeldung</a>
      <a href="/gesamtausschreibung/">Gesamtausschreibung</a>
    `;
    const events = parseBayerwaldCup("https://www.bayerwald-mtb-cup.com/", html);
    expect(events[0]?.sourceUrl).toBe("https://www.rscwaldkirchen.de/");
    expect(events[0]?.registrationUrl).toContain("/anmeldung/");
    expect(events[0]?.regulationsUrl).toContain("ausschreibung");
  });
});

describe("Cycling Austria", () => {
  it("uses the event card href as source", () => {
    const html = `
      <div data-date="2026-09-13" class="Steiermark">
        <div class="uk-heading-small">So, 13. September 2026</div>
        <a class="om_card" href="/kalender/event?id=ABC123">
          <h3>XCO Graz Nachwuchs</h3>
        </a>
        <div class="event-verein">RC Graz</div>
      </div>
    `;
    const events = parseCyclingAustria(
      "https://www.cyclingaustria.at/kalender?sparten=mtb",
      html,
    );
    expect(events[0]?.sourceUrl).toContain("id=ABC123");
    expect(events[0]?.websiteUrl).toBe(events[0]?.sourceUrl);
    expect(events[0]?.sourceUrl).not.toContain("sparten=mtb");
    expect(events[0]?.childUrls?.some((u) => /page=2/.test(u))).toBe(true);
    expect(events[0]?.childUrls?.some((u) => /sparten=cyclocross/.test(u))).toBe(true);
    expect(events[0]?.childUrls?.every((u) => !/kalender\?/.test(new URL(u).search))).toBe(
      true,
    );
  });

  it("tags cup series and skips track/pumptrack", () => {
    const html = `
      <div data-date="2026-09-05" data-disziplin="Downhill" class="Niederösterreich">
        <div class="uk-heading-small">Sa, 5. September 2026</div>
        <a class="om_card" href="/kalender/event?id=GRAV1"><h3>auner Gravity Series Semmering</h3></a>
      </div>
      <div data-date="2026-09-12" data-disziplin="Bahn">
        <a class="om_card" href="/kalender/event?id=BAHN1"><h3>ÖM Bahn Linz</h3></a>
      </div>
      <div data-date="2026-10-03" data-disziplin="Cyclocross" class="Wien">
        <div class="uk-heading-small">Sa, 3. Oktober 2026</div>
        <a class="om_card" href="/kalender/event?id=CX1"><h3>Wienenergie Cyclocross</h3></a>
      </div>
    `;
    const events = parseCyclingAustria(
      "https://www.cyclingaustria.at/kalender?view=events",
      html,
    );
    expect(events.map((e) => e.name)).toEqual([
      "auner Gravity Series Semmering",
      "Wienenergie Cyclocross",
    ]);
    expect(events[0]?.seriesSlug).toBe("austrian-gravity-series");
    expect(events[1]?.discipline).toEqual(["cx"]);
    expect(cyclingAustriaPageUrls("https://www.cyclingaustria.at/kalender?view=events")).toEqual(
      expect.arrayContaining([
        expect.stringContaining("page=2"),
        expect.stringContaining("sparten=cyclocross"),
      ]),
    );
  });
});

describe("SooF.sk series", () => {
  const html = `
    SLOVENSKO
    Downhill 2026
    06.09.2026 SPDH-4 Veľká Rača
    04.10.2026 SPDH-5 Košútka 2
    Hornonitrianska Enduro Séria 2026
    12.09. - 13.09.2026 Donovaly
    10.10. - 11.10.2026 Bojnice
    Slovenský pohár NyNa Gravel 2026
    13.09.2026 - 5.kolo - NYNA Gravel Cup 2026 - Komárno
    19.09.2026 - 6.kolo - NYNA Gravel Cup - Gajary
    Detská VRL Adriána Babiča 2026
    05.09.2026 - 10.kolo - Detská VRL Adriána Babiča - Košice
    VÝCHOD ROAD LIGA 2026
    27.09.2026 - 8.kolo - VÝCHOD ROAD LIGA - Mlynčeky
    MTB LIGA Prešovského kraja
    22.08.2026 - 5.kolo - Čarnohurec - Brezovica
    13.09.2026 - 6.kolo - Podhoranský stupák - Podhorany
    SVET
    04.07.2026 - Tour de France
  `;

  it("reads remaining SK series and ignores the world-tour dump", () => {
    const events = parseSoofSk("https://www.soof.sk/podujatia-a-akcie", html);
    const slugs = [...new Set(events.map((e) => e.seriesSlug))];
    expect(slugs).toEqual(
      expect.arrayContaining([
        "detska-vrl",
        "spdh",
        "hornonitrianska-enduro",
        "nyna-gravel-cup",
        "mtb-liga-presov",
        "vychod-road-liga",
      ]),
    );
    expect(events.map((e) => e.name).join(" ")).not.toMatch(/Tour de France/);
    expect(events.find((e) => e.placeText === "Veľká Rača")?.discipline).toEqual(["dh"]);
    expect(events.find((e) => e.placeText === "Donovaly")?.endDate).toBe("2026-09-13");
    expect(events.find((e) => e.placeText === "Komárno")?.discipline).toEqual(["gravel"]);
    expect(events.find((e) => e.placeText === "Mlynčeky")?.discipline).toEqual(["road"]);
  });
});

describe("Austria Youngsters Cup", () => {
  it("reads all ten 2026 rounds from the official Termine sidebar", () => {
    const html = `
      <div class="block block-termine"><h2>Termine</h2><ul>
        <li><a href="http://www.youngsters-cup.at/26042026__haiming_t-pid473" title="26.04.2026 - Haiming (T)">26.04.2026 - Haiming (T)</a></li>
        <li><a href="http://www.youngsters-cup.at/09052026__scheffau_t-pid657" title="09.05.2026 - Scheffau (T)">09.05.2026 - Scheffau (T)</a></li>
        <li><a href="http://www.youngsters-cup.at/23052026__kleinzell_ooe+ts-pid521" title="23.05.2026 - Kleinzell (OÖ)+TS ">23.05.2026 - Kleinzell (OÖ)+TS</a></li>
        <li><a href="http://www.youngsters-cup.at/27062026__koppl_s-pid476" title="27.06.2026 - Koppl (S)">27.06.2026 - Koppl (S)</a></li>
        <li><a href="http://www.youngsters-cup.at/12072026__kirchschlag_idbw_noe__kombi-pid479" title="12.07.2026 - Kirchschlag i.d.b.W. (NÖ) - Kombi">12.07.2026 - Kirchschlag</a></li>
        <li><a href="http://www.youngsters-cup.at/22082026_fusch_glockner_s-pid688" title="22.08.2026 Fusch/Glockner (S)">22.08.2026 Fusch/Glockner (S)</a></li>
        <li><a href="http://www.youngsters-cup.at/29082026__krumbach_noe-pid475" title="29.08.2026 - Krumbach (NÖ)">29.08.2026 - Krumbach (NÖ)</a></li>
        <li><a href="http://www.youngsters-cup.at/13092026__petzen_k-pid622" title="13.09.2026 - Petzen (K)">13.09.2026 - Petzen (K)</a></li>
        <li><a href="http://www.youngsters-cup.at/19092026__ottenschlag_ooe-pid674" title="19.09.2026 - Ottenschlag (OÖ)">19.09.2026 - Ottenschlag (OÖ)</a></li>
        <li><a href="http://www.youngsters-cup.at/-pid649" title="03.10.2026  Grazer AYC-Finale Stattegg & 3. Pumpiläum">03.10.2026 Stattegg</a></li>
      </ul></div>
    `;
    const events = parseYoungstersCup("http://www.youngsters-cup.at/", html);
    expect(events).toHaveLength(10);
    expect(events.map((e) => e.startDate)).toEqual([
      "2026-04-26",
      "2026-05-09",
      "2026-05-23",
      "2026-06-27",
      "2026-07-12",
      "2026-08-22",
      "2026-08-29",
      "2026-09-13",
      "2026-09-19",
      "2026-10-03",
    ]);
    expect(events.find((e) => e.startDate === "2026-08-22")?.websiteUrl).toContain(
      "bikeinfection.at",
    );
    expect(events.some((e) => e.startDate === "2026-09-26")).toBe(false);
    expect(events.every((e) => e.seriesSlug === "austrian-youngsters-cup")).toBe(true);
    expect(events.find((e) => e.startDate === "2026-10-03")?.discipline).toEqual(["xcc"]);
  });

  it("falls back to the published 2026 table when Termine is missing", () => {
    const events = parseAustriaKidsXc2026(
      "https://cyclingaustria.at/images/Cup/26%20Cup%20Ausschreibungen/MTB%20Austria%20Youngsters%20Cup%202026.pdf",
      "",
    );
    expect(events).toHaveLength(10);
    expect(events[0]?.websiteUrl).toContain("youngsters-cup.at");
    expect(events[5]?.startDate).toBe("2026-08-22");
  });
});

describe("Mountainbike Liga Austria", () => {
  it("reads the six 2026 rounds and skips placeholder Termine rows", () => {
    const html = `
      <div class="block block-termine"><h2>Termine</h2><ul>
        <li><a href="http://www.mtb-liga.at/29032026__langenlois_zoebing-pid445" title="29.03.2026 - Langenlois/Zöbing">29.03.2026 - Langenlois/Zöbing</a></li>
        <li><a href="http://www.mtb-liga.at/25_26042026__haiming-pid446" title="25./26.04.2026 - Haiming">25./26.04.2026 - Haiming</a></li>
        <li><a href="http://www.mtb-liga.at/10052026__scheffau_t-pid679" title="10.05.2026 - Scheffau (T)">10.05.2026 - Scheffau (T)</a></li>
        <li><a href="http://www.mtb-liga.at/30052026__windhaag_b_perg-pid482" title="30.05.2026 - Windhaag b. Perg">30.05.2026 - Windhaag b. Perg</a></li>
        <li><a href="http://www.mtb-liga.at/27062026__koppl-pid671" title="27.06.2026 - Koppl">27.06.2026 - Koppl</a></li>
        <li><a href="http://www.mtb-liga.at/20092026__ottenschlag-pid642" title="20.09.2026 - Ottenschlag">20.09.2026 - Ottenschlag</a></li>
        <li><a href="http://www.mtb-liga.at/___________________-pid546" title="--------------------------------------">------</a></li>
        <li><a href="http://www.mtb-liga.at/-pid597" title="(Vorbehaltlich der Zustimmung der Veranstalter:innen zu den Cupbedingungen!)">Vorbehaltlich</a></li>
      </ul></div>
    `;
    const events = parseMtbLiga("http://www.mtb-liga.at/", html);
    expect(events).toHaveLength(6);
    expect(events.map((e) => e.startDate)).toEqual([
      "2026-03-28",
      "2026-04-25",
      "2026-05-10",
      "2026-05-30",
      "2026-06-27",
      "2026-09-20",
    ]);
    expect(events[0]?.endDate).toBe("2026-03-29");
    expect(events[1]?.endDate).toBe("2026-04-26");
    expect(events[0]?.websiteUrl).toContain("kamptaltrophy.at");
    expect(events[0]?.resultsUrl).toContain("/de/ergebnisse");
    expect(events.every((e) => e.seriesSlug === "mountainbike-liga")).toBe(true);
  });
});

describe("Sportklasse Cup", () => {
  it("reads the six 2026 amateur rounds and skips placeholder Termine rows", () => {
    const html = `
      <div class="block block-termine"><h2>Termine</h2><ul>
        <li><a href="http://www.sportklasse-cup.at/29032026__langenlois_zoebing-pid441" title="29.03.2026 - Langenlois/Zöbing">29.03.2026 - Langenlois/Zöbing</a></li>
        <li><a href="http://www.sportklasse-cup.at/26042026__haiming-pid442" title="26.04.2026 - Haiming">26.04.2026 - Haiming</a></li>
        <li><a href="http://www.sportklasse-cup.at/12072026__kirchschlag-pid537" title="12.07.2026 - Kirchschlag">12.07.2026 - Kirchschlag</a></li>
        <li><a href="http://www.sportklasse-cup.at/22082026__moellbruecke-pid633" title="22.08.2026 - Möllbrücke">22.08.2026 - Möllbrücke</a></li>
        <li><a href="http://www.sportklasse-cup.at/13092026__petzen-pid680" title="13.09.2026 - Petzen">13.09.2026 - Petzen</a></li>
        <li><a href="http://www.sportklasse-cup.at/19092026__ottenschlag-pid496" title="19.09.2026 - Ottenschlag">19.09.2026 - Ottenschlag</a></li>
        <li><a href="http://www.sportklasse-cup.at/____________________-pid549" title="----------------------------------------">------</a></li>
        <li><a href="http://www.sportklasse-cup.at/-pid601" title="(vorbehaltlich der Zustimmung der Veranstalter:innen zu den Cupbedingungen!)">Vorbehaltlich</a></li>
      </ul></div>
    `;
    const events = parseSportklasseCup("http://www.sportklasse-cup.at/", html);
    expect(events).toHaveLength(6);
    expect(events.map((e) => e.startDate)).toEqual([
      "2026-03-29",
      "2026-04-26",
      "2026-07-12",
      "2026-08-22",
      "2026-09-13",
      "2026-09-19",
    ]);
    expect(events[0]?.websiteUrl).toContain("sportklasse-cup.at");
    expect(events[0]?.resultsUrl).toContain("kamptaltrophy.at/de/ergebnisse");
    expect(events[1]?.websiteUrl).toContain("sportklasse-cup.at");
    expect(events[3]?.websiteUrl).toContain("eisenwadl.com");
    expect(events.every((e) => e.seriesSlug === "sportklasse-cup")).toBe(true);
  });
});

describe("KTM Kamptal Trophy", () => {
  it("reads the UCI weekend and Saturday youngsters from the results page", () => {
    const html = `
      <h4>34. KTM Kamptal Trophy (28./29. März 2026)</h4>
      <a href="/de/ergebnisse">Ergebnisse</a>
      <p>U17 m/w Youngster · SPORTUNION Kids Race U9 U11 · XCC C3 · XCO C1</p>
    `;
    const events = parseKamptalTrophy("https://kamptaltrophy.at/de/ergebnisse", html);
    expect(events).toHaveLength(2);
    expect(events[0]?.name).toContain("Kamptal Trophy");
    expect(events[0]?.startDate).toBe("2026-03-28");
    expect(events[0]?.endDate).toBe("2026-03-29");
    expect(events[0]?.seriesSlug).toBe("mountainbike-liga");
    expect(events[0]?.resultsUrl).toBe("https://kamptaltrophy.at/de/ergebnisse");
    expect(events[0]?.discipline).toEqual(expect.arrayContaining(["xco", "xcc"]));
    expect(events[1]?.name).toMatch(/Youngsters/i);
    expect(events[1]?.startDate).toBe("2026-03-28");
    expect(events[1]?.websiteUrl).toContain("kategorien-strecke");
    expect(events[1]?.resultsUrl).toBe("https://kamptaltrophy.at/de/ergebnisse");
    expect(events[1]?.seriesSlug).toBeUndefined();
  });
});

describe("Austrian Gravity Series / Downhill Cup", () => {
  it("emits the six 2026 DH rounds and ignores stale 2023 Termine", () => {
    const html = `
      <div class="block block-termine"><h2>Termine</h2><ul>
        <li><a href="http://www.downhill-cup.at/13_mai__oem_wurbauerkogel-pid677" title="13. Mai - ÖM Wurbauerkogel">13. Mai</a></li>
        <li><a href="http://www.downhill-cup.at/26280523_koenigsberg_noe-pid653" title="26.-28.05.23 Königsberg (NÖ)">26.-28.05.23</a></li>
        <li><a href="http://www.downhill-cup.at/21230923_schladming_st-pid529" title="21.-23.09.23 Schladming (ST)">21.-23.09.23</a></li>
        <li><a href="http://www.downhill-cup.at/-pid607" title="(vorbehaltlich der Zustimmung der Veranstalter zu den Cupbedingungen!)">Vorbehaltlich</a></li>
      </ul></div>
      <p>Coming Soon!!! AAGS DHI Schöckl - 02. Mai 2026</p>
    `;
    const events = parseDownhillCup("http://www.downhill-cup.at/", html);
    expect(events).toHaveLength(6);
    expect(events.map((e) => e.startDate)).toEqual([
      "2026-05-02",
      "2026-05-14",
      "2026-07-04",
      "2026-07-18",
      "2026-09-05",
      "2026-10-04",
    ]);
    expect(events.every((e) => e.discipline?.includes("dh"))).toBe(true);
    expect(events.every((e) => e.seriesSlug === "austrian-gravity-series")).toBe(true);
    expect(events.some((e) => /2023/.test(e.startDate))).toBe(false);
  });

  it("reads the LINES 2026 table", () => {
    const html = `
      <table>
        <tr><td>2.5.2026</td><td>aAGS #1 – Schöckl Trail Area</td></tr>
        <tr><td>14.5.2026</td><td>aAGS #2 – Weissensee</td></tr>
        <tr><td>4.7.2026</td><td>aAGS #3 – Bikepark Lienz</td></tr>
        <tr><td>18.7.2026</td><td>aAGS #4 – Lermoos</td></tr>
        <tr><td>5.9.2026</td><td>aAGS #5 – Bikepark Semmering</td></tr>
        <tr><td>4.10.2026</td><td>aAGS #6 – Bikepark Leogang</td></tr>
      </table>
    `;
    const events = parseAustrianGravitySeries(
      "https://www.lines-mag.at/austrian-gravity-series/",
      html,
    );
    expect(events).toHaveLength(6);
    expect(events[4]?.registrationUrl).toContain("376441");
    expect(events[5]?.startDate).toBe("2026-10-04");
  });
});

describe("Cyclo-Cross Bundesliga", () => {
  it("emits the 2026/27 city rounds from the official GA", () => {
    const events = parseGermanCxBundesliga(
      "https://static.rad-net.de/html/bdr/generalausschreibungen/2026/ga-bl-cyclo-cross_26-27.pdf",
      "",
    );
    expect(events).toHaveLength(14);
    expect(events[0]?.startDate).toBe("2026-09-19");
    expect(events[0]?.placeText).toBe("Bad Salzdetfurth");
    expect(events.at(-1)?.placeText).toBe("Vechta");
    expect(events.every((e) => e.seriesSlug === "cx-bundesliga")).toBe(true);
  });
});

describe("Detská Tour Petra Sagana propozície", () => {
  it("reads the category listing and points each round at its post", () => {
    const html = `
      <article>
        <h2><a href="https://detskatour.sk/2026/6-kolo-dtps-2026-nitra-propozicie/">6. kolo DTPS 2026 – Nitra (propozície)</a></h2>
        <p>Dátum konania súťaže 29. august 2026 /sobota/</p>
      </article>
      <article>
        <h2><a href="https://detskatour.sk/2026/5-kolo-dtps-2026-myjava-propozicie/">5. kolo DTPS 2026 – Myjava (propozície)</a></h2>
        <p>Dátum konania súťaže 28.júna 2026 /nedeľa/</p>
      </article>
    `;
    const events = parseDetskaTourPropozicie(
      "https://detskatour.sk/category/propozicie/",
      html,
    );
    expect(events.map((e) => `${e.startDate} ${e.placeText}`)).toEqual([
      "2026-08-29 Nitra",
      "2026-06-28 Myjava",
    ]);
    expect(events[0]?.regulationsUrl).toContain("nitra-propozicie");
    expect(events[0]?.registrationUrl).toBe("https://dtps.mtbiker.sk");
    expect(events[0]?.childUrls).toEqual(
      expect.arrayContaining([
        "https://detskatour.sk/2026/6-kolo-dtps-2026-nitra-propozicie/",
      ]),
    );
  });

  it("reads GPS from a round post", () => {
    const html = `
      <article>
        <h1>6. kolo DTPS 2026 – Nitra (propozície)</h1>
        <p>Dátum konania súťaže 29. august 2026 /sobota/</p>
        <p>Nový Park Nitra <u>48.316133, 18.080973</u></p>
      </article>
    `;
    const events = parseDetskaTourPropozicie(
      "https://detskatour.sk/2026/6-kolo-dtps-2026-nitra-propozicie/",
      html,
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.lat).toBeCloseTo(48.316133);
    expect(events[0]?.lng).toBeCloseTo(18.080973);
    expect(events[0]?.regulationsUrl).toContain("nitra-propozicie");
  });
});

describe("XCO-NRW", () => {
  it("uses the card href as source and Time&Voice as registration", () => {
    const html = `
      <h1>Veranstaltungen 2026</h1>
      <div class="event-box">
        <div class="event-date"><span class="day">13</span><span class="month">Sep</span></div>
        <div class="event-info"><h3>Wuppertal</h3></div>
        <div class="event-tags">XCO NRW Schüler</div>
        <a href="/rennen/wuppertal">Details</a>
      </div>
      <a href="https://time-and-voice.com/de/mtb/2026">Anmeldung</a>
      <a href="/generalausschreibung2026.pdf">Generalausschreibung</a>
    `;
    const events = parseXcoNrw("https://www.xco-nrw-cup.de/", html);
    expect(events[0]?.sourceUrl).toBe("https://www.xco-nrw-cup.de/rennen/wuppertal");
    expect(events[0]?.registrationUrl).toContain("time-and-voice.com");
    expect(events[0]?.regulationsUrl).toContain("generalausschreibung");
  });
});

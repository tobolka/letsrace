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

describe("Austria kids XC 2026 CSV", () => {
  it("emits every remaining AYC / Nachwuchs round from the calendar", () => {
    const events = parseAustriaKidsXc2026(
      "https://cyclingaustria.at/images/Cup/26%20Cup%20Ausschreibungen/MTB%20Austria%20Youngsters%20Cup%202026.pdf",
      "",
    );
    expect(events).toHaveLength(5);
    expect(events.map((e) => `${e.startDate} ${e.placeText}`)).toEqual([
      "2026-08-29 Krumbach, Niederösterreich",
      "2026-09-13 St. Michael ob Bleiburg, Kärnten",
      "2026-09-19 Ottenschlag im Mühlkreis, Oberösterreich",
      "2026-09-26 Fusch an der Großglocknerstraße, Salzburg",
      "2026-10-03 Stattegg, Steiermark",
    ]);
    expect(events.every((e) => e.seriesSlug === "austrian-youngsters-cup")).toBe(true);
    expect(events[0]?.websiteUrl).toBe("https://www.bikethebugles.at/");
    expect(events[3]?.regulationsUrl).toContain("Youngsters");
    expect(events[4]?.discipline).toEqual(["xcc"]);
    expect(events[0]?.categories?.map((c) => c.name)).toEqual([
      "U5",
      "U7",
      "U9",
      "U11",
      "U13",
      "U15",
      "U17",
    ]);
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

import { describe, expect, it } from "vitest";
import { parseCubeCup } from "@/lib/watcher/extractors/cubecup";
import { parseCyclingAustria } from "@/lib/watcher/extractors/cyclingaustria";
import {
  deAtPageLinks,
  parseBayerwaldCup,
  parseJuniorBikeCup,
  parseOberschwabenCup,
  parseRookiesOstbayern,
  parseSaarlandliga,
  parseSchwarzwalderCup,
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

import { describe, expect, it } from "vitest";
import {
  enrichMtbOnlineFromDetail,
  isItalianCyclingEvent,
  isItalianLocation,
  mtbOnlineParsedEvent,
  parseItalianDateRange,
  parseMtbOnlineEvents,
  parseWinningTimeCircuitStages,
  parseWinningTimeDetail,
  parseWinningTimeList,
  romeDateFromIso,
} from "@/lib/catalog/it-portals";

describe("Italian cycling portals (mtbonline.it & winningtime.it)", () => {
  it("parses Italian date ranges, invalid calendar dates, and Europe/Rome UTC shifts", () => {
    expect(parseItalianDateRange("14 marzo 2027")).toEqual({ startDate: "2027-03-14", endDate: null });
    expect(parseItalianDateRange("5–6 giugno 2027")).toEqual({ startDate: "2027-06-05", endDate: "2027-06-06" });
    expect(parseItalianDateRange("28 novembre - 1 dicembre 2026")).toEqual({ startDate: "2026-11-28", endDate: "2026-12-01" });
    expect(parseItalianDateRange("31 febbraio 2027")).toBeNull();
    expect(romeDateFromIso("2027-03-13T23:00:00.000Z")).toBe("2027-03-14");
    expect(romeDateFromIso("2027-06-04T22:00:00.000Z")).toBe("2027-06-05");
  });

  it("excludes non-cycling sports and foreign locations", () => {
    expect(isItalianCyclingEvent(["Podismo"], "La Mezza di Torino")).toBe(false);
    expect(isItalianCyclingEvent(["Triathlon"], "Triathlon Olimpico")).toBe(false);
    expect(isItalianCyclingEvent(["Duathlon"], "Duathlon Sant'Andrea")).toBe(false);
    expect(isItalianCyclingEvent(["Altro"], "Hybrid Race Competitions")).toBe(false);
    expect(isItalianCyclingEvent(["Ciclismo strada"], "Granfondo Garda Cycling")).toBe(true);
    expect(isItalianLocation("Ostrava - Cechia")).toBe(false);
    expect(isItalianLocation("Hoogerheide - Paesi Bassi")).toBe(false);
    expect(isItalianLocation("Campochiesa - Albenga, Liguria")).toBe(true);
  });

  it("parses mtbonline.it/Eventi rows, skips foreign UCI rounds, and builds ParsedEvent", () => {
    const html = `
      <section id="manifestazioni-event-month-2026-11" class="event-month">
        <h2 id="month-2026-11" class="roadbook-month__title">Novembre</h2>
        <div class="roadbook-row" data-event-type="cyclo cross">
          <div class="roadbook-card roadbook-card--static">
            <time class="roadbook-card__date" itemprop="startDate" datetime="2026-11-27"><b>27</b>&nbsp;NOV</time>
            <span class="roadbook-card__type">Cyclo Cross</span>
            <h3 class="roadbook-card__title" itemprop="name">Coppa del Mondo</h3>
            <span class="roadbook-card__place">Ostrava - Cechia</span>
          </div>
        </div>
      </section>
      <section id="manifestazioni-event-month-2026-12" class="event-month">
        <h2 id="month-2026-12" class="roadbook-month__title">Dicembre</h2>
        <div class="roadbook-row" data-event-type="cyclo cross">
          <a class="roadbook-card" href="https://www.mtbonline.it/Evento/2449-1-trofeo-cx-del-borgo-di-oriolo">
            <time class="roadbook-card__date" itemprop="startDate" datetime="2026-12-06"><b>06</b>&nbsp;DIC</time>
            <span class="roadbook-card__type">Cyclo Cross</span>
            <h3 class="roadbook-card__title" itemprop="name">1° Trofeo CX del Borgo di Oriolo</h3>
            <span class="roadbook-card__place">Oriolo (CS), Calabria</span>
          </a>
        </div>
      </section>
      <section id="manifestazioni-event-month-2027-03" class="event-month">
        <h2 id="month-2027-03" class="roadbook-month__title">Marzo <span>2027</span></h2>
        <div class="roadbook-row" data-event-type="cross country">
          <div class="roadbook-card roadbook-card--static">
            <time class="roadbook-card__date" itemprop="startDate" datetime="2027-03-06"><b>06</b>&nbsp;MAR</time>
            <span class="roadbook-card__type">Cross Country</span>
            <h3 class="roadbook-card__title" itemprop="name">XCO Città di Albenga</h3>
            <span class="roadbook-card__place">Campochiesa - Albenga, Liguria</span>
          </div>
        </div>
        <div class="roadbook-row" data-event-type="podismo">
          <div class="roadbook-card roadbook-card--static">
            <time class="roadbook-card__date" itemprop="startDate" datetime="2027-03-21"><b>21</b>&nbsp;MAR</time>
            <span class="roadbook-card__type">Podismo</span>
            <h3 class="roadbook-card__title" itemprop="name">Corsa di Primavera</h3>
            <span class="roadbook-card__place">Alba, Piemonte</span>
          </div>
        </div>
      </section>
    `;

    const rows = parseMtbOnlineEvents(html);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "2449",
      externalId: "mtbonline:2449",
      startDate: "2026-12-06",
      place: "Oriolo (CS), Calabria",
      discipline: "cx",
    });
    expect(rows[1]).toMatchObject({
      id: null,
      startDate: "2027-03-06",
      place: "Campochiesa - Albenga, Liguria",
      discipline: "xco",
    });

    const ev = mtbOnlineParsedEvent(rows[1]!);
    expect(ev).toMatchObject({
      name: "XCO Città di Albenga",
      startDate: "2027-03-06",
      placeText: "Campochiesa - Albenga, Liguria",
      countryHint: "IT",
      discipline: ["xco"],
      sourceUrl: "https://www.mtbonline.it/Eventi",
    });
    expect(ev.evidence?.quote).toContain("Marzo 2027");
    expect(ev.evidence?.method).toBe("mtbonline_it");
  });

  it("enriches mtbonline.it/Evento detail pages with JSON-LD, coordinates, and full Italian date", () => {
    const [row] = parseMtbOnlineEvents(`
      <section class="event-month">
        <div class="roadbook-row" data-event-type="cyclo cross">
          <a class="roadbook-card" href="https://www.mtbonline.it/Evento/2449-1-trofeo-cx-del-borgo-di-oriolo">
            <time class="roadbook-card__date" datetime="2026-12-06"><b>06</b>&nbsp;DIC</time>
            <span class="roadbook-card__type">Cyclo Cross</span>
            <h3 class="roadbook-card__title">1° Trofeo CX del Borgo di Oriolo</h3>
            <span class="roadbook-card__place">Oriolo (CS), Calabria</span>
          </a>
        </div>
      </section>
    `);
    const detailHtml = `
      <script type="application/ld+json">${JSON.stringify({
        "@type": "SportsEvent",
        name: "1° Trofeo CX del Borgo di Oriolo",
        startDate: "2026-12-06",
        endDate: "2026-12-06",
        location: { "@type": "Place", name: "Oriolo (CS)" },
      })}</script>
      <main>
        <h1>1° Trofeo CX del Borgo di Oriolo</h1>
        <p>Quando si parte 6 Dicembre 2026</p>
        <a href="https://maps.google.com/?q=40%2E0318893%2C16%2E4527292">Punto di ritrovo su Google Maps</a>
        <a href="https://www.locobikers.it/">Sito ufficiale</a>
      </main>
    `;
    const ev = enrichMtbOnlineFromDetail(row!, detailHtml, "https://www.mtbonline.it/Evento/2449-1-trofeo-cx-del-borgo-di-oriolo");
    expect(ev).toMatchObject({
      externalId: "mtbonline:2449",
      startDate: "2026-12-06",
      placeText: "Oriolo (CS)",
      countryHint: "IT",
      websiteUrl: "https://www.locobikers.it/",
      lat: 40.0318893,
      lng: 16.4527292,
    });
    expect(ev.evidence?.quote).toContain("6 Dicembre 2026");
  });

  it("parses iscrizioni.winningtime.it/eventi cards, filters non-cycling, and detects circuits", () => {
    const listHtml = `
      <a href="/eventi/duathlon-sant-andrea">
        <span class="bg-lime">Duathlon</span>
        <h3>Duathlon Sant'Andrea</h3>
        <div class="text-body-sm">
          <span class="inline-flex">28 novembre 2026</span>
          <span class="inline-flex">Cereda Di Cornedo</span>
        </div>
      </a>
      <a href="/eventi/la-mezza-di-torino">
        <span class="bg-lime">Podismo</span>
        <h3>La Mezza di Torino</h3>
        <div class="text-body-sm">
          <span class="inline-flex">11 aprile 2027</span>
          <span class="inline-flex">Torino</span>
        </div>
      </a>
      <a href="/eventi/brixia-adventure-mtb">
        <span class="bg-lime">MTB</span>
        <h3>Brixia Adventure MTB</h3>
        <div class="text-body-sm">
          <span class="inline-flex">21 febbraio – 26 settembre 2027</span>
        </div>
      </a>
      <a href="/eventi/granfondo-garda-cycling">
        <span class="bg-lime">Ciclismo strada</span>
        <h3>Granfondo Garda Cycling</h3>
        <div class="text-body-sm">
          <span class="inline-flex">14 marzo 2027</span>
          <span class="inline-flex">Garda</span>
        </div>
      </a>
      <a href="/eventi/giro-del-mito">
        <span class="bg-lime">Gravel</span>
        <span class="bg-lime">Ciclismo strada</span>
        <h3>Giro Del Mito</h3>
        <div class="text-body-sm">
          <span class="inline-flex">5–6 giugno 2027</span>
          <span class="inline-flex">Bagno Di Romagna</span>
        </div>
      </a>
    `;

    const cards = parseWinningTimeList(listHtml);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({ slug: "brixia-adventure-mtb", isCircuit: true, startDate: "2027-02-21", endDate: "2027-09-26" });
    expect(cards[1]).toMatchObject({ slug: "granfondo-garda-cycling", isCircuit: false, startDate: "2027-03-14", place: "Garda" });
    expect(cards[2]).toMatchObject({ slug: "giro-del-mito", isCircuit: false, startDate: "2027-06-05", endDate: "2027-06-06", sports: ["Gravel", "Ciclismo strada"] });
  });

  it("parses WinningTime detail page with Europe/Rome date, links, and circuit stages", () => {
    const detailHtml = `
      <main>
        <h1>Granfondo Garda Cycling</h1>
        <p>14 marzo 2027 Garda · IT</p>
        <script type="application/ld+json">${JSON.stringify([{
          "@type": "SportsEvent",
          name: "Granfondo Garda Cycling",
          startDate: "2027-03-13T23:00:00.000Z",
          endDate: "2027-03-13T23:00:00.000Z",
          sport: "Ciclismo strada",
          organizer: { "@type": "Organization", name: "TEAM GIOMAS", url: "https://www.giomas.org/gardahome" },
          location: {
            "@type": "Place",
            name: "Garda",
            address: { addressLocality: "Garda", addressCountry: "IT" },
            geo: { latitude: 45.5787967, longitude: 10.6848253 },
          },
        }])}</script>
        <a href="https://www.giomas.org/gardareg">Scarica il regolamento ufficiale →</a>
        <a href="/eventi/granfondo-garda-cycling/iscrizioni">Iscriviti subito</a>
        <a href="/eventi/granfondo-garda-cycling/classifiche">Classifiche</a>
      </main>
    `;
    const ev = parseWinningTimeDetail(detailHtml, "https://iscrizioni.winningtime.it/eventi/granfondo-garda-cycling");
    expect(ev).toMatchObject({
      externalId: "winningtime:granfondo-garda-cycling",
      name: "Granfondo Garda Cycling",
      startDate: "2027-03-14",
      placeText: "Garda",
      countryHint: "IT",
      discipline: ["gran_fondo"],
      websiteUrl: "https://www.giomas.org/gardahome",
      regulationsUrl: "https://www.giomas.org/gardareg",
      registrationUrl: "https://iscrizioni.winningtime.it/eventi/granfondo-garda-cycling/iscrizioni",
      resultsUrl: "https://iscrizioni.winningtime.it/eventi/granfondo-garda-cycling/classifiche",
      lat: 45.5787967,
      lng: 10.6848253,
    });
    expect(ev?.evidence?.quote).toContain("14 marzo 2027");

    const circuitIscrHtml = `
      <main>
        <h1>Brixia Adventure MTB</h1>
        <p>Iscriviti al circuito</p>
        <ol>
          <li>
            <h3>GF le Terre di Franciacorta</h3>
            <span class="inline-flex">21 febbraio 2027</span>
            <span class="inline-flex">Adro · IT</span>
            <ul><li><span class="text-ink">Classic</span></li></ul>
          </li>
          <li>
            <h3>GF Xtech Mtb Citta' Di Brescia</h3>
            <span class="inline-flex">21 marzo 2027</span>
            <span class="inline-flex">Brescia · IT</span>
            <ul><li><span class="text-ink">Granfondo</span></li></ul>
          </li>
        </ol>
      </main>
    `;
    const stages = parseWinningTimeCircuitStages(
      circuitIscrHtml,
      "https://iscrizioni.winningtime.it/eventi/brixia-adventure-mtb/iscrizioni",
      ["MTB"],
    );
    expect(stages).toHaveLength(2);
    expect(stages[0]).toMatchObject({
      name: "GF le Terre di Franciacorta",
      startDate: "2027-02-21",
      placeText: "Adro",
      countryHint: "IT",
      discipline: ["xcm"],
      seriesName: "Brixia Adventure MTB",
    });
  });
});

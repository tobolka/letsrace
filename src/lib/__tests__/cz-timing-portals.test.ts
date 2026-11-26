import { describe, expect, it } from "vitest";
import {
  cyklomanParsedEvent,
  inferCzechDiscipline,
  irontimeParsedEvent,
  isCzechCyclingRace,
  parseCzechDate,
  parseCyklomanDetail,
  parseCyklomanList,
  parseIrontimeRaces,
  parseSportovniServisArchiveHtml,
  parseSportovniServisPosts,
  sportovniServisParsedEvent,
  type IrontimeApiRace,
  type SportovniServisWpPost,
} from "@/lib/catalog/cz-timing-portals";

describe("Czech cycling and timing portals", () => {
  it("parses Czech numeric and word dates and rejects invalid calendar dates", () => {
    expect(parseCzechDate("neděle 26.4.2026")).toBe("2026-04-26");
    expect(parseCzechDate("sobota 17. 5. 2027")).toBe("2027-05-17");
    expect(parseCzechDate("26. dubna 2026")).toBe("2026-04-26");
    expect(parseCzechDate("10. října 2027")).toBe("2027-10-10");
    expect(parseCzechDate("31.2.2026")).toBeNull();
  });

  it("excludes non-cycling sports and infers Czech cycling disciplines", () => {
    expect(isCzechCyclingRace("Silniční prolog")).toBe(true);
    expect(isCzechCyclingRace("Moravskotřebovský cyklokros")).toBe(true);
    expect(isCzechCyclingRace("Paperman, triatlon")).toBe(false);
    expect(isCzechCyclingRace("Duatlon Powerman Kunčina")).toBe(false);
    expect(isCzechCyclingRace("Mikulášský běh Čimelice 2026")).toBe(false);
    expect(isCzechCyclingRace("Běh kolem Doubravky 2026")).toBe(false);
    expect(isCzechCyclingRace("MČR koloběžková Rollo liga 2026")).toBe(false);
    expect(isCzechCyclingRace("Pražská chodecká hodinovka 2026")).toBe(false);
    expect(isCzechCyclingRace("Plavecký aquatlon 2026")).toBe(false);
    expect(isCzechCyclingRace("Canicross Lesní 2026")).toBe(false);
    expect(isCzechCyclingRace("Scarpa Skialpnight")).toBe(false);

    expect(inferCzechDiscipline("Moravskotřebovský cyklokros")).toBe("cx");
    expect(inferCzechDiscipline("Silniční časovka jednotlivců")).toBe("tt");
    expect(inferCzechDiscipline("Městské cross country")).toBe("xco");
    expect(inferCzechDiscipline("Cyklomaraton Hřebečské důlní stezky")).toBe("xcm");
    expect(inferCzechDiscipline("Pumptrack Challenge Benátky nad Jizerou 2026")).toBe("bmx");
    expect(inferCzechDiscipline("Závod do vrchu")).toBe("hill_climb");
  });

  it("parses cykloman.cz list and detail pages, skipping rides/news/triathlon/duathlon/gala", () => {
    const listHtml = `<main id="main">
      <div class="cal">
        <div class="cal-head"><h2>Závody a akce 2027</h2></div>
        <section class="cal-month-group" id="mesic-4">
          <article class="cal-card cal-k-ride"><p class="cal-card-date"><strong>21.</strong></p><div class="cal-card-body"><p class="cal-card-type">Vyjížďka</p><h4><a href="https://www.bt2000.cz/?_etapa=1">Hřebeč</a></h4></div></article>
          <article class="cal-card cal-k-race"><p class="cal-card-date"><strong>25.</strong></p><div class="cal-card-body"><p class="cal-card-type">Závod Cykloman</p><h4><a href="/zavody-a-akce/2027/silnicni-prolog">Silniční prolog</a></h4></div></article>
        </section>
        <section class="cal-month-group" id="mesic-5">
          <article class="cal-card cal-k-kids"><p class="cal-card-date"><strong>23.</strong></p><div class="cal-card-body"><p class="cal-card-type">Závod Cyklománek</p><h4><a href="/rozpis-terenni-casovka-cyklomanek-2027">Terénní časovka</a></h4></div></article>
        </section>
        <section class="cal-month-group" id="mesic-8">
          <article class="cal-card cal-k-race"><p class="cal-card-date"><strong>1.</strong></p><div class="cal-card-body"><p class="cal-card-type">Závod Cykloman</p><h4><a href="/zavody-a-akce/2027/paperman-triatlon">Paperman, triatlon</a></h4></div></article>
          <article class="cal-card cal-k-race"><p class="cal-card-date"><strong>22.</strong></p><div class="cal-card-body"><p class="cal-card-type">Závod Cykloman</p><h4><a href="/zavody-a-akce/2027/duatlon-powerman-kuncina">Duatlon Powerman Kunčina</a></h4></div></article>
        </section>
        <section class="cal-month-group" id="mesic-10">
          <article class="cal-card cal-k-outside"><p class="cal-card-date"><strong>9.</strong></p><div class="cal-card-body"><p class="cal-card-type">Závod mimo Cykloman</p><h4><a href="/zavody-a-akce/2027/moravskotrebovsky-cyklokros">Moravskotřebovský cyklokros</a></h4></div></article>
        </section>
        <section class="cal-month-group" id="mesic-11">
          <article class="cal-card cal-k-race"><p class="cal-card-date"><strong>6.</strong></p><div class="cal-card-body"><p class="cal-card-type">Akce</p><h4><a href="/zavody-a-akce/2027/galavecer">Ples cyklistů</a></h4></div></article>
        </section>
      </div>
    </main>`;

    const rows = parseCyklomanList(listHtml, "https://www.cykloman.cz/zavody-a-akce/2027");
    expect(rows).toHaveLength(3);
    expect(rows.map(r => [r.startDate, r.title, r.isKids, r.discipline])).toEqual([
      ["2027-04-25", "Silniční prolog", false, "tt"],
      ["2027-05-23", "Terénní časovka", true, "mtb"],
      ["2027-10-09", "Moravskotřebovský cyklokros", false, "cx"],
    ]);

    const detailHtml = `<main id="main">
      <div id="nav-local">
        <a class="bt-nav" href="/zavody-a-akce/2027/silnicni-prolog/vysledky">Výsledky</a>
        <a class="bt-nav" href="/zavody-a-akce/2027/silnicni-prolog/prihlaseni">Seznam přihlášených</a>
      </div>
      <h2>Silniční prolog</h2>
      <span id="propozice"></span>
      <table class="general"><tbody>
        <tr><th>Na Sportengu</th><td><a href="https://sportengo.cz/zavody/silnicni-prolog-linhartice-chornice">Závod na Sportengo.cz</a></td></tr>
        <tr><th>Druh akce</th><td>Silniční časovka na 11 km</td></tr>
        <tr><th>Termín konání</th><td>neděle 25.4.2027</td></tr>
        <tr><th>Místo a čas startu</th><td><strong><a href="https://mapy.com/s/gepafelono">Linhartice - bývalá restaurace u fotbalového stadionu</a></strong> v 11:00</td></tr>
      </tbody></table>
    </main>`;

    const detail = parseCyklomanDetail(detailHtml, "https://www.cykloman.cz/zavody-a-akce/2027/silnicni-prolog");
    const ev = cyklomanParsedEvent(rows[0]!, detail);
    expect(ev).toMatchObject({
      externalId: "cykloman:zavody-a-akce/2027/silnicni-prolog",
      name: "Silniční prolog",
      startDate: "2027-04-25",
      placeText: "Linhartice",
      countryHint: "CZ",
      discipline: ["tt"],
      registrationUrl: "https://sportengo.cz/zavody/silnicni-prolog-linhartice-chornice",
      regulationsUrl: "https://www.cykloman.cz/zavody-a-akce/2027/silnicni-prolog",
      resultsUrl: "https://www.cykloman.cz/zavody-a-akce/2027/silnicni-prolog/vysledky",
    });
    expect(ev.evidence?.method).toBe("cykloman_cz");
    expect(ev.evidence?.quote).toContain("Linhartice");
  });

  it("filters irontime.cz API races strictly to cycling and builds ParsedEvent", () => {
    const records: IrontimeApiRace[] = [
      {
        id: 3477,
        name: "Všechlapská šlapka",
        race_type: 4,
        race_type_label: { cs: "MTB", en: "MTB" },
        location: "Všechlapy u Nymburka",
        venue: null,
        date_start: "2026-09-12",
        date_end: "2026-09-12",
        status: "finished",
        results_public: true,
        registration_status: "closed",
        gps: "49.803415, 14.385167",
      },
      {
        id: 3408,
        name: "Janovský trhák",
        race_type: 8,
        race_type_label: { cs: "silniční cyklistika", en: "road cycling" },
        location: "Janov",
        date_start: "2026-05-16",
        date_end: "2026-05-16",
        status: "upcoming",
        results_public: false,
        registration_status: "open",
        external_registration_url: "https://example.cz/reg",
      },
      {
        id: 3999,
        name: "Kysucký Gravel",
        race_type: 0,
        race_type_label: { cs: null, en: null },
        location: "Žilina, Slovensko",
        date_start: "2027-06-12",
        date_end: "2027-06-12",
        status: "upcoming",
        registration_status: "open",
      },
      {
        id: 3546,
        name: "Kupkolo.cz Poděbradský Triatlon",
        race_type: 2,
        race_type_label: { cs: "triatlon", en: "triathlon" },
        location: "Poděbrady",
        date_start: "2027-05-23",
      },
      {
        id: 3654,
        name: "Offroad Maraton Šiklův Mlýn",
        race_type: 28,
        race_type_label: { cs: "Offroad", en: "Offroad" },
        location: "Šiklův Mlýn",
        date_start: "2026-11-21",
      },
      {
        id: 3528,
        name: "__TEST nazavody propojení UPDATED — smazat__",
        race_type: 4,
        location: "Praha",
        date_start: "2027-01-16",
      },
    ];

    const rows = parseIrontimeRaces(records);
    expect(rows).toHaveLength(3);
    const events = rows.map(irontimeParsedEvent);
    expect(events[0]).toMatchObject({
      externalId: "irontime:3477",
      placeText: "Všechlapy u Nymburka",
      countryHint: "CZ",
      discipline: ["mtb"],
      lat: 49.803415,
      lng: 14.385167,
      resultsUrl: "https://irontime.cz/vysledky3477/",
    });
    expect(events[1]).toMatchObject({
      externalId: "irontime:3408",
      discipline: ["road"],
      registrationUrl: "https://example.cz/reg",
    });
    expect(events[2]).toMatchObject({
      externalId: "irontime:3999",
      countryHint: "SK",
      discipline: ["gravel"],
      registrationUrl: "https://irontime.cz/prihlaska3999/",
    });
  });

  it("parses sportovniservis.cz WP posts and HTML archives for cycling races only", () => {
    const posts: SportovniServisWpPost[] = [
      {
        id: 17480,
        date: "2026-09-10T10:00:00",
        link: "https://www.sportovniservis.cz/pumptrack-challenge-2026/",
        title: { rendered: "Pumptrack Challenge Benátky nad Jizerou 2026" },
        content: {
          rendered: `<p>sobota 12.9.2026, Benátky nad Jizerou</p><p><a href="https://sportt.cz/datatables/benatky2026">výsledky online</a></p>`,
        },
        tags: [301, 188],
        categories: [3],
      },
      {
        id: 17421,
        date: "2026-08-30T00:07:00",
        link: "https://www.sportovniservis.cz/euro-hry-doksy-2026-cyklistika-casovka-jednotlivci/",
        title: { rendered: "EURO HRY DOKSY 2026 &#8211; cyklistika časovka jednotlivci" },
        content: {
          rendered: `<p>neděle 30.8.2026, Doksy Máchovo jezero, mtb závod 8,2&nbsp;km</p><p><a href="https://www.sportt.cz/datatables/EHD2026">výsledky online</a></p>`,
        },
        tags: [301, 188],
        categories: [3],
      },
      {
        id: 17637,
        date: "2026-11-17T09:55:10",
        link: "https://www.sportovniservis.cz/beh-17-listopadu-v-decine-2026/",
        title: { rendered: "Běh 17. listopadu v Děčíně 2026" },
        content: { rendered: `<p>úterý 17.11.2026, Děčín</p>` },
        tags: [301, 22],
        categories: [3],
      },
      {
        id: 17365,
        date: "2026-07-04T12:00:00",
        link: "https://www.sportovniservis.cz/mosazny-muz-povrly-2026/",
        title: { rendered: "Mosazný Muž Povrly 2026" },
        content: { rendered: `<p>sobota 4.7.2026, 300m plavání, 12km kolo, 3km běh</p>` },
        tags: [301, 152],
        categories: [3],
      },
    ];

    const rows = parseSportovniServisPosts(posts);
    expect(rows).toHaveLength(2);
    const ev0 = sportovniServisParsedEvent(rows[0]!);
    expect(ev0).toMatchObject({
      externalId: "sportovniservis:17480",
      startDate: "2026-09-12",
      placeText: "Benátky nad Jizerou",
      countryHint: "CZ",
      discipline: ["bmx"],
      resultsUrl: "https://sportt.cz/datatables/benatky2026",
    });
    const ev1 = sportovniServisParsedEvent(rows[1]!);
    expect(ev1).toMatchObject({
      externalId: "sportovniservis:17421",
      name: "EURO HRY DOKSY 2026 – cyklistika časovka jednotlivci",
      startDate: "2026-08-30",
      placeText: "Doksy Máchovo jezero",
      discipline: ["mtb"],
    });

    const archiveHtml = `<article id="post-18001">
      <h2 class="entry-title"><a href="https://www.sportovniservis.cz/skoda-mtb-2027/">ŠKODA Pražský MTB pohár – 1.kolo 2027</a></h2>
      <div class="entry-content"><p>sobota 17.4.2027, Lesopark Letňany, Praha 9</p><p><a href="https://sportt.cz/race/9999">online registrace</a></p></div>
    </article>`;
    const archRows = parseSportovniServisArchiveHtml(archiveHtml, "https://www.sportovniservis.cz/tag/mtb/");
    expect(archRows).toHaveLength(1);
    expect(archRows[0]).toMatchObject({
      startDate: "2027-04-17",
      placeText: "Lesopark Letňany",
      registrationUrl: "https://sportt.cz/race/9999",
    });
  });
});

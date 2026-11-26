import { describe, expect, it } from "vitest";
import {
  b4SportParsedEvent,
  b4SportSearchDateUrl,
  dsergebnisParsedEvent,
  extractDsergebnisPlace,
  extractDsergebnisSubpageInfo,
  extractDsergebnisSubpages,
  formatPolishPlace,
  inspectB4SportDetail,
  parseB4SportSearchCards,
  parseDsergebnisCalendar,
} from "@/lib/catalog/de-pl-portals";

describe("DE & PL cycling portals (dsergebnis.de & b4sportonline.pl)", () => {
  it("parses dsergebnis.de calendar rows, multi-day ranges, and filters non-cycling / placeholders", () => {
    const html = `<div id="content_area"><div class="j-text">
      <p>15.11.2026BL Cyclo Cross Stahnsdorf</p>
      <p>03.01.2027 Finale BL Rund um das Vechtaer Reiterwaldstadion</p>
      <p>09./10.01.2027 Shimano DM Cyclo Cross 2027 in Baiersbronn</p>
      <p>12.06.2027 DM EZF U17 und EZF unterm Bremer Stern</p>
      <p>20.06.2027&nbsp;Nievenheimer Ortsschildsprint</p>
      <p>14./15.08.2027 Termin reserviert</p>
      <p>28.11.2026 Absolute Run - Laufladen Bonn Crosslauf</p>
      <p>06.12.206 Niederrhein Gravel Race</p>
    </div></div>`;

    const rows = parseDsergebnisCalendar(html);
    expect(rows).toHaveLength(5);

    expect(rows[0]).toMatchObject({
      startDate: "2026-11-15",
      endDate: null,
      title: "BL Cyclo Cross Stahnsdorf",
      place: "Stahnsdorf",
      discipline: "cx",
    });
    expect(rows[1]).toMatchObject({
      startDate: "2027-01-03",
      place: "Vechta",
      discipline: "cx",
    });
    expect(rows[2]).toMatchObject({
      startDate: "2027-01-09",
      endDate: "2027-01-10",
      place: "Baiersbronn",
      discipline: "cx",
    });
    expect(rows[3]).toMatchObject({
      startDate: "2027-06-12",
      place: "Bremen",
      discipline: "tt",
    });
    expect(rows[4]).toMatchObject({
      startDate: "2027-06-20",
      place: "Nievenheim",
      discipline: "criterium",
    });

    const ev = dsergebnisParsedEvent(rows[2]!);
    expect(ev).toMatchObject({
      externalId: "dsergebnis:2027-01-09:shimano-dm-cyclo-cross-2027-in-baiersbronn",
      name: "Shimano DM Cyclo Cross 2027 in Baiersbronn",
      startDate: "2027-01-09",
      endDate: "2027-01-10",
      placeText: "Baiersbronn",
      countryHint: "DE",
      discipline: ["cx"],
      sourceUrl: "https://www.dsergebnis.de/",
      confidence: 0.85,
      evidence: {
        quote: "09./10.01.2027 Shimano DM Cyclo Cross 2027 in Baiersbronn",
        sourceUrl: "https://www.dsergebnis.de/",
        method: "dsergebnis_de",
        version: "dsergebnis-v1",
      },
    });
  });

  it("extracts dsergebnis.de subpages and official links", () => {
    expect(extractDsergebnisPlace("35. GP von Buchholz")).toBe("Buchholz");
    expect(extractDsergebnisPlace("Rund um das Stadttheater Gießen")).toBe("Gießen");

    const navHtml = `<nav>
      <a href="/shimano-dm-cyclo-cross-2027-baiersbronn/">DM</a>
      <a href="/archiv/cyclo-cross-bundesliga-2025-26/">Archiv</a>
      <a href="/meldelisten/">Meldelisten</a>
    </nav>`;
    expect(extractDsergebnisSubpages(navHtml)).toEqual([
      "https://www.dsergebnis.de/shimano-dm-cyclo-cross-2027-baiersbronn/",
    ]);

    const subHtml = `<div id="content_area">
      Am 09./10.01.2027 finden die Shimano Deutschen Meisterschaften Cyclo Cross in Baiersbronn statt.
      <a href="https://www.cross-baiersbronn.de/dm-27-friedrichstal/">Shimano DM Cyclo Cross 2027</a>
      <a href="https://www.rad-net.de/rad-net-portal/rad-net-ausschreibungen.htm?ID_Veranstaltung=43824">RAD-Net</a>
      <a href="https://race-hub.io/org/dsergebnis">Anmeldung</a>
      <a href="https://results.sporthive.com/for/PC234718">Ergebnisse</a>
    </div>`;
    const info = extractDsergebnisSubpageInfo(
      subHtml,
      "https://www.dsergebnis.de/shimano-dm-cyclo-cross-2027-baiersbronn/",
    );
    expect(info).toMatchObject({
      dates: ["2027-01-10"],
      place: "Baiersbronn",
      websiteUrl: "https://www.cross-baiersbronn.de/dm-27-friedrichstal/",
      regulationsUrl: "https://www.rad-net.de/rad-net-portal/rad-net-ausschreibungen.htm?ID_Veranstaltung=43824",
      registrationUrl: "https://race-hub.io/org/dsergebnis",
      resultsUrl: "https://results.sporthive.com/for/PC234718",
    });
  });

  it("parses b4sportonline.pl search cards, formats Polish places, and excludes running events even with cycling organizer", () => {
    expect(formatPolishPlace("KOSTRZYN NAD ODRĄ")).toBe("Kostrzyn nad Odrą");
    expect(formatPolishPlace("BOGUSŁAWICE")).toBe("Bogusławice");

    const html = `
      <div class="single-search-result-container" data-start-date="2027-04-24">
        <h5>Po Grudzie Bike Race 2027</h5>
        <a href="/kalendarz/searching/organizator/marmed?lang=pl">MARMED</a>
        <a href="/kalendarz/searching/miasto/boguslawice?lang=pl">BOGUSŁAWICE</a>
        <a class="google-calendar" href="http://www.google.com/calendar/render?dates=20270424/20270425">24 Kwietnia 2027</a>
        <a href="/po_grudzie_bike_race">Strona www</a>
        <ul class="card-hidden-events-list">
          <li>Dystans 100km <a href="/po_grudzie_bike_race/zapisy_100/13350">Dołącz do wydarzenia &gt;</a></li>
        </ul>
      </div>
      <div class="single-search-result-container" data-start-date="2026-12-31">
        <h5>XIX BIEG SYLWESTROWY, Brzoza</h5>
        <a href="/kalendarz/searching/organizator/rowerowa_brzoza?lang=pl">Bieg Sylwestrowy Rowerowa Brzoza</a>
        <a href="/kalendarz/searching/miasto/brzoza?lang=pl">BRZOZA</a>
        <a class="google-calendar" href="http://www.google.com/calendar/render?dates=20261231/20270101">31 Grudnia 2026</a>
        <a href="/brzoza">Strona www</a>
      </div>
      <div class="single-search-result-container" data-start-date="2027-06-26">
        <h5>7rivers</h5>
        <a href="/kalendarz/searching/organizator/ultradvent?lang=pl">Stowarzyszenie Ultradventure</a>
        <a href="/kalendarz/searching/miasto/kostrzyn?lang=pl">KOSTRZYN NAD ODRĄ</a>
        <a class="google-calendar" href="http://www.google.com/calendar/render?dates=20270626/20270627">26 Czerwca 2027</a>
        <a href="/7rivers">Strona www</a>
        <a href="/7rivers/zapisy/13501">Dołącz do wydarzenia &gt;</a>
      </div>
    `;

    const cards = parseB4SportSearchCards(html);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({
      id: "13350",
      title: "Po Grudzie Bike Race 2027",
      startDate: "2027-04-24",
      place: "Bogusławice",
      isClearlyCycling: true,
      isClearlyNonCycling: false,
    });
    expect(cards[1]).toMatchObject({
      title: "XIX BIEG SYLWESTROWY, Brzoza",
      isClearlyCycling: false,
      isClearlyNonCycling: true,
    });
    expect(cards[2]).toMatchObject({
      id: "13501",
      title: "7rivers",
      place: "Kostrzyn nad Odrą",
      isClearlyCycling: false,
      isClearlyNonCycling: false,
    });

    const detailCycling = inspectB4SportDetail(
      `<body>7 Rivers Poland Divide 2027 — ultramaraton rowerowy, gravel / MTB <a href="https://7rivers.pl/">https://7rivers.pl/</a></body>`,
      "https://b4sportonline.pl/7rivers",
      "7rivers",
    );
    expect(detailCycling).toMatchObject({
      isCycling: true,
      isNonCycling: false,
      discipline: "gravel",
      websiteUrl: "https://7rivers.pl/",
    });

    const detailRun = inspectB4SportDetail(
      `<body>“Rzeźnik 500”, czyli bieg po Głównym Szlaku Beskidzkim. Dystans: 500 km</body>`,
      "https://b4sportonline.pl/rzeznik_GSB",
      "Rzeźnik 500",
    );
    expect(detailRun.isCycling).toBe(false);

    const detailMulti = inspectB4SportDetail(
      `<body>
        <div>Baltic Bike Challenge <a href="https://jadebbc.pl/regulamin">Regulamin</a> <a href="https://jadebbc.pl/">jadebbc.pl</a></div>
        <div>KONTRA BOLIMOWSKA <a href="https://ultravelo.pl/kontra-regulamin">Regulamin</a> <a href="https://ultravelo.pl/">ultravelo.pl</a></div>
      </body>`,
      "https://b4sportonline.pl/jadebbc",
      "KONTRA Bolimowska 2027",
    );
    expect(detailMulti).toMatchObject({
      isCycling: true,
      websiteUrl: "https://ultravelo.pl/",
      regulationsUrl: "https://ultravelo.pl/kontra-regulamin",
    });

    const srcUrl = b4SportSearchDateUrl(cards[2]!.startDate);
    const ev = b4SportParsedEvent(cards[2]!, {
      sourceUrl: srcUrl,
      discipline: detailCycling.discipline,
      websiteUrl: detailCycling.websiteUrl,
      registrationUrl: "https://b4sportonline.pl/7rivers/zapisy/13501",
    });
    expect(ev).toMatchObject({
      externalId: "b4sport:13501",
      name: "7rivers",
      startDate: "2027-06-26",
      placeText: "Kostrzyn nad Odrą",
      countryHint: "PL",
      discipline: ["gravel"],
      sourceUrl: "https://b4sportonline.pl/kalendarz/searching/od/2027-06-26/do/2027-06-26?lang=pl",
      websiteUrl: "https://7rivers.pl/",
      registrationUrl: "https://b4sportonline.pl/7rivers/zapisy/13501",
      confidence: 0.85,
      evidence: {
        quote: "7rivers\n26 Czerwca 2027",
        sourceUrl: "https://b4sportonline.pl/kalendarz/searching/od/2027-06-26/do/2027-06-26?lang=pl",
        method: "b4sportonline_pl",
        version: "b4sport-v1",
      },
    });
  });
});

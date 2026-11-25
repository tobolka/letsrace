import { describe, expect, it } from "vitest";
import { parseSzcCalendar, szcParsedEvent } from "@/lib/catalog/szc";
import { parseCompetitCycling, parseDatasportPlCycling, polishPortalParsedEvent } from "@/lib/catalog/competit-datasport";
import { enrichTime2WinFromDetail, parseCasomieraPtCycling, parseTime2WinEvents } from "@/lib/catalog/time2win-casomierapt";

describe("cyklistikaszc.sk reader", () => {
  it("parses date ranges, discipline refinement, and PDF regulations links", () => {
    const html = `<table>
      <tr><td class="td1">11.4.2027</td><td class="td2"><strong>SP CC 2027 kritérium</strong></td><td class="td3">Trnava</td><td class="td4"></td><td class="td5"></td><td class="td6"><a href="/kalendar/propozicie/trnava.pdf">P</a></td><td class="td7"></td></tr>
      <tr><td class="td1">16.-20.9.2027</td><td class="td2"><strong>Okolo Slovenska</strong></td><td class="td3">Bratislava</td><td class="td4"></td><td class="td5"></td><td class="td6"></td><td class="td7"></td></tr>
    </table>`;
    const rows = parseSzcCalendar(html, "https://www.cyklistikaszc.sk/sk/cestna-cyklistika/kalendar", "road");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.regulationsUrl).toBe("https://www.cyklistikaszc.sk/kalendar/propozicie/trnava.pdf");
    expect(rows[1]).toMatchObject({ startDate: "2027-09-16", endDate: "2027-09-20" });
    expect(szcParsedEvent(rows[0]!).countryHint).toBe("SK");
  });
});

describe("Polish portals (competit.pl & datasport.pl)", () => {
  it("parses competit.pl cycling cards with official website and registration", () => {
    const html = `<div class="reviews card">
      <a href="/w/8648"></a>
      <a href="https://gravelowagonka.pl" title="WWW"></a>
      <h4>Zimny Gravel 2027</h4>
      <p><i class="bi bi-calendar-week"></i> 2027-04-23 - 2027-04-24</p>
      <p><i class="bi bi-geo-alt"></i>Podborsko<br><span>78-220 Podborsko</span></p>
      <a href="/zgloszenie/8648/">Zgłoś się</a>
    </div>`;
    const rows = parseCompetitCycling(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      externalId: "competit:8648",
      startDate: "2027-04-23",
      endDate: "2027-04-24",
      place: "Podborsko",
      discipline: "gravel",
      websiteUrl: "https://gravelowagonka.pl",
      registrationUrl: "https://competit.pl/zgloszenie/8648/",
    });
    expect(polishPortalParsedEvent(rows[0]!, "competit_pl").countryHint).toBe("PL");
  });

  it("filters datasport.pl to cycling only (skips running cross-country)", () => {
    const html = `
      <div class="event-list-box" data-name="15. Cross Trzebnicki" data-city="Trzebnica" data-date="2027-02-20"><a href="https://liveds.datasport.pl/zawody_files/zawody12966.html">x</a></div>
      <div class="event-list-box" data-name="Bike Maraton Szklarska Poręba" data-city="Szklarska Poręba" data-date="2027-05-15"><a href="https://liveds.datasport.pl/zawody_files/zawody13001.html">x</a></div>
    `;
    const rows = parseDatasportPlCycling(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalId: "datasport-pl:13001", discipline: "xcm" });
  });
});

describe("time2win.at & casomierapt.com readers", () => {
  it("groups multi-day cycling events on time2win.at and skips runs", () => {
    const html = `<script>var x = [{"Date":"2027-06-17","Name":"Alpentour Schladming 2027","EventTypeName":"MTB","Location":"Schladming","LinkEvent":"/event/1123"},{"Date":"2027-06-20","Name":"Alpentour Schladming 2027","EventTypeName":"MTB","Location":"Schladming","LinkEvent":"/event/1123"},{"Date":"2027-05-01","Name":"City Lauf","EventTypeName":"Lauf","Location":"Wien","LinkEvent":"/event/999"}];</script>`;
    const events = parseTime2WinEvents(html);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ startDate: "2027-06-17", endDate: "2027-06-20", discipline: "xcm" });
    const enriched = enrichTime2WinFromDetail(events[0]!, `<html><body>Austria <a href="https://alpentour.at">Web</a></body></html>`);
    expect(enriched.websiteUrl).toBe("https://alpentour.at");
  });

  it("filters casomierapt.com Tribe API to Slovak cycling races", () => {
    const res = parseCasomieraPtCycling([
      { id: 1, title: "Beh svätého Andreja 2026", url: "https://casomierapt.com/event/beh/", start_date: "2026-11-28 10:00:00", venue: { city: "Košice" } },
      { id: 2, title: "ŠKODA MTB Maratón 2027", url: "https://casomierapt.com/event/mtb/", start_date: "2027-05-22 09:00:00", venue: { city: "Rajecké Teplice" } },
    ]);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ externalId: "casomierapt:2", countryHint: "SK", discipline: ["xcm"] });
  });
});

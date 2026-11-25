import { describe, expect, it } from "vitest";
import { drnParsedEvent, drnPracticalDetails, parseDrnDetail, parseDrnList, radNetEventId } from "@/lib/catalog/drn";
import { mapRadgateDiscipline, parseRadgateDetail, parseRadgateYearList, radgateParsedEvent, radgatePracticalDetails } from "@/lib/catalog/radgate";
import { isRadsportEventsRace, radsportEventsParsedEvent, radsportEventsPracticalDetails } from "@/lib/catalog/radsport-events";

describe("deutscherradsportnachwuchs.de reader", () => {
  it("parses embedded locations list and rad-net event ID", () => {
    const html = `<script>var locations = [
      { lat: 50.659, lng: 6.40918, age: '', date: '21.11.2026', order_date: '20261121', state: 'nrw',  state_name: 'Nordrhein-Westfalen', discipline: 'cross' , discipline_name: 'Cross', title: 'Donkey Creek Cyclocross', url: 'https://deutscherradsportnachwuchs.de/event/donkey-creek-cyclocross/', reg_link: '<br><a href="https://rad-net.de//rad-net-portal/rad-net-ausschreibungen.htm?url=%2Fmodules.php%3Fname%3DAusschreibung%26ID_Veranstaltung%3D42683%26mode%3Dascr_detail%26typ%3Di&#038;url_hash=abc" target="_blank">registrieren</a>' },
    ];</script>`;
    const rows = parseDrnList(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe("2026-11-21");
    expect(rows[0]!.discipline).toBe("cx");
    expect(radNetEventId(rows[0]!.radNetUrl)).toBe("42683");
  });

  it("parses detail table and race rows into PracticalDetails", () => {
    const html = `<h1>6. &#8222;3 Rosen Cross&#8220;</h1>
      <table>
        <tr><td>Tag</td><td>Sa, 21.11.2026</td></tr>
        <tr><td>Ort</td><td>85368 Schwimmbad Moosburg</td></tr>
        <tr><td>Veranstalter</td><td>RSV Moosburg</td></tr>
        <tr><td>Start/Ziel</td><td>Stadtbadstraße 13</td></tr>
        <tr><td>Nennung bis</td><td>15.11.2026, 23:59 Uhr</td></tr>
        <tr><td>E-Mail</td><td>severin@formkante.de</td></tr>
        <tr><td>Internet</td><td>https://www.datasport.de/anmeldeservice/rosencrossmoosburg2026</td></tr>
      </table>
      <div class="race_table">
        <table><tr><td>R.1.1</td><td>Jugend männlich U17 Nenngeld: 12,00 €/Nachm. 15,00 €</td><td>30min</td><td>V100/8</td><td>olv</td><td>Start: 12:15 Uhr</td></tr></table>
      </div>`;
    const detail = parseDrnDetail(html, "https://deutscherradsportnachwuchs.de/event/6-3-rosen-cross-2/");
    expect(detail?.startDate).toBe("2026-11-21");
    expect(detail?.registrationClosesAt).toBe("2026-11-15");
    expect(detail?.races).toHaveLength(1);
    expect(detail?.races[0]).toMatchObject({ category: "Jugend männlich U17", feeEur: 12, startTime: "12:15" });
    const pd = drnPracticalDetails(detail!);
    expect(pd.fees?.value).toHaveLength(1);
    expect(pd.schedule?.value[0]?.time).toBe("12:15");
    expect(pd.categories?.value[0]?.label).toBe("Jugend männlich U17");
    const ev = drnParsedEvent({ title: "6. 3 Rosen Cross", url: detail!.url, date: "2026-11-21", discipline: "cx", stateName: "Bayern", lat: null, lng: null, radNetUrl: null }, detail!, "Tag Sa, 21.11.2026");
    expect(ev.countryHint).toBe("DE");
  });
});

describe("radgate.de reader", () => {
  it("parses year list rows with dates and confirmation status", () => {
    const html = `<ul>
      <li class="season-row"><span class="season-date"><small>Do</small>26.11.</span><span class="season-main"><a href="/ausschreibung/4-jours-de-geneve-2026-les-acacias-ge-098b1fb6-dd49-531e-b448-6a2b43911090">4 jours de Genève 2026</a><span class="season-meta"><span class="season-status">Termin steht</span><span>Les Acacias GE</span><span>Bahnradsport</span></span></span></li>
    </ul>`;
    const rows = parseRadgateYearList(html, 2026);
    expect(rows).toEqual([{
      title: "4 jours de Genève 2026",
      url: "https://radgate.de/ausschreibung/4-jours-de-geneve-2026-les-acacias-ge-098b1fb6-dd49-531e-b448-6a2b43911090",
      date: "2026-11-26",
      place: "Les Acacias GE",
      disciplineLabel: "Bahnradsport",
      confirmed: true,
    }]);
  });

  it("parses SportsEvent JSON-LD and schedule blocks", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "SportsEvent",
      name: "3. CCT Pokal - Neujahrescross",
      sport: "Cyclocross",
      startDate: "2027-01-03T09:30:00+01:00",
      location: { name: "04880 Elsnig", address: { addressLocality: "Elsnig", postalCode: "04880", addressCountry: "DE" }, geo: { latitude: 51.59, longitude: 12.95 } },
      organizer: { name: "SSV 1952 Torgau e.V." },
    })}</script>
    <div class="public-schedule-block"><h3>09:30 Uhr · Rennen 1</h3><ul class="public-categories"><li><strong>Schüler U11</strong><span>1 Runden</span></li></ul></div>
    <a href="https://example.de/ausschreibung">Offizielle Quelle ansehen</a>`;
    const detail = parseRadgateDetail(html, "https://radgate.de/ausschreibung/3-cct-pokal-da497260-613f-54dd-bc33-376ad98b308f");
    expect(detail?.countryCode).toBe("DE");
    expect(detail?.discipline).toBe("cx");
    expect(detail?.officialUrl).toBe("https://example.de/ausschreibung");
    const pd = radgatePracticalDetails(detail!);
    expect(pd.schedule?.value[0]?.time).toBe("09:30");
    expect(pd.categories?.value[0]?.label).toBe("Schüler U11");
    expect(radgateParsedEvent(detail!, "3. CCT Pokal").externalId).toBe("radgate:da497260-613f-54dd-bc33-376ad98b308f");
    expect(mapRadgateDiscipline("Bahnradsport")).toBe("track");
  });
});

describe("radsport-events.de reader", () => {
  it("keeps real races and skips RTF/triathlon/virtual/tentative", () => {
    expect(isRadsportEventsRace({ id: 1, title: "vRTF", eventDate: "2027-01-01", eventType: "VIRTUELLE_RTF", status: "PUBLISHED" })).toBe(false);
    expect(isRadsportEventsRace({ id: 2, title: "Triathlon", eventDate: "2027-05-01", eventType: "TRIATHLON", status: "PUBLISHED" })).toBe(false);
    expect(isRadsportEventsRace({ id: 3, title: "Tentative", eventDate: "2027-05-01", eventType: "MTB_MARATHON", tentative: true, status: "PUBLISHED" })).toBe(false);
    const item = {
      id: 27574,
      title: "Ultrabiking Sardinia",
      city: "Alghero",
      postalCode: "07041",
      country: "IT",
      eventDate: "2027-10-13",
      endDate: "2027-10-17",
      organizer: "UltraBiking Sardinia Asd",
      organizerUrl: "https://www.ultrabikingsardinia.com/",
      category: "ROAD",
      eventType: "ULTRA",
      status: "PUBLISHED",
      distances: [{ distanceKm: 1000, elevationMeters: 19000, label: null }],
      links: [{ url: "https://www.ultrabikingsardinia.com/iscrizione.html", type: "REGISTRATION", visibility: "PUBLIC" }],
    };
    const ev = radsportEventsParsedEvent(item);
    expect(ev?.countryHint).toBe("IT");
    expect(ev?.discipline).toEqual(["road"]);
    expect(ev?.registrationUrl).toBe("https://www.ultrabikingsardinia.com/iscrizione.html");
    const pd = radsportEventsPracticalDetails(item);
    expect(pd.routes?.value[0]).toMatchObject({ distanceKm: 1000, elevationM: 19000 });
  });
});

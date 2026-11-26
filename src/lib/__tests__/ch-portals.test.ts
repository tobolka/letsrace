import { describe, expect, it } from "vitest";
import {
  datasportParsedEvent,
  dedupeDatasportEditions,
  extractTrackMaxxJson,
  inferDatasportCountry,
  isDatasportCycling,
  isTrackMaxxCycling,
  parseTrackMaxxCycling,
  type DatasportEdition,
  type TrackMaxxRawEvent,
} from "@/lib/catalog/ch-portals";

describe("Swiss & Alpine timing portals (trackmaxx.ch, datasport.com)", () => {
  it("parses TrackMaxx embedded JSON, keeps cycling events, and excludes running/triathlon/season-long entries", () => {
    const events: TrackMaxxRawEvent[] = [
      {
        name: "Swiss Cycling Alpenbrevet 2027",
        webtag: "AB27",
        racedate: "2027-09-04T00:00:00",
        racedate2: null,
        city: "Andermatt",
        showresultlist: false,
        showregistration: true,
        hideregistration: false,
        linkevent: "https://www.alpenbrevet.ch/",
        linkregistration: "",
        linkresultlist: "",
        eventtype: "Cycling",
        mapcoordinates: "46.631954,8.591776",
      },
      {
        name: "Gravel Trans Jura 2027",
        webtag: "GTJ27",
        racedate: "2027-06-02T00:00:00",
        racedate2: "2027-06-08T00:00:00",
        city: "",
        showregistration: true,
        hideregistration: false,
        linkevent: "https://ridegravel.ch/transjura",
        eventtype: "",
        mapcoordinates: "",
      },
      {
        name: "Gravel Trans Jura Individual 2027",
        webtag: "GTJI27",
        racedate: "2027-04-01T00:00:00",
        racedate2: "2027-10-31T00:00:00",
        city: "",
        linkevent: "https://ridegravel.ch/transjura",
        eventtype: "",
      },
      {
        name: "Arosa Trailrun 2027",
        webtag: "ATR27",
        racedate: "2027-09-11T00:00:00",
        city: "Arosa",
        eventtype: "Running",
      },
      {
        name: "Pho3nix Kids Triathlon by Nicola Spirig 2026 (Bülach)",
        webtag: "NS26-BUE",
        racedate: "2026-05-30T00:00:00",
        city: "Bülach",
        eventtype: "",
      },
    ];
    const html = `<script>const e = new(events);e.init();e.data=${JSON.stringify(events)};e.init();</script>`;
    expect(extractTrackMaxxJson(html)).toHaveLength(5);
    expect(isTrackMaxxCycling(events[2]!)).toBe(false);

    const parsed = parseTrackMaxxCycling(html);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      externalId: "trackmaxx:ab27",
      name: "Swiss Cycling Alpenbrevet 2027",
      startDate: "2027-09-04",
      placeText: "Andermatt",
      countryHint: "CH",
      discipline: ["gran_fondo"],
      websiteUrl: "https://www.alpenbrevet.ch/",
      registrationUrl: "https://trackmaxx.ch/registration/?race=ab27",
      lat: 46.631954,
      lng: 8.591776,
    });
    expect(parsed[0]!.evidence?.quote).toContain("04.09.2027");

    expect(parsed[1]).toMatchObject({
      externalId: "trackmaxx:gtj27",
      startDate: "2027-06-02",
      endDate: "2027-06-08",
      placeText: "Jura",
      countryHint: "CH",
      discipline: ["gravel"],
    });
    expect(parsed[1]!.evidence?.quote).toContain("02.06.2027 - 08.06.2027");
  });

  it("parses Datasport editions, maps CH/AT/DE/IT countries, excludes running/triathlon/non-covered countries, and dedupes slugs", () => {
    const chRoad: DatasportEdition = {
      id: 8326,
      raceNr: 29400,
      name: "Engadin Radmarathon 2027",
      slug: "engadin-radmarathon-2027",
      editionFrom: "2027-07-02",
      editionTo: "2027-07-04",
      organizerLink: "https://rad-marathon.ch/",
      onRegLink: "https://registration.datasport.com/engadin-radmarathon-2027",
      onRegLinkTo: "2027-07-02T00:00:00",
      showLinkRegistration: true,
      resultLink: "https://datasport.com/race/engadin-radmarathon-2027",
      cancelled: false,
      visible: true,
      regions: [{ id: 13, countryCode: "CHE", name: { de: "Kanton Graubünden" } }],
      sportTypes: [{ de: "Rennrad", en: "Road Bike" }],
      disciplines: [{ de: "Radmarathon", en: "Bike marathon" }],
    };

    const itRoadNoScheme: DatasportEdition = {
      id: 8282,
      name: "40. Maratona dles Dolomites - Enel 2027",
      slug: "40-maratona-dles-dolomites-enel-2027",
      editionFrom: "2027-07-04",
      editionTo: "2027-07-04",
      organizerLink: "www.maratona.it",
      onRegLink: "https://registration.datasport.com/40-maratona-dles-dolomites-enel-2027",
      regions: [{ id: 10, countryCode: "ITA", name: { de: "Trentino-Südtirol" } }],
      sportTypes: [{ de: "Rennrad", en: "Road Bike" }],
      disciplines: [{ de: "Strassenrennen", en: "Road Race" }],
    };

    const atBogusCoords: DatasportEdition = {
      id: 8239,
      name: "MYTRANSALP 2027",
      slug: "my-transalp-2027",
      editionFrom: "2027-06-20",
      editionTo: "2027-06-26",
      organizerLink: "https://www.mytransalp.com",
      regions: [{ id: 23, countryCode: "AUT", name: { de: "Land Tirol" } }],
      sportTypes: [{ de: "Rennrad", en: "Road Bike" }],
      disciplines: [{ de: "Etappenrennen", en: "Stage Race" }],
    };

    const deMtb: DatasportEdition = {
      id: 8383,
      name: "Assa Abloy Albstadt Bike Marathon 2027",
      slug: "assa-abloy-albstadt-bike-marathon-2027",
      editionFrom: "2027-07-09",
      editionTo: "2027-07-10",
      regions: [{ id: 40, countryCode: "DEU", name: { de: "Land Baden-Württemberg" } }],
      sportTypes: [{ de: "MTB", en: "MTB" }],
      disciplines: [{ de: "Cross Country", en: "Cross Country" }, { de: "Bike Marathon", en: "Bike Marathon" }],
    };

    const nonCoveredCountry: DatasportEdition = {
      id: 9001,
      name: "Oslo Cycling Classic 2027",
      slug: "oslo-cycling-classic-2027",
      editionFrom: "2027-08-01",
      regions: [{ id: 99, countryCode: "NOR", name: { de: "Norwegen" } }],
      sportTypes: [{ de: "Rennrad", en: "Road Bike" }],
    };

    const runEvent: DatasportEdition = {
      id: 3676,
      name: "Course de l'Escalade 2026",
      slug: "course-de-l-escalade-2026",
      editionFrom: "2026-12-05",
      regions: [{ id: 1, countryCode: "CHE", name: { de: "Kanton Genf" } }],
      sportTypes: [{ de: "Lauf", en: "Run" }],
    };

    const mixedRunPrimary: DatasportEdition = {
      id: 8361,
      name: "Courir pour Aider 2027",
      slug: "courir-pour-aider-2027",
      editionFrom: "2027-05-22",
      regions: [{ id: 1, countryCode: "CHE", name: { de: "Kanton Genf" } }],
      sportTypes: [{ de: "Lauf", en: "Run" }, { de: "Rennrad", en: "Road Bike" }],
      disciplines: [{ de: "Volkslauf" }, { de: "Gravel" }],
    };

    const evCh = datasportParsedEvent(chRoad, {
      town: { de: "Zernez" },
      preciseLocation: { latitude: 46.699914, longitude: 10.094241 },
    });
    expect(evCh).toMatchObject({
      externalId: "datasport:8326",
      name: "Engadin Radmarathon 2027",
      startDate: "2027-07-02",
      endDate: "2027-07-04",
      placeText: "Zernez",
      countryHint: "CH",
      discipline: ["gran_fondo"],
      websiteUrl: "https://rad-marathon.ch/",
      registrationClosesAt: "2027-07-02",
      lat: 46.699914,
      lng: 10.094241,
    });
    expect(evCh?.evidence?.quote).toContain("02.07.2027 - 04.07.2027");

    const evIt = datasportParsedEvent(itRoadNoScheme, { town: { de: "Badia (BZ)" } });
    expect(evIt).toMatchObject({
      countryHint: "IT",
      placeText: "Badia (BZ)",
      websiteUrl: "https://www.maratona.it/",
      discipline: ["road_race"],
    });
    expect(evIt?.endDate).toBeUndefined();

    const evAt = datasportParsedEvent(atBogusCoords, {
      town: { de: "Lienz" },
      preciseLocation: { latitude: 1, longitude: 2 },
    });
    expect(evAt).toMatchObject({ countryHint: "AT", placeText: "Lienz", discipline: ["road"] });
    expect(evAt?.lat).toBeUndefined();

    const evDe = datasportParsedEvent(deMtb, { town: { de: "Albstadt" } });
    expect(evDe).toMatchObject({ countryHint: "DE", placeText: "Albstadt", discipline: ["xco", "xcm"] });

    expect(inferDatasportCountry(nonCoveredCountry)).toBeNull();
    expect(datasportParsedEvent(nonCoveredCountry, { town: { de: "Oslo" } })).toBeNull();
    expect(isDatasportCycling(runEvent)).toBe(false);
    expect(isDatasportCycling(mixedRunPrimary)).toBe(false);

    // Duplicate slug resolution prefers active numbered edition
    const staleDraft: DatasportEdition = {
      id: 8244,
      raceNr: null,
      name: "Eiger Bike-Challenge 2027",
      slug: "eiger-bike-challenge-2027",
      editionFrom: "2027-08-07",
      onRegLinkTo: "2026-08-09T12:00:00",
      raceResultId: null,
      regions: [{ countryCode: "CHE", name: { de: "Kanton Bern" } }],
      sportTypes: [{ de: "MTB" }],
    };
    const activeEdition: DatasportEdition = {
      ...staleDraft,
      id: 8245,
      raceNr: 29320,
      editionFrom: "2027-08-14",
      onRegLinkTo: "2027-08-15T13:00:00",
      raceResultId: 414067,
    };
    const deduped = dedupeDatasportEditions([staleDraft, activeEdition]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]!.id).toBe(8245);

    // Unknown country is not blindly defaulted to CH
    const unknownCountry: DatasportEdition = {
      id: 9999,
      name: "Mystery Gravel 2027",
      slug: "mystery-gravel-2027",
      editionFrom: "2027-09-01",
      regions: [],
      sportTypes: [{ de: "MTB" }],
    };
    expect(inferDatasportCountry(unknownCountry)).toBeNull();
  });
});

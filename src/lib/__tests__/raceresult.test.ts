import { describe, expect, it } from "vitest";
import { parseRaceresultListPayload } from "@/lib/watcher/extractors/raceresult";

describe("RaceResult events listing", () => {
  it("keeps cycling events in CZ/DE/SK/AT/PL and skips other countries and old years", () => {
    const payload = [
      {
        Mode: "next",
        Events: [
          {
            id: 393563,
            name: "Trnavská cyklistická liga 2026",
            dateFrom: "2026-08-19",
            dateTo: "2026-08-19",
            location: "Voderady",
            countryCode: "SK",
            eventType: 11,
            eventTypeName: "Cycling",
            lat: 48.2766,
            lng: 17.5584,
          },
          {
            id: 1,
            name: "Old CX",
            dateFrom: "2020-01-01",
            dateTo: "2020-01-01",
            location: "Praha",
            countryCode: "CZ",
            eventType: 20,
            eventTypeName: "Cyclocross",
            lat: 50.08,
            lng: 14.43,
          },
          {
            id: 2,
            name: "French road",
            dateFrom: "2026-09-01",
            dateTo: "2026-09-01",
            location: "Paris",
            countryCode: "FR",
            eventType: 11,
            eventTypeName: "Cycling",
            lat: 48.85,
            lng: 2.35,
          },
          {
            id: 376441,
            name: "aAGS Semmering DH",
            dateFrom: "2026-09-05",
            dateTo: "2026-09-05",
            location: "Semmering",
            countryCode: "AT",
            eventType: 2,
            eventTypeName: "Mountain Bike",
            lat: 47.63,
            lng: 15.83,
          },
        ],
      },
    ];
    const events = parseRaceresultListPayload(payload, "https://my.raceresult.com/events/");
    expect(events.map((e) => e.name)).toEqual([
      "Trnavská cyklistická liga 2026",
      "aAGS Semmering DH",
    ]);
    expect(events[0]?.discipline).toEqual(["road"]);
    expect(events[1]?.discipline).toEqual(["dh"]);
    expect(events[0]?.registrationUrl).toBe("https://my.raceresult.com/393563/");
    expect(events[0]?.countryHint).toBe("SK");
  });
});

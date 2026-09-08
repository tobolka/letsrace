import { describe, expect, it } from "vitest";
import { isHomeMapCountry, isNonRaceEventName, isPublicMapWorthy, PUBLIC_EVENT_STATUSES, shouldHideFromMap, shouldSkipUnlinkedDumpInsert } from "@/lib/event-visibility";
import { isIsoDay } from "@/lib/events";

describe("public map quality gate", () => {
  it("keeps home-country races without an enter link", () => {
    expect(isHomeMapCountry("CZ")).toBe(true);
    expect(
      isPublicMapWorthy({
        websiteUrl: null,
        registrationUrl: null,
        location: { countryCode: "CZ" },
      }),
    ).toBe(true);
    expect(
      isPublicMapWorthy({
        websiteUrl: null,
        registrationUrl: null,
        location: { countryCode: "SK" },
      }),
    ).toBe(true);
    expect(
      isPublicMapWorthy({
        websiteUrl: null,
        registrationUrl: null,
        location: { countryCode: "CH" },
      }),
    ).toBe(true);
    expect(
      isPublicMapWorthy({
        websiteUrl: null,
        registrationUrl: null,
        location: { countryCode: "SI" },
      }),
    ).toBe(false);
  });

  it("parks thin rows from roadmap markets without a website or registration URL", () => {
    // France is still listing-only; Italy now carries its own FCI race pages.
    expect(
      isPublicMapWorthy({
        websiteUrl: null,
        registrationUrl: null,
        location: { countryCode: "FR" },
      }),
    ).toBe(false);
    expect(
      isPublicMapWorthy({
        websiteUrl: "https://vangillerncup.cz",
        registrationUrl: null,
        location: { countryCode: "FR" },
      }),
    ).toBe(true);
    expect(
      isPublicMapWorthy({
        websiteUrl: null,
        registrationUrl: null,
        location: { countryCode: "IT" },
      }),
    ).toBe(true);
  });

  it("does not treat federation dumps as an official enter link", () => {
    expect(
      isPublicMapWorthy({
        websiteUrl: "https://www.federciclismo.it/it/event/123",
        registrationUrl: null,
        location: { countryCode: "FR" },
      }),
    ).toBe(false);
    expect(
      isPublicMapWorthy({
        websiteUrl: "https://www.uci.org/competition-details/123",
        registrationUrl: null,
        location: { countryCode: "FR" },
      }),
    ).toBe(false);
    expect(
      isPublicMapWorthy({
        websiteUrl: null,
        registrationUrl: "https://my.raceresult.com/379367/registration",
        location: { countryCode: "IT" },
      }),
    ).toBe(true);
  });

  it("skips inserting unlinked dumps when the country is known", () => {
    expect(
      shouldSkipUnlinkedDumpInsert({
        websiteUrl: null,
        registrationUrl: null,
        location: { countryCode: "FR" },
      }),
    ).toBe(true);
    expect(
      shouldSkipUnlinkedDumpInsert({
        websiteUrl: "https://www.federciclismo.it/it/event/123",
        registrationUrl: null,
        location: { countryCode: "FR" },
      }),
    ).toBe(true);
    // Italy is a listing market now — its rows are inserted, not skipped.
    expect(
      shouldSkipUnlinkedDumpInsert({
        websiteUrl: null,
        registrationUrl: null,
        location: { countryCode: "IT" },
      }),
    ).toBe(false);
    expect(
      shouldSkipUnlinkedDumpInsert({
        websiteUrl: null,
        registrationUrl: null,
        location: { countryCode: "CZ" },
      }),
    ).toBe(false);
    expect(
      shouldSkipUnlinkedDumpInsert({
        websiteUrl: null,
        registrationUrl: null,
        location: { countryCode: null },
      }),
    ).toBe(false);
    expect(
      shouldSkipUnlinkedDumpInsert({
        websiteUrl: "https://maratona.it",
        registrationUrl: null,
        location: { countryCode: "IT" },
      }),
    ).toBe(false);
  });

  it("keeps unconfirmed TBC dates off the public map", () => {
    expect(PUBLIC_EVENT_STATUSES).not.toContain("tbc");
    expect(PUBLIC_EVENT_STATUSES).toContain("scheduled");
    expect(PUBLIC_EVENT_STATUSES).toContain("postponed");
  });
});

describe("non-race listings", () => {
  it("hides awards nights and ceremonies", () => {
    expect(isNonRaceEventName("Slavnostní večer")).toBe(true);
    expect(isNonRaceEventName("Slavnostní vyhlášení")).toBe(true);
    expect(shouldHideFromMap("Slavnostní večer", "scheduled", "public")).toBe(true);
    expect(isNonRaceEventName("Siegerehrung Pražský pohár MTB")).toBe(true);
  });

  it("keeps real races", () => {
    expect(isNonRaceEventName("Van Gillern Cup 2026")).toBe(false);
    expect(isNonRaceEventName("Přestavlcký Vlk MTB 2026")).toBe(false);
    expect(isNonRaceEventName("Campionato Italiano XCO")).toBe(false);
    expect(shouldHideFromMap("Van Gillern Cup 2026", "scheduled", "public")).toBe(false);
  });
});

describe("isIsoDay", () => {
  // `?dateFrom=notadate` reached PostgREST as a date and came back a 500,
  // taking the whole race list with it.
  it("takes a real calendar day", () => {
    expect(isIsoDay("2026-09-08")).toBe(true);
    expect(isIsoDay("2028-02-29")).toBe(true); // 2028 is a leap year
  });

  it("refuses anything else", () => {
    for (const bad of [
      "notadate",
      "2026-13-45",
      "2026-02-29", // 2026 is not a leap year
      "2026-02-30",
      "2026-9-8",
      "2026-09-08T00:00:00Z",
      "",
      null,
      undefined,
    ]) {
      expect(isIsoDay(bad), String(bad)).toBe(false);
    }
  });
});

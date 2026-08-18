import { describe, expect, it } from "vitest";
import { isHomeMapCountry, isPublicMapWorthy, PUBLIC_EVENT_STATUSES } from "@/lib/event-visibility";

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

  it("parks thin Italy/FCI rows without a website or registration URL", () => {
    expect(
      isPublicMapWorthy({
        websiteUrl: null,
        registrationUrl: null,
        location: { countryCode: "IT" },
      }),
    ).toBe(false);
    expect(
      isPublicMapWorthy({
        websiteUrl: "https://vangillerncup.cz",
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
        location: { countryCode: "IT" },
      }),
    ).toBe(false);
    expect(
      isPublicMapWorthy({
        websiteUrl: "https://www.uci.org/competition-details/123",
        registrationUrl: null,
        location: { countryCode: "IT" },
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

  it("keeps unconfirmed TBC dates off the public map", () => {
    expect(PUBLIC_EVENT_STATUSES).not.toContain("tbc");
    expect(PUBLIC_EVENT_STATUSES).toContain("scheduled");
    expect(PUBLIC_EVENT_STATUSES).toContain("postponed");
  });
});

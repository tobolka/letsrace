import { describe, expect, it } from "vitest";
import { isHomeMapCountry, isPublicMapWorthy } from "@/lib/event-visibility";

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
});

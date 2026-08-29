import { describe, expect, it } from "vitest";
import {
  allowsUnlinkedPublicListing,
  coldStartCenter,
  explorerWeight,
  isPlaceSearchStopword,
  isPublicMapMarket,
  pickerCountryCodes,
  resolveCoveragePlace,
} from "@/lib/coverage";

describe("coverage markets", () => {
  it("lets covered markets list without an enter link — the roadmap ones may not", () => {
    expect(allowsUnlinkedPublicListing("CZ")).toBe(true);
    expect(allowsUnlinkedPublicListing("de")).toBe(true);
    expect(allowsUnlinkedPublicListing("CH")).toBe(true);
    // Italy joined them: FCI's own public race page stands in as the listing
    // link, so a pin without an organiser URL still leads somewhere.
    expect(allowsUnlinkedPublicListing("IT")).toBe(true);
    expect(allowsUnlinkedPublicListing("FR")).toBe(false);
  });

  it("flies the map to a country or vacation alias without Nominatim", () => {
    const italy = resolveCoveragePlace("Itálie");
    expect(italy?.countryCode).toBe("IT");
    expect(italy?.bounds.south).toBeLessThan(40);
    expect(resolveCoveragePlace("italy")?.countryCode).toBe("IT");
    expect(resolveCoveragePlace("německo")?.countryCode).toBe("DE");
    expect(resolveCoveragePlace("garda")?.countryCode).toBe("IT");
    expect(resolveCoveragePlace("dolomity")?.countryCode).toBe("IT");
  });

  it("does not treat race tokens as places", () => {
    expect(isPlaceSearchStopword("cup")).toBe(true);
    expect(isPlaceSearchStopword("MTB")).toBe(true);
    expect(resolveCoveragePlace("cup")).toBeNull();
  });

  it("cold-starts the camera on the speaker's market, English on Czechia", () => {
    expect(coldStartCenter("cs")).toEqual({ lng: 15.5, lat: 49.75 });
    expect(coldStartCenter("sk").lng).toBeCloseTo(19.15);
    expect(coldStartCenter("pl").lng).toBeCloseTo(19.4);
    expect(coldStartCenter("en")).toEqual(coldStartCenter("cs"));
  });

  it("keeps picker order home-first so a new country is one market row", () => {
    const codes = pickerCountryCodes();
    expect(codes.slice(0, 7)).toEqual(["CZ", "SK", "AT", "DE", "PL", "CH", "IT"]);
    expect(explorerWeight("cz")).toBe("home");
    expect(explorerWeight("it")).toBe("expanding");
    expect(explorerWeight("fr")).toBe("other");
  });

  it("offers core, neighbours and expanding Italy — listed Europe stays a reservation", () => {
    expect(isPublicMapMarket("CZ")).toBe(true);
    expect(isPublicMapMarket("SK")).toBe(true);
    expect(isPublicMapMarket("IT")).toBe(true);
    expect(isPublicMapMarket("FR")).toBe(false);
    expect(isPublicMapMarket("GB")).toBe(false);
    expect(isPublicMapMarket("SI")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  allowsUnlinkedPublicListing,
  coldStartCenter,
  explorerWeight,
  isPlaceSearchStopword,
  pickerCountryCodes,
  resolveCoveragePlace,
} from "@/lib/coverage";

describe("coverage markets", () => {
  it("lets home calendars list without an enter link, not Italy", () => {
    expect(allowsUnlinkedPublicListing("CZ")).toBe(true);
    expect(allowsUnlinkedPublicListing("de")).toBe(true);
    expect(allowsUnlinkedPublicListing("CH")).toBe(true);
    expect(allowsUnlinkedPublicListing("IT")).toBe(false);
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
});

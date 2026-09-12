import { describe, expect, it } from "vitest";
import { cleanGeocodeQuery, geocodeFromGazetteer, geocodePlace } from "@/lib/geocode";

describe("country-only race venues", () => {
  it.each(["CZ", "SK", "DE", "AT", "PL", "Austria", "Germany", "Slovakia"])(
    "does not geocode %s as a race start", async (place) => {
      expect(cleanGeocodeQuery(place).query).toBe("");
      expect(geocodeFromGazetteer(place)).toBeNull();
      expect(await geocodePlace(place)).toBeNull();
    },
  );
});

describe("Austrian club names as places", () => {
  it("pins the town hidden in Cycling Austria club + bundesland labels", () => {
    expect(geocodeFromGazetteer("RV Innsbrucker Schwalben — Tirol", "AT")?.countryCode).toBe(
      "AT",
    );
    expect(geocodeFromGazetteer("ARBÖ ASKÖ RC Linz Mc Donald`s — Ober", "AT")?.lat).toBeCloseTo(
      48.3069,
      3,
    );
    expect(geocodeFromGazetteer("Mountain Sport Union Klagenfurt — Kärnten", "AT")?.lng).toBeCloseTo(
      14.3053,
      3,
    );
    expect(geocodeFromGazetteer("Radclub ARBÖ St. Pölten — Niederösterreich", "AT")?.lat).toBeCloseTo(
      48.2058,
      3,
    );
    expect(geocodeFromGazetteer("RSC Exmanco ÖAMTC Bad Ischl — Ober", "AT")?.lat).toBeCloseTo(
      47.711,
      3,
    );
    expect(geocodeFromGazetteer("HRC ARBÖ Alpina Wolfsberg Optik Scharf — Kärnten", "AT")?.lat).toBeCloseTo(
      46.839,
      2,
    );
  });

  it("pins a Polish county dump to the county town", () => {
    expect(geocodeFromGazetteer("POWIAT WOŁOMIŃSKI", "PL")?.countryCode).toBe("PL");
  });
});

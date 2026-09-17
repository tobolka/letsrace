import { describe, expect, it } from "vitest";
import { disciplinesFromCsv, audienceHintFromCsv } from "@/lib/catalog/csv-series-meta";

describe("csv-series-meta", () => {
  it("maps MTB XCO / XCC cups", () => {
    expect(disciplinesFromCsv("MTB", "XCO / XCC")).toEqual(
      expect.arrayContaining(["mtb", "xco", "xcc"]),
    );
  });

  it("maps road amateur leagues with TT", () => {
    expect(disciplinesFromCsv("SILNICE", "silnice / časovka")).toEqual(
      expect.arrayContaining(["road", "tt"]),
    );
  });

  it("maps cyclocross", () => {
    expect(disciplinesFromCsv("CYKLOKROS", "CX")).toEqual(["cx"]);
  });

  it("maps enduro + kids audience", () => {
    expect(disciplinesFromCsv("MTB", "Enduro / gravity")).toEqual(
      expect.arrayContaining(["mtb", "enduro"]),
    );
    expect(audienceHintFromCsv("FOX Grom Enduro", "Enduro", "").audience).toBe("kids");
    expect(audienceHintFromCsv("Dětský MTB Cup", "XC", "").ageCategories).toContain("kids");
  });

  it("maps MIX series to both parents when podtyp spans them", () => {
    const d = disciplinesFromCsv("MIX", "MTB XCM + silnice");
    expect(d).toEqual(expect.arrayContaining(["mtb", "xcm", "road"]));
  });
});

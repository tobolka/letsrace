import { describe, expect, it } from "vitest";
import {
  countryChange,
  seriesCountryCodes,
  seriesCountryKey,
  seriesInCountries,
  seriesOutsideCountries,
  toggleIn,
  type SeriesOption,
} from "@/lib/explore-filters";

const cup = (slug: string, countryCode: string | null): SeriesOption => ({
  slug,
  name: slug,
  eventCount: 1,
  countryCode,
});

const SERIES = [cup("kpz", "cz"), cup("talent", "CZ"), cup("giro", "IT"), cup("uci-world", null), cup("tour", "")];

describe("toggleIn", () => {
  it("adds what is missing and removes what is there, without touching the original", () => {
    const list = ["mtb"];
    expect(toggleIn(list, "road")).toEqual(["mtb", "road"]);
    expect(toggleIn(list, "mtb")).toEqual([]);
    expect(list).toEqual(["mtb"]);
  });
});

describe("series countries", () => {
  it("reads a cup's country, and anything that is not a two-letter code as international", () => {
    expect(seriesCountryKey(" cz ")).toBe("CZ");
    expect(seriesCountryKey(null)).toBe("INT");
    expect(seriesCountryKey("")).toBe("INT");
    expect(seriesCountryKey("CZE")).toBe("INT");
  });

  it("lists the countries that have a cup of their own, once each", () => {
    expect(seriesCountryCodes(SERIES, "en").sort()).toEqual(["CZ", "IT"]);
  });

  it("shows every cup when no country is chosen, else the ones that fit", () => {
    expect(seriesInCountries(SERIES, [])).toHaveLength(5);
    expect(seriesInCountries(SERIES, ["CZ"]).map((s) => s.slug)).toEqual(["kpz", "talent"]);
  });
});

describe("seriesOutsideCountries", () => {
  it("drops a national cup from another country, never an international one", () => {
    expect(seriesOutsideCountries("IT", "giro", ["CZ"])).toBe(true);
    expect(seriesOutsideCountries("IT", "giro", ["IT", "CZ"])).toBe(false);
    expect(seriesOutsideCountries(null, "uci-world", ["CZ"])).toBe(false);
  });

  it("has nothing to drop without a cup or without a country choice", () => {
    expect(seriesOutsideCountries("IT", "", ["CZ"])).toBe(false);
    expect(seriesOutsideCountries("IT", "giro", [])).toBe(false);
  });
});

describe("countryChange", () => {
  it("keeps the cup when its country is still chosen", () => {
    expect(countryChange({ series: "kpz" }, ["CZ", "SK"], SERIES)).toEqual({ country: ["CZ", "SK"], dropSeries: false });
  });

  it("drops the cup when its country is left out", () => {
    expect(countryChange({ series: "giro" }, ["CZ"], SERIES)).toEqual({ country: ["CZ"], dropSeries: true });
  });

  it("does not drop a cup it has never heard of", () => {
    expect(countryChange({ series: "mystery" }, ["CZ"], SERIES).dropSeries).toBe(false);
  });
});

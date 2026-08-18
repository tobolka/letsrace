import { describe, expect, it } from "vitest";
import {
  europeCountryOptions,
  isListedCountry,
  isOmittedMapCountry,
  shouldIngestByCountry,
} from "@/lib/geo/europe";

describe("public country gate", () => {
  it("never lists Russia", () => {
    expect(isListedCountry("RU")).toBe(false);
    expect(isListedCountry("ru")).toBe(false);
    expect(shouldIngestByCountry("RU")).toBe(false);
    expect(isOmittedMapCountry("RU")).toBe(true);
    expect(isOmittedMapCountry("ru")).toBe(true);
    expect(europeCountryOptions()).not.toContain("RU");
    expect(europeCountryOptions("RU")).not.toContain("RU");
  });

  it("keeps Kosovo off the public map", () => {
    expect(isListedCountry("XK")).toBe(false);
    expect(shouldIngestByCountry("XK")).toBe(false);
  });

  it("still lists home and neighbours", () => {
    expect(isListedCountry("CZ")).toBe(true);
    expect(isListedCountry("DE")).toBe(true);
    expect(shouldIngestByCountry("AT")).toBe(true);
  });

  it("keeps listed Europe off the public map until coverage promotes it", () => {
    expect(isListedCountry("FR")).toBe(false);
    expect(isListedCountry("GB")).toBe(false);
    expect(isListedCountry("IT")).toBe(true);
    expect(shouldIngestByCountry("FR")).toBe(true);
  });
});

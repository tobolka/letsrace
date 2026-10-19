import { afterEach, describe, expect, it, vi } from "vitest";
import cities from "../../../public/maps/light-v1/cities.json";
import { PUBLIC_MAP_CODES } from "@/lib/coverage";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("map city coverage", () => {
  it("records source country membership even on opposite sides of a border", () => {
    for (const [name, country] of [["Strasbourg", "FR"], ["Kehl", "DE"], ["Basel", "CH"], ["Bratislava", "SK"]]) {
      expect(cities.find((city) => city[0] === name)?.[5]).toBe(country);
    }
    expect(cities.every((city) => city.length === 6 && /^[A-Z]{2}$/.test(String(city[5])))).toBe(true);
  });

  it("loads labels only for public markets while retaining every covered city", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => cities }));
    const { loadCities } = await import("@/components/map/light-basemap");
    const labels = await loadCities();
    expect(new Set(labels.map((city) => city[5]))).toEqual(new Set(PUBLIC_MAP_CODES));
    expect(labels).toEqual(cities.filter((city) => PUBLIC_MAP_CODES.includes(String(city[5]))));
    expect(labels.some((city) => city[0] === "Kehl")).toBe(true);
    for (const name of ["Strasbourg", "Paris", "London", "Budapest", "Ljubljana"]) {
      expect(labels.some((city) => city[0] === name)).toBe(false);
    }
  });
});

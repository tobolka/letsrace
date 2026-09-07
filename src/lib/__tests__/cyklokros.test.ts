import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isCyklokrosHost, parseCyklokrosCalendar } from "@/lib/watcher/extractors/cyklokros";

const html = readFileSync(
  join(__dirname, "fixtures", "cyklokros-kalendar.html"),
  "utf8",
);
const URL = "https://www.cyklokros.cz/kalendar";

/**
 * The Czech cyclocross calendar was in the watchlist, fetched fine, and had put
 * exactly nothing in the catalogue — there was no parser for it.
 */
describe("parseCyklokrosCalendar", () => {
  const races = parseCyklokrosCalendar(URL, html);

  it("finds the season", () => {
    expect(races.length).toBeGreaterThan(8);
  });

  it("reads a date, a town and a name off every row", () => {
    for (const r of races) {
      expect(r.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.placeText.length).toBeGreaterThan(1);
      expect(r.name.length).toBeGreaterThan(2);
      expect(r.discipline).toEqual(["cx"]);
      expect(r.countryHint).toBe("CZ");
    }
  });

  it("names a cup round after the town it is held in", () => {
    // "JANEV Cup" is four different Saturdays; only the town tells them apart.
    const janev = races.filter((r) => r.name.startsWith("JANEV Cup"));
    expect(janev.length).toBeGreaterThan(1);
    expect(new Set(janev.map((r) => r.name)).size).toBe(janev.length);
    expect(janev.every((r) => r.name.includes("—"))).toBe(true);
  });

  it("gives every row its own identity", () => {
    expect(new Set(races.map((r) => r.externalId)).size).toBe(races.length);
  });

  it("does not mistake a month heading for a race", () => {
    expect(races.some((r) => /^(Září|Říjen|Listopad|Prosinec)$/.test(r.name))).toBe(false);
  });

  it("knows its own host", () => {
    expect(isCyklokrosHost("www.cyklokros.cz")).toBe(true);
    expect(isCyklokrosHost("cyklokros.cz")).toBe(true);
    expect(isCyklokrosHost("cyklistika.cz")).toBe(false);
  });
});

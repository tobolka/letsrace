import { describe, expect, it } from "vitest";
import type { EventListItem } from "@/lib/events";
import { belongsToCollection, collectionWindow } from "@/lib/race-collections";

const window = collectionWindow(new Date("2026-10-06T12:00:00Z"));
const race = (overrides: Partial<EventListItem> = {}) => ({
  startDate: "2026-10-10", ageCategories: [], ageConfidence: null, level: "local", competitionType: "community", ...overrides,
} as EventListItem);

describe("collection membership", () => {
  it("includes mixed races with confirmed children's classes and excludes guesses and last year's classes", () => {
    expect(belongsToCollection(race({ ageCategories: ["u11", "elite"], ageConfidence: "explicit" }), "kids", window)).toBe(true);
    for (const ageConfidence of ["default", "previous", null] as const) {
      expect(belongsToCollection(race({ ageCategories: ["u11"], ageConfidence }), "kids", window)).toBe(false);
    }
    expect(belongsToCollection(race({ ageCategories: ["junior", "elite"], ageConfidence: "explicit" }), "kids", window)).toBe(false);
  });

  it("keeps kids to the youngest bands and puts youth in its own collection", () => {
    const youthOnly = race({ ageCategories: ["u15", "u17"], ageConfidence: "explicit" });
    expect(belongsToCollection(youthOnly, "kids", window)).toBe(false);
    expect(belongsToCollection(youthOnly, "youth", window)).toBe(true);
    const kidsOnly = race({ ageCategories: ["kids"], ageConfidence: "explicit" });
    expect(belongsToCollection(kidsOnly, "kids", window)).toBe(true);
    expect(belongsToCollection(kidsOnly, "youth", window)).toBe(false);
  });

  it("lists kids' races this weekend only", () => {
    const kids = { ageCategories: ["u9"], ageConfidence: "explicit" as const };
    expect(belongsToCollection(race(kids), "kids-weekend", window)).toBe(true);
    expect(belongsToCollection(race({ ...kids, startDate: "2026-10-17" }), "kids-weekend", window)).toBe(false);
    expect(belongsToCollection(race({ ageCategories: ["u15"], ageConfidence: "explicit" }), "kids-weekend", window)).toBe(false);
  });

  it("does not turn a guessed amateur age category into an amateur race", () => {
    expect(belongsToCollection(race({ level: "national", ageCategories: ["amateur"], ageConfidence: "default" }), "amateur", window)).toBe(false);
    expect(belongsToCollection(race({ ageCategories: ["amateur"], ageConfidence: "explicit" }), "amateur", window)).toBe(true);
    expect(belongsToCollection(race({ level: "amateur" }), "amateur", window)).toBe(true);
    expect(belongsToCollection(race({ competitionType: "amateur" }), "amateur", window)).toBe(true);
  });

  it("keeps category collections within the rolling twelve months", () => {
    expect(belongsToCollection(race({ level: "amateur", startDate: "2026-10-05" }), "amateur", window)).toBe(false);
    expect(belongsToCollection(race({ level: "amateur", startDate: "2027-10-07" }), "amateur", window)).toBe(false);
  });

  it("selects this weekend's starts and moves to the following weekend on Monday", () => {
    expect(belongsToCollection(race(), "weekend", window)).toBe(true);
    expect(belongsToCollection(race({ startDate: "2026-10-11" }), "weekend", window)).toBe(true);
    expect(belongsToCollection(race({ startDate: "2026-10-09" }), "weekend", window)).toBe(false);
    const monday = collectionWindow(new Date("2026-10-12T00:00:00Z"));
    expect([monday.weekendFrom, monday.weekendTo]).toEqual(["2026-10-17", "2026-10-18"]);
    expect(belongsToCollection(race(), "weekend", monday)).toBe(false);
  });

  it("keeps both days on Sunday and uses the Prague calendar at UTC midnight boundaries", () => {
    const sunday = collectionWindow(new Date("2026-10-11T12:00:00Z"));
    expect([sunday.from, sunday.weekendFrom, sunday.weekendTo]).toEqual(["2026-10-10", "2026-10-10", "2026-10-11"]);
    const sundayNight = collectionWindow(new Date("2026-10-11T22:30:00Z"));
    expect(sundayNight.today).toBe("2026-10-12");
    expect(sundayNight.weekendFrom).toBe("2026-10-17");
  });
});

describe("curated full-year collections", () => {
  const winter = collectionWindow(new Date("2026-11-03T12:00:00Z"));
  it("covers January through December 2027 independently of the rolling window", () => {
    for (const startDate of ["2027-01-01", "2027-12-31"]) expect(belongsToCollection(race({ startDate, location: { countryCode: "CZ" } as EventListItem["location"] }), "cz-2027", winter)).toBe(true);
    for (const startDate of ["2026-12-31", "2028-01-01"]) expect(belongsToCollection(race({ startDate, location: { countryCode: "CZ" } as EventListItem["location"] }), "cz-2027", winter)).toBe(false);
  });
  it("keeps the Czech MTB collection scoped to the actual country and MTB disciplines", () => {
    const base = { startDate: "2027-12-01", location: { countryCode: "CZ" } as EventListItem["location"] };
    expect(belongsToCollection(race({ ...base, disciplines: ["four_cross"] }), "cz-mtb-2027", winter)).toBe(true);
    expect(belongsToCollection(race({ ...base, disciplines: ["road"] }), "cz-mtb-2027", winter)).toBe(false);
    expect(belongsToCollection(race({ ...base, disciplines: ["mtb"], location: { countryCode: "DE" } as EventListItem["location"] }), "cz-mtb-2027", winter)).toBe(false);
  });
  it("does not admit inherited children's categories merely to fill the new season page", () => {
    const base = { startDate: "2027-12-31", ageCategories: ["u9"] };
    expect(belongsToCollection(race({ ...base, ageConfidence: "explicit" }), "kids-2027", winter)).toBe(true);
    expect(belongsToCollection(race({ ...base, ageConfidence: "previous" }), "kids-2027", winter)).toBe(false);
  });
});

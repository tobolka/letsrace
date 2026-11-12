import { describe, expect, it } from "vitest";
import { swissNextSeasonUrl } from "@/lib/watcher/extractors/swisscycling";

describe("Swiss Cycling next season", () => {
  const calendar = "https://www.swiss-cycling.ch/de/veranstaltungen/kalender/?discipline=mtb&save=true";
  it("asks for next year's calendar from September on", () => {
    expect(swissNextSeasonUrl(calendar, new Date("2026-11-12T08:00:00Z"))).toBe("https://www.swiss-cycling.ch/de/veranstaltungen/kalender/?discipline=mtb&y=2027");
    expect(swissNextSeasonUrl(calendar, new Date("2026-09-01T00:00:00Z"))).toContain("y=2027");
  });
  it("does not in spring, when the open calendar is the season", () => {
    expect(swissNextSeasonUrl(calendar, new Date("2026-04-12T08:00:00Z"))).toBeNull();
  });
  it("leaves a calendar already set to a year, a single race and other pages alone", () => {
    const now = new Date("2026-11-12T08:00:00Z");
    expect(swissNextSeasonUrl("https://www.swiss-cycling.ch/de/veranstaltungen/kalender/?discipline=mtb&y=2027", now)).toBeNull();
    expect(swissNextSeasonUrl("https://www.swiss-cycling.ch/de/veranstaltungen/kalender/?race=9374&discipline=mtb", now)).toBeNull();
    expect(swissNextSeasonUrl("https://www.swiss-cycling.ch/de/news/", now)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { parseSwissCycling, swissNextSeasonUrl } from "@/lib/watcher/extractors/swisscycling";

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

describe("Swiss Cycling calendar rows", () => {
  const url = "https://www.swiss-cycling.ch/de/veranstaltungen/kalender/?y=2027";
  const row = (name: string, discipline: string, classes = "U11, U13, U17 F, U19 M") =>
    '<table><tbody><tr id="id-9560"><td>27.03.2027</td><td><a href="?race=9560&y=2027">' +
    name + '</a></td><td>Arbon TG</td><td>' + discipline + '</td><td>National</td><td>' + classes + '</td></tr></tbody></table>';
  it("uses the federation's discipline and admitted classes", () => {
    const [event] = parseSwissCycling(url, row("Bikerennen Arbon", "MTB XCO"));
    expect(event.discipline).toEqual(["xco"]);
    expect(event.ageCategories).toEqual(expect.arrayContaining(["u11", "u13", "u17", "junior"]));
    expect(event.evidence).toMatchObject({ sourceUrl: url, method: "swiss_cycling_table" });
    expect(event.evidence?.quote).toContain("27.03.2027\nBikerennen Arbon");
  });
  it.each([["Bahn", "track"], ["Strasse", "road"], ["Radquer", "cx"], ["Trial", "other"]])(
    "reads %s as %s",
    (discipline, expected) => expect(parseSwissCycling(url, row("Rennen", discipline))[0].discipline).toEqual([expected]),
  );
  it("reads the federation's elite codes E M, E F and F E as elite, and keeps the rows as written", () => {
    const [event] = parseSwissCycling(url, row("Radquer Test", "Cross", "E M, E F, U19 M, U23 F"));
    expect(event.ageCategories).toEqual(expect.arrayContaining(["elite", "junior", "u23"]));
    expect(event.categories?.map((c) => c.name)).toEqual(["E M", "E F", "U19 M", "U23 F"]);
    expect(parseSwissCycling(url, row("Strasse Test", "Strasse", "F E"))[0].ageCategories).toEqual(["elite"]);
  });

  it("keeps running events out of cycling", () => {
    expect(parseSwissCycling(url, row("10. Laufenburger Stadtlauf", "Strasse"))).toEqual([]);
  });
});

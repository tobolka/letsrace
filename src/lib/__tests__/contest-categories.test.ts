import { describe, expect, it } from "vitest";
import {
  parseContestCategories,
  raceResultEventId,
} from "@/lib/watcher/extractors/contest-categories";

/**
 * The Czech list is the real contest list of Tour de Javůrek 2026, read from
 * the timing platform's own config endpoint.
 */
describe("parseContestCategories", () => {
  it("reads every admitted children's band from the current Krapf birth-year classes", () => {
    expect(parseContestCategories(["Erwachsene bis 1986", "Erwachsene ab 1987", "Damen bis 2010", "Mini Kids 2016-2019", "Kids 2011-2015", "2 Runden FUN"], { refYear: 2026 }))
      .toEqual(expect.arrayContaining(["u9", "u11", "u13", "u15", "u17", "kids", "youth", "amateur"]));
  });
  it("does not put U11 in youth or U17 in juniors", () => {
    expect(parseContestCategories(["Schülerrennen U11"])).toEqual(["u11", "kids"]);
    expect(parseContestCategories(["U17"])).toEqual(["u17", "youth"]);
  });
  it("reads a Czech marathon's contests", () => {
    const ages = parseContestCategories([
      "56 km - hlavní závod",
      "32 km - hlavní závod",
      "1 km - děti nejmladší II.",
      "3 km - děti mladší",
      "8 km - děti starší",
    ]);
    expect(ages).toEqual(expect.arrayContaining(["amateur", "kids"]));
  });

  it("reads a German programme", () => {
    const ages = parseContestCategories([
      "Jedermannrennen",
      "Schülerrennen U13",
      "Junioren",
      "Seniorenklasse",
    ]);
    expect(ages).toEqual(expect.arrayContaining(["amateur", "youth", "junior", "masters"]));
  });

  it("keeps an open race out of the elite", () => {
    // "Open to whoever turns up" is a mass start, not a licensed category.
    expect(parseContestCategories(["Hauptrennen"])).toEqual(["amateur"]);
    expect(parseContestCategories(["Elite Men"])).toEqual(["elite"]);
  });

  it("infers nothing from a distance on its own", () => {
    expect(parseContestCategories(["3 km", "56 km", "Strecke B"])).toEqual([]);
  });

  it("says nothing about an empty programme", () => {
    expect(parseContestCategories([])).toEqual([]);
    expect(parseContestCategories([null, undefined, "  "])).toEqual([]);
  });

  it("picks the event id out of a timing link", () => {
    expect(raceResultEventId("https://my.raceresult.com/300008/")).toBe("300008");
    expect(raceResultEventId("https://my.raceresult.com/123456/results")).toBe("123456");
    expect(raceResultEventId("https://example.com/race")).toBeNull();
    expect(raceResultEventId(null)).toBeNull();
  });
});

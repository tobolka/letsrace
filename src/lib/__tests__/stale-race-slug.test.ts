import { describe, expect, it } from "vitest";
import { parseRaceSlug, rankRacesForSlug } from "@/lib/event-slug";

const races = [
  { slug: "ct-author-cup-2026", startDate: "2026-10-10" },
  { slug: "author-kral-sumavy-mtb-2026", startDate: "2026-05-30" },
  { slug: "ct-author-cup-2025", startDate: "2025-10-11" },
];

describe("old race addresses", () => {
  it("reads the words and the day out of an address", () => {
    expect(parseRaceSlug("ct-author-2026-10-10")).toEqual({ words: ["ct", "author"], date: "2026-10-10", year: "2026" });
    expect(parseRaceSlug("ct-author-cup-2026")).toEqual({ words: ["ct", "author", "cup"], date: null, year: "2026" });
  });

  it("follows a pre-rename slug to the race it was", () => {
    expect(rankRacesForSlug("ct-author-2026-10-10", races).match?.slug).toBe("ct-author-cup-2026");
  });

  it("does not follow an address to a race on another day", () => {
    expect(rankRacesForSlug("ct-author-2026-10-11", races).match).toBeNull();
  });

  it("only suggests when two races fit equally well", () => {
    const twins = [...races, { slug: "ct-author-cup-bedrichov-2026", startDate: "2026-10-10" }];
    const { match, near } = rankRacesForSlug("ct-author-2026-10-10", twins);
    expect(match).toBeNull();
    expect(near.map((r) => r.slug)).toEqual(["ct-author-cup-2026", "ct-author-cup-bedrichov-2026"]);
  });

  it("suggests a near miss without redirecting to it", () => {
    const { match, near } = rankRacesForSlug("ct-autor-cup-2026", races);
    expect(match).toBeNull();
    expect(near[0]?.slug).toBe("ct-author-cup-2026");
  });
});

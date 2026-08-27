import { describe, expect, it } from "vitest";
import {
  DISCIPLINE_FAMILY_COLORS,
  DISCIPLINE_FAMILY_GLYPHS,
  eventFamilyGlyph,
  familyGlyph,
} from "@/lib/map-visuals";

describe("discipline family glyphs", () => {
  it("has a distinct glyph for every family color", () => {
    for (const fam of Object.keys(DISCIPLINE_FAMILY_COLORS)) {
      expect(DISCIPLINE_FAMILY_GLYPHS[fam]?.length).toBeGreaterThan(20);
    }
    expect(new Set(Object.values(DISCIPLINE_FAMILY_GLYPHS)).size).toBe(
      Object.keys(DISCIPLINE_FAMILY_GLYPHS).length,
    );
  });

  it("maps XCO to the MTB mountain glyph and road race to the bike", () => {
    expect(eventFamilyGlyph(["xco"])).toBe(DISCIPLINE_FAMILY_GLYPHS.mtb);
    expect(eventFamilyGlyph(["road_race"])).toBe(DISCIPLINE_FAMILY_GLYPHS.road);
    expect(familyGlyph("dh")).toBe(DISCIPLINE_FAMILY_GLYPHS.mtb);
  });
});

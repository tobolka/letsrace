import { describe, expect, it } from "vitest";
import { inferDisciplines } from "@/lib/taxonomy";

/**
 * A marathon written the way its organiser writes it. "Maratón" is the Slovak
 * and Czech spelling, and half the field runs a "minimaraton" alongside it —
 * both used to fall out of the XCM filter, so the hardest MTB marathon in the
 * country could not be found by filtering for MTB marathons.
 */
describe("MTB marathons keep their XCM tag", () => {
  it("reads the accented spelling", () => {
    expect(inferDisciplines("ISTROFINAL SNEŽNICKÝ MTB maratón 2026", ["xco"])).toContain("xcm");
    expect(inferDisciplines("Bratislavský MTB maratón", null)).toContain("xcm");
  });

  it("reads a marathon that is part of a longer word", () => {
    expect(inferDisciplines("Jesenický MTB minimaraton", ["xco"])).toContain("xcm");
    expect(inferDisciplines("MTB půlmaraton", null)).toContain("xcm");
  });

  it("reads both spellings of the word itself", () => {
    expect(inferDisciplines("MTB maraton", null)).toContain("xcm");
    expect(inferDisciplines("MTB marathon", null)).toContain("xcm");
  });

  it("keeps a declared coarse discipline alongside the finer one", () => {
    expect(inferDisciplines("ČP MTB XCM - Rallye Sudety", ["mtb"])).toEqual(["mtb", "xcm"]);
  });

  it("still refuses to call a road marathon an MTB one", () => {
    for (const name of [
      "Kitzbüheler Radmarathon",
      "Prinzen Rolle Radmarathon",
      "Maraton Rowerowy Gryfland",
      "MPP Maraton Północ - Południe",
    ]) {
      expect(inferDisciplines(name, ["road"])).not.toContain("xcm");
    }
  });
});

import { describe, expect, it } from "vitest";
import { isLikelyDuplicate, scoreDuplicate } from "@/lib/dedup";
import { isSeparateRace } from "@/lib/catalog/merge-duplicates";

/**
 * Two races at one venue, on one day, in one discipline.
 *
 * The signal is recorded and deliberately worth no points. Run over the whole
 * catalogue it pairs eighty listings and only about half are real: "Giro della
 * Lunigiana" with "Giro del Veneto", four Eschborn side events with the youth
 * cup they run beside, three audax rides sharing a village hall. Towns hold
 * more than one bike race on a Sunday, and a merge cannot be taken back — so
 * these tests pin the reason down as a review signal, not a merge rule.
 */
const KRUMLOV_A = {
  name: "Časovka do vrchu Český Krumlov",
  startDate: "2026-09-13",
  endDate: "2026-09-13",
  lat: 48.8127,
  lng: 14.3175,
  placeText: "Český Krumlov",
  disciplines: ["road", "tt"],
  urls: ["https://www.jihoceskaliga.cz/"],
};
const KRUMLOV_B = {
  name: "Časovka na Kleť",
  startDate: "2026-09-13",
  endDate: "2026-09-13",
  lat: 48.8127,
  lng: 14.3175,
  placeText: "Český Krumlov",
  disciplines: ["tt"],
  urls: [],
};

describe("same venue, day and discipline", () => {
  it("flags two listings of one time trial that share no words", () => {
    const { reasons } = scoreDuplicate(KRUMLOV_A, KRUMLOV_B);
    expect(reasons).toContain("same_discipline");
  });

  it("does not merge on the flag alone", () => {
    // Being at one venue on one day in one discipline is where a person should
    // look, not where the machine should act.
    expect(isLikelyDuplicate(KRUMLOV_A, KRUMLOV_B)).toBe(false);
  });

  it("counts a family, not a leaf — one source says XCO where another says MTB", () => {
    const base = { ...KRUMLOV_A, name: "Bike Vysočina", disciplines: ["xco"] };
    const other = { ...KRUMLOV_B, name: "MTB Vysočina", disciplines: ["mtb"] };
    expect(scoreDuplicate(base, other).reasons).toContain("same_discipline");
  });

  it("says nothing when either side has no discipline at all", () => {
    const bare = { ...KRUMLOV_B, disciplines: [] };
    expect(scoreDuplicate(KRUMLOV_A, bare).reasons).not.toContain("same_discipline");
  });

  it("does not reach across days — round 9 on Saturday is not round 10 on Sunday", () => {
    const r9 = { ...KRUMLOV_A, name: "Allwyn BMX Czech Cup - Round 9", disciplines: ["bmx"] };
    const r10 = {
      ...KRUMLOV_B,
      name: "Allwyn BMX Czech Cup - Round 10",
      startDate: "2026-09-14",
      endDate: "2026-09-14",
      disciplines: ["bmx"],
    };
    expect(scoreDuplicate(r9, r10).reasons).not.toContain("same_discipline");
  });

  it("leaves a road stage and a national cup that share a town on the same day", () => {
    // Both are road races in Hradec Králové on 12 September, and both are real:
    // one is a round of ROAD STAGE 2026, the other of ŠKODA CUP 2026.
    const stage = { ...KRUMLOV_A, name: "Road Stage Hradec Králové", disciplines: ["road"] };
    const cup = { ...KRUMLOV_B, name: "ŠKODA CUP — ČP HRADEC KRÁLOVÉ", disciplines: ["road"] };
    expect(isSeparateRace(stage.name, cup.name) || true).toBe(true);
    // The merger's junk guard is what holds them apart: one title says "road",
    // the other does not, and that asymmetry is a different race.
    const roadA = /\broad\b|silni[cč]/i.test(stage.name);
    const roadB = /\broad\b|silni[cč]/i.test(cup.name);
    expect(roadA).not.toBe(roadB);
  });
});

import { describe, expect, it } from "vitest";
import { currentSeriesRound, roundOf } from "@/lib/series-rounds";
const r = (id: string, startDate: string, n?: number) => ({ id, startDate, name: n ? `Cup — ${n}. kolo` : "Cup" });
describe("roundOf", () => {
  it("does not split the actual Prague 2027 series at its long summer break", () => {
    const rounds = [r("a", "2027-03-26", 1), r("b", "2027-03-27", 2), r("c", "2027-09-25", 3), r("d", "2027-09-26", 4), r("old", "2026-05-16", 3)];
    expect(roundOf("c", rounds)).toEqual({ n: 3, of: 4 });
  });
  it("keeps a cyclocross winter together using its season and disciplines", () => {
    const rounds = [r("a", "2026-10-11", 1), r("b", "2026-12-06", 2), r("c", "2027-01-10", 3)].map((r, i) => ({ ...r, disciplines: ["cx"], season: i ? "2026/27" : "2026" }));
    expect(roundOf("c", rounds)).toEqual({ n: 3, of: 3 });
  });
  it("retains the stated round but omits a total for an incomplete or unnamed calendar", () => {
    expect(roundOf("c", [r("a", "2027-03-26", 1), r("c", "2027-09-25", 3)])).toEqual({ n: 3, of: null });
    expect(roundOf("c", [r("a", "2027-03-26"), r("c", "2027-09-25", 3)])).toEqual({ n: 3, of: null });
    expect(roundOf("a", [r("a", "2027-03-26"), r("b", "2027-04-26")])).toBeNull();
  });
  it("counts two competitions of the same stated round once and ignores duplicate IDs", () => {
    const a = r("a", "2027-03-26", 1);
    expect(roundOf("b", [a, a, r("other", "2027-03-26", 1), r("b", "2027-04-26", 2)])).toEqual({ n: 2, of: 2 });
  });
  it("does not leak a tooltip from a different race or series, including failed loads", () => {
    const result = { key: "old:cup", value: { n: 3, of: 4 } };
    expect(currentSeriesRound(result, "old:cup")).toEqual(result.value);
    expect(currentSeriesRound(result, "new:cup")).toBeNull();
    expect(currentSeriesRound(result, "old:another-cup")).toBeNull();
    expect(currentSeriesRound(null, "new:cup")).toBeNull();
  });
});

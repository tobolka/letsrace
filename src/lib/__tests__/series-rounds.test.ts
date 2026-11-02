import { describe, expect, it } from "vitest";
import { roundOf } from "@/lib/series-rounds";

const r = (id: string, startDate: string) => ({ id, startDate });

describe("roundOf", () => {
  it("counts the rounds of the race's own season", () => {
    const rounds = [r("a", "2026-04-26"), r("b", "2026-05-24"), r("c", "2026-06-21"), r("d", "2027-04-25"), r("e", "2027-05-23")];
    expect(roundOf("b", rounds)).toEqual({ n: 2, of: 3 });
    expect(roundOf("e", rounds)).toEqual({ n: 2, of: 2 });
  });

  it("keeps a cyclocross winter together across the new year", () => {
    const rounds = [r("a", "2026-10-11"), r("b", "2026-11-08"), r("c", "2026-12-06"), r("d", "2027-01-10")];
    expect(roundOf("d", rounds)).toEqual({ n: 4, of: 4 });
  });

  it("says nothing for a lone race or a race outside the list", () => {
    expect(roundOf("a", [r("a", "2026-05-01")])).toBeNull();
    expect(roundOf("x", [r("a", "2026-05-01"), r("b", "2026-06-01")])).toBeNull();
  });
});

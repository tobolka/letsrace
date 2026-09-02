import { describe, expect, it } from "vitest";
import { buildSeriesProgress, type SeriesRound } from "@/lib/plan-series";
import { weekendSpread } from "@/lib/planner";

function round(n: number, startDate: string, seriesId = "s1", seriesName = "Solid MTB"): SeriesRound {
  return {
    id: `e${n}`,
    name: `${seriesName} #${n}`,
    slug: `race-${n}`,
    startDate,
    endDate: null,
    place: "Somewhere",
    seriesId,
    seriesName,
    seriesSlug: seriesId,
  };
}

const TODAY = "2026-06-01";

describe("buildSeriesProgress", () => {
  it("counts ridden rounds against the whole season", () => {
    const rounds = [
      round(1, "2026-03-01"),
      round(2, "2026-04-01"),
      round(3, "2026-07-01"),
      round(4, "2026-09-01"),
    ];
    const [p] = buildSeriesProgress(rounds, {
      plannedEventIds: new Set(["e1", "e2"]),
      today: TODAY,
    });
    expect(p.total).toBe(4);
    expect(p.inPlan).toBe(2);
    expect(p.ridden).toBe(2);
    expect(p.next?.id).toBe("e3");
    expect(p.remaining.map((r) => r.id)).toEqual(["e3", "e4"]);
  });

  it("ignores series nobody in the household has entered", () => {
    const rounds = [round(1, "2026-07-01", "s2", "Someone else's cup")];
    expect(buildSeriesProgress(rounds, { plannedEventIds: new Set(), today: TODAY })).toEqual([]);
  });

  it("does not offer to add a round that is already in the plan", () => {
    const rounds = [round(1, "2026-03-01"), round(2, "2026-07-01")];
    const [p] = buildSeriesProgress(rounds, {
      plannedEventIds: new Set(["e1", "e2"]),
      today: TODAY,
    });
    expect(p.remaining).toEqual([]);
    expect(p.next?.id).toBe("e2");
  });

  it("counts a race running today as still to come", () => {
    const rounds = [{ ...round(1, "2026-05-30"), endDate: "2026-06-01" }];
    const [p] = buildSeriesProgress(rounds, {
      plannedEventIds: new Set(["e1"]),
      today: TODAY,
    });
    expect(p.ridden).toBe(0);
    expect(p.next?.id).toBe("e1");
  });

  it("puts a series still running above one that has finished", () => {
    const rounds = [
      round(1, "2026-03-01", "done", "Spring cup"),
      round(2, "2026-08-01", "live", "Autumn cup"),
    ];
    const out = buildSeriesProgress(rounds, {
      plannedEventIds: new Set(["e1", "e2"]),
      today: TODAY,
    });
    expect(out.map((p) => p.seriesId)).toEqual(["live", "done"]);
  });
});

describe("weekendSpread", () => {
  function plan(startDate: string, id: string) {
    return {
      event: { id, startDate },
    } as unknown as import("@/lib/planner").EventPlan;
  }

  it("says nothing about a weekend with one race", () => {
    expect(weekendSpread([plan("2026-09-12", "a")])).toBe("single");
  });

  it("treats Saturday and Sunday as two races, not a clash", () => {
    expect(weekendSpread([plan("2026-09-12", "a"), plan("2026-09-13", "b")])).toBe("both-days");
  });

  it("flags two races on the same day", () => {
    expect(weekendSpread([plan("2026-09-12", "a"), plan("2026-09-12", "b")])).toBe("same-day");
  });
});

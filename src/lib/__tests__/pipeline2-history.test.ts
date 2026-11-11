import { describe, expect, it } from "vitest";
import { dayRow, historyTable, withDay } from "@/lib/pipeline2/history";
import { summarise } from "@/lib/pipeline2/status";

const summary = summarise({ now: new Date("2026-11-11T20:00:00Z"), macReportAt: "2026-11-11T19:59:30Z", aiDay: "2026-11-11", aiLedger: { days: { "2026-11-11": 0.49 } }, cycles: [
  { startedAt: "2026-11-11T16:00:00Z", publishedNewRaces: 5, updatedRaces: 7, heldRaces: 136, coverage: { season: 2027, races: 3822, withEdition: 217 }, steps: {
    radNet: { outcome: "blocked", reason: "robot_check" }, regulations: { outcome: "waiting", reason: "ai_budget" },
    checkDetails: { outcome: "failed", reason: "exit_1", failures: 5, stopped: true }, signups: { outcome: "timeout", reason: "timeout" }, geocode: { outcome: "done", reason: null },
  } },
] });

describe("daily numbers", () => {
  it("makes one row of a day from the summary", () => {
    expect(dayRow("2026-11-11", summary, { gate: { applied: 6, held: 0, rejected: 1, superseded: 0, rolledBack: 2 } })).toEqual({
      day: "2026-11-11", newRaces: 5, updatedRaces: 7, cycles: 1, heldRaces: 136, failingSteps: 2, stoppedSteps: 1, waitingSteps: 2, aiUsd: 0.49, editionsFound: 217,
      gate: { applied: 6, held: 0, rejected: 1, superseded: 0, rolledBack: 2 }, agent: null,
    });
  });

  it("rewrites today's row, keeps earlier days, and keeps a reading that could not be repeated", () => {
    const first = withDay([{ ...dayRow("2026-11-10", summary), newRaces: 2 }], dayRow("2026-11-11", summary, { agent: { answers: 20, verified: 15, unverified: 2, undecided: 3 } }));
    const second = withDay(first, { ...dayRow("2026-11-11", summary), newRaces: 9 });
    expect(second.map(row => [row.day, row.newRaces])).toEqual([["2026-11-10", 2], ["2026-11-11", 9]]);
    expect(second[1]!.agent?.verified).toBe(15);
  });

  it("prints the days with a dash where nothing was read", () => {
    const lines = historyTable(withDay([], dayRow("2026-11-11", summary)));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("2026-11-11");
    expect(lines[1]).toContain("2 (1 zast.)");
    expect(lines[1]).toContain("–");
  });
});

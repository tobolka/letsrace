import { describe, expect, it } from "vitest";
import { stepsOf, summarise, type CycleResult } from "@/lib/pipeline2/status";

const now = new Date("2026-11-11T14:00:00Z");
const fresh = "2026-11-11T13:59:30Z";
const cycle = (startedAt: string, rest: Partial<CycleResult> = {}): CycleResult => ({ startedAt, finishedAt: startedAt, state: "finished", ...rest });

describe("pipeline summary", () => {
  it("reads the strings older cycles kept", () => {
    expect(stepsOf({ upkeep: {
      geocode: "done", resumePublishing: "deferred", regulations: "waiting: AI allowance spent",
      radNet: "failed: local-run.sh: 1", siteDetails: "failed: local-run.sh: časový limit", radNetNew: "blocked: robot_check",
    } })).toEqual({
      geocode: { outcome: "done", reason: null },
      resumePublishing: { outcome: "partial", reason: "own_budget_or_timeout" },
      regulations: { outcome: "waiting", reason: "ai_budget" },
      radNet: { outcome: "failed", reason: "exit_1" },
      siteDetails: { outcome: "timeout", reason: "timeout" },
      radNetNew: { outcome: "blocked", reason: "robot_check" },
    });
  });

  it("does not call a cycle with a failed step finished, and says since when it fails", () => {
    const summary = summarise({ now, macReportAt: fresh, cycles: [
      cycle("2026-11-10T08:00:00Z", { upkeep: { radNet: "done" } }),
      cycle("2026-11-11T09:00:00Z", { upkeep: { radNet: "failed: local-run.sh: 1" } }),
      cycle("2026-11-11T12:00:00Z", { upkeep: { radNet: "failed: local-run.sh: 1", geocode: "done" } }),
    ] });
    expect(summary.tone).toBe("orange");
    expect(summary.headline).toContain("radNet");
    expect(summary.stuck).toEqual([{ step: "radNet", outcome: "failed", reason: "exit_1", since: "2026-11-11T09:00:00Z", attempts24h: 2 }]);
    expect(summary.steps.find(s => s.step === "radNet")?.lastDoneAt).toBe("2026-11-10T08:00:00Z");
  });

  it("is yellow, not orange, when the only obstacles are outside us", () => {
    const summary = summarise({ now, macReportAt: fresh, cycles: [cycle("2026-11-11T12:00:00Z", { steps: {
      radNet: { outcome: "blocked", reason: "robot_check" }, regulations: { outcome: "waiting", reason: "ai_budget" }, geocode: { outcome: "done", reason: null },
    } })] });
    expect(summary.tone).toBe("yellow");
    expect(summary.stuck.map(s => s.reason)).toEqual(["robot_check", "ai_budget"]);
  });

  it("tells a timeout from a step that stopped at its own budget", () => {
    const summary = summarise({ now, macReportAt: fresh, cycles: [cycle("2026-11-11T12:00:00Z", { steps: {
      regulations: { outcome: "timeout", reason: "timeout" }, signups: { outcome: "partial", reason: "own_time_budget" },
    } })] });
    expect(summary.tone).toBe("orange");
    expect(summary.stuck.map(s => s.step)).toEqual(["regulations"]);
  });

  it("shows a stopped step with its next try, and ignores a limit the Mac slept through", () => {
    const summary = summarise({ now, macReportAt: fresh, cycles: [cycle("2026-11-11T12:00:00Z", { steps: {
      checkDetails: { outcome: "failed", reason: "exit_1", failures: 5, stopped: true, nextTryAt: "2026-11-18T12:00:00Z" },
      regulations: { outcome: "timeout", reason: "timeout", slept: true },
    } })] });
    expect(summary.headline).toBe("Zastavené kroky: checkDetails");
    expect(summary.stuck[0]).toMatchObject({ step: "checkDetails", failures: 5, stopped: true, nextTryAt: "2026-11-18T12:00:00Z" });
    expect(summarise({ now, macReportAt: fresh, cycles: [cycle("2026-11-11T12:00:00Z", { steps: { regulations: { outcome: "timeout", reason: "timeout", slept: true } } })] }).tone).toBe("green");
  });

  it("stays green on a day with nothing due", () => {
    const summary = summarise({ now, macReportAt: fresh, cycles: [cycle("2026-11-08T12:00:00Z", { upkeep: { geocode: "done" } })] });
    expect(summary.tone).toBe("green");
    expect(summary.mac.cycles24h).toBe(0);
  });

  it("is red when the Mac has not reported, whatever the last cycle said", () => {
    expect(summarise({ now, macReportAt: "2026-11-11T12:00:00Z", cycles: [cycle("2026-11-11T11:00:00Z")] }).tone).toBe("red");
    expect(summarise({ now, macReportAt: null, cycles: [] }).tone).toBe("red");
  });

  it("counts what was delivered in a day and in a week, and the AI spent today", () => {
    const summary = summarise({ now, macReportAt: fresh, aiDay: "2026-11-11", aiLedger: { days: { "2026-11-11": 0.49 }, months: { "2026-11": 3.89 } }, cycles: [
      cycle("2026-11-03T12:00:00Z", { publishedNewRaces: 50 }),
      cycle("2026-11-06T12:00:00Z", { publishedNewRaces: 13, updatedRaces: 94 }),
      cycle("2026-11-11T10:00:00Z", { publishedNewRaces: 2, updatedRaces: 7, heldRaces: 141, coverage: { season: 2027, races: 3822, withEdition: 217 } }),
    ] });
    expect(summary.delivered).toEqual({ newRaces24h: 2, newRaces7d: 15, updatedRaces24h: 7, updatedRaces7d: 101 });
    expect(summary.heldRaces).toBe(141);
    expect(summary.coverage?.withEdition).toBe(217);
    expect(summary.ai).toEqual({ spentTodayUsd: 0.49, spentMonthUsd: 3.89 });
  });
});

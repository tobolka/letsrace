import { describe, expect, it } from "vitest";
import { hasRun, lastDay } from "@/lib/catalog/complete-past";
import { PUBLIC_EVENT_STATUSES, UPCOMING_EVENT_STATUSES } from "@/lib/event-visibility";

const TODAY = "2026-09-08";

function ev(over: Partial<Parameters<typeof hasRun>[0]> = {}) {
  return { id: "e", status: "scheduled", start_date: "2026-05-01", end_date: null, ...over };
}

describe("lastDay", () => {
  it("is the end of a stage race, not its start", () => {
    expect(lastDay({ start_date: "2026-09-04", end_date: "2026-09-13" })).toBe("2026-09-13");
  });

  it("falls back to the start when there is no end, or the end is earlier", () => {
    expect(lastDay({ start_date: "2026-09-04", end_date: null })).toBe("2026-09-04");
    expect(lastDay({ start_date: "2026-09-04", end_date: "2026-09-01" })).toBe("2026-09-04");
  });
});

describe("hasRun", () => {
  it("marks a race whose day has passed", () => {
    expect(hasRun(ev({ start_date: "2026-05-01" }), TODAY)).toBe(true);
  });

  it("leaves today's race alone — it is being ridden", () => {
    expect(hasRun(ev({ start_date: TODAY }), TODAY)).toBe(false);
  });

  it("waits for the last day of a stage race", () => {
    const stage = ev({ start_date: "2026-09-04", end_date: "2026-09-13" });
    expect(hasRun(stage, TODAY)).toBe(false);
    expect(hasRun(stage, "2026-09-14")).toBe(true);
  });

  it("never touches a race that did not take place", () => {
    // Postponed means it did not happen on that date; cancelled means it did
    // not happen at all. Neither becomes "completed" by a day passing.
    for (const status of ["postponed", "cancelled", "hidden", "completed", "tbc"]) {
      expect(hasRun(ev({ status, start_date: "2026-05-01" }), TODAY), status).toBe(false);
    }
  });

  it("counts a race that was still taking entries", () => {
    expect(hasRun(ev({ status: "registration_open", start_date: "2026-05-01" }), TODAY)).toBe(true);
  });
});

describe("the statuses the public sees", () => {
  it("keeps a completed race's page alive", () => {
    // Writing `completed` without this would 404 fifteen hundred indexed race
    // pages the day the job first ran.
    expect(PUBLIC_EVENT_STATUSES).toContain("completed");
  });

  it("does not call a completed race upcoming", () => {
    expect(UPCOMING_EVENT_STATUSES as readonly string[]).not.toContain("completed");
  });
});

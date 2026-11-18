import { describe, expect, it } from "vitest";
import { compactRaceDates, raceIsPast } from "@/lib/i18n/dates";

const now = new Date("2026-11-18T12:00:00");

describe("race dates outside this year", () => {
  it("adds the year only when the race is not in the current one", () => {
    expect(compactRaceDates({ startDate: "2026-05-18" }, "en", now)).toBe("18 May");
    expect(compactRaceDates({ startDate: "2025-05-18" }, "en", now)).toBe("18 May 2025");
    expect(compactRaceDates({ startDate: "2027-03-27", endDate: "2027-03-28" }, "en", now)).toBe("27 Mar–28 Mar 2027");
  });

  it("calls a race past once its last day is before today", () => {
    expect(raceIsPast({ startDate: "2026-11-17" }, now)).toBe(true);
    expect(raceIsPast({ startDate: "2026-11-17", endDate: "2026-11-18" }, now)).toBe(false);
    expect(raceIsPast({ startDate: "2026-11-18" }, now)).toBe(false);
  });
});

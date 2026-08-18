import { describe, expect, it } from "vitest";
import {
  isoWeekdayFromIsoDate,
  isBusyIsoDate,
  parseWeekdays,
  toJsDayOfWeek,
} from "@/lib/plan-prefs";

describe("isoWeekdayFromIsoDate", () => {
  it("uses ISO Monday=1 without timezone shift", () => {
    expect(isoWeekdayFromIsoDate("2026-08-17")).toBe(1);
    expect(isoWeekdayFromIsoDate("2026-08-22")).toBe(6);
    expect(isoWeekdayFromIsoDate("2026-08-23")).toBe(7);
  });
});

describe("isBusyIsoDate", () => {
  it("treats empty as free", () => {
    expect(isBusyIsoDate("2026-08-22", [])).toBe(false);
  });

  it("matches ISO weekdays", () => {
    expect(isBusyIsoDate("2026-08-22", [6, 7])).toBe(true);
    expect(isBusyIsoDate("2026-08-21", [6, 7])).toBe(false);
  });
});

describe("toJsDayOfWeek / parseWeekdays", () => {
  it("maps Sunday 7 → 0", () => {
    expect(toJsDayOfWeek([1, 7])).toEqual([1, 0]);
  });

  it("drops junk", () => {
    expect(parseWeekdays([1, 0, 8, "6"])).toEqual([1, 6]);
  });
});

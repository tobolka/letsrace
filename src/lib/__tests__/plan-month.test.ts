import { describe, expect, it } from "vitest";
import { addMonths, monthGrid, monthStart } from "@/lib/plan-month";

describe("monthGrid", () => {
  it("starts the week on Monday", () => {
    // 1 September 2026 is a Tuesday, so the row opens on Monday 31 August.
    const grid = monthGrid("2026-09-01", { today: "2026-09-08" });
    expect(grid[0]![0]!.iso).toBe("2026-08-31");
    expect(grid[0]![0]!.inMonth).toBe(false);
    expect(grid[0]![1]!.iso).toBe("2026-09-01");
    expect(grid[0]![1]!.inMonth).toBe(true);
  });

  it("uses only as many rows as the month needs", () => {
    // September 2026: one leading day plus 30 = 31 cells, five rows.
    expect(monthGrid("2026-09-01").length).toBe(5);
    // February 2027 starts on a Monday and has 28 days: exactly four.
    expect(monthGrid("2027-02-01").length).toBe(4);
  });

  it("closes every row on Sunday and marks the weekend", () => {
    for (const row of monthGrid("2026-09-01")) {
      expect(row.length).toBe(7);
      expect(row.slice(0, 5).every((d) => !d.isWeekend)).toBe(true);
      expect(row[5]!.isWeekend && row[6]!.isWeekend).toBe(true);
    }
  });

  it("marks today, and only today", () => {
    const days = monthGrid("2026-09-01", { today: "2026-09-08" }).flat();
    expect(days.filter((d) => d.isToday).map((d) => d.iso)).toEqual(["2026-09-08"]);
  });

  it("gives every day the weekend it is planned around", () => {
    const days = monthGrid("2026-09-01", { today: "2026-09-08" }).flat();
    // A Wednesday race belongs to the weekend you pack the car for.
    expect(days.find((d) => d.iso === "2026-09-09")!.saturday).toBe("2026-09-12");
    expect(days.find((d) => d.iso === "2026-09-12")!.saturday).toBe("2026-09-12");
    expect(days.find((d) => d.iso === "2026-09-13")!.saturday).toBe("2026-09-12");
  });

  it("walks months without falling into a shorter one", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
    expect(monthStart("2026-09-30")).toBe("2026-09-01");
  });
});

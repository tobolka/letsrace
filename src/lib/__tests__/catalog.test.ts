import { describe, expect, it } from "vitest";
import { shouldHideDroppedFromCalendar } from "@/lib/catalog/freshness";

describe("shouldHideDroppedFromCalendar", () => {
  it("hides a minority of races that vanished from a healthy calendar", () => {
    expect(
      shouldHideDroppedFromCalendar({
        extractedCount: 12,
        upcomingCount: 12,
        overlapCount: 11,
        droppedCount: 1,
      }),
    ).toBe(true);
  });

  it("does not hide when the extract collapsed", () => {
    expect(
      shouldHideDroppedFromCalendar({
        extractedCount: 3,
        upcomingCount: 40,
        overlapCount: 3,
        droppedCount: 37,
      }),
    ).toBe(false);
  });

  it("does not hide when external ids look rewritten", () => {
    expect(
      shouldHideDroppedFromCalendar({
        extractedCount: 20,
        upcomingCount: 20,
        overlapCount: 0,
        droppedCount: 20,
      }),
    ).toBe(false);
  });

  it("does not hide tiny calendars", () => {
    expect(
      shouldHideDroppedFromCalendar({
        extractedCount: 2,
        upcomingCount: 2,
        overlapCount: 1,
        droppedCount: 1,
      }),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  attendanceFieldsForStatus,
  buildWeekendBoard,
  countFreeWeekends,
  feeAmountFromUnknown,
  formatIsoDate,
  memberPlanStatus,
  mergeEventPlans,
  parseFeeInput,
  planIsOpen,
  planNeedsAction,
  plansOnIsoDate,
  raceDatesFromPlans,
  saturdayOfRaceWeekend,
  type EventPlan,
  type PlannerEvent,
} from "@/lib/planner";

function event(partial: Partial<PlannerEvent> & Pick<PlannerEvent, "id" | "startDate" | "name">): PlannerEvent {
  return {
    slug: partial.slug ?? partial.id,
    endDate: null,
    level: "local",
    classLabel: null,
    disciplines: ["xco"],
    place: "Praha",
    countryCode: "CZ",
    registrationUrl: null,
    websiteUrl: null,
    ...partial,
  };
}

function plan(partial: Partial<EventPlan> & { event: PlannerEvent }): EventPlan {
  return {
    favorited: true,
    goingMemberIds: [],
    registered: false,
    paid: false,
    memberStatus: {},
    feeAmount: null,
    ...partial,
  };
}

describe("saturdayOfRaceWeekend", () => {
  it("keeps Saturday, rolls Sunday back, and weekdays forward", () => {
    expect(saturdayOfRaceWeekend("2026-08-22")).toBe("2026-08-22"); // Sat
    expect(saturdayOfRaceWeekend("2026-08-23")).toBe("2026-08-22"); // Sun
    expect(saturdayOfRaceWeekend("2026-08-21")).toBe("2026-08-22"); // Fri
    expect(saturdayOfRaceWeekend("2026-08-18")).toBe("2026-08-22"); // Tue
  });
});

describe("mergeEventPlans", () => {
  it("unions favorites and attendance and sorts by date", () => {
    const a = event({ id: "a", name: "Later", startDate: "2026-09-06" });
    const b = event({ id: "b", name: "Sooner", startDate: "2026-08-29" });
    const plans = mergeEventPlans({
      eventsById: { a, b },
      favoriteIds: ["a"],
      attendance: [
        { eventId: "b", memberId: "mates", status: "going", registered: true, paid: false },
        { eventId: "b", memberId: "me", status: "watching", registered: true, paid: false },
      ],
    });
    expect(plans.map((p) => p.event.id)).toEqual(["b", "a"]);
    expect(plans[0]?.goingMemberIds).toEqual(["mates"]);
    expect(plans[0]?.registered).toBe(true);
    expect(plans[0]?.memberStatus).toEqual({ mates: "registered", me: "registered" });
    expect(plans[1]?.favorited).toBe(true);
    expect(plans[0]?.feeAmount).toBeNull();
    expect(plans[1]?.feeAmount).toBeNull();
  });

  it("attaches user-entered entry fees", () => {
    const a = event({ id: "a", name: "A", startDate: "2026-09-06" });
    const plans = mergeEventPlans({
      eventsById: { a },
      favoriteIds: ["a"],
      attendance: [],
      feesByEventId: { a: 450 },
    });
    expect(plans[0]?.feeAmount).toBe(450);
  });
});

describe("planNeedsAction / planIsOpen", () => {
  const today = "2026-08-18";

  it("treats shortlisted-only as open, not action", () => {
    const p = plan({ event: event({ id: "x", name: "X", startDate: "2026-08-29" }) });
    expect(planIsOpen(p, today)).toBe(true);
    expect(planNeedsAction(p, today)).toBe(false);
  });

  it("needs action per person until paid", () => {
    const p = plan({
      event: event({ id: "x", name: "X", startDate: "2026-08-29" }),
      goingMemberIds: ["me"],
      memberStatus: { me: "going", mates: "paid" },
    });
    expect(planNeedsAction(p, today)).toBe(true);
    expect(planIsOpen(p, today)).toBe(false);
  });

  it("ignores past races", () => {
    const p = plan({
      event: event({ id: "x", name: "X", startDate: "2026-08-01" }),
      goingMemberIds: ["me"],
    });
    expect(planNeedsAction(p, today)).toBe(false);
    expect(planIsOpen(p, today)).toBe(false);
  });
});

describe("buildWeekendBoard", () => {
  it("answers whether this weekend is free and keeps empty weekends", () => {
    const now = new Date(2026, 7, 18, 12); // Tue 18 Aug 2026 → weekend 22–23 Aug
    const filled = plan({
      event: event({ id: "vg", name: "Van Gillern", startDate: "2026-08-29" }),
      goingMemberIds: ["me"],
    });
    const board = buildWeekendBoard({ plans: [filled], now, weeks: 4 });
    expect(board.currentSaturday).toBe("2026-08-22");
    expect(board.weekends).toHaveLength(4);
    expect(board.weekends[0]?.plans).toEqual([]);
    expect(board.weekends[1]?.plans.map((p) => p.event.id)).toEqual(["vg"]);
    expect(countFreeWeekends(board.weekends)).toBe(3);
    expect(countFreeWeekends(board.weekends, [6, 7])).toBe(0);
  });

  it("parks last weekend in past", () => {
    const now = new Date(2026, 7, 18, 12);
    const old = plan({
      event: event({ id: "old", name: "Old", startDate: "2026-08-15" }),
    });
    const board = buildWeekendBoard({ plans: [old], now, weeks: 2 });
    expect(board.past.map((p) => p.event.id)).toEqual(["old"]);
    expect(board.weekends.every((w) => w.plans.length === 0)).toBe(true);
  });
});

describe("plansOnIsoDate", () => {
  it("includes multi-day races that cover the day", () => {
    const weekend = plan({
      event: event({
        id: "stage",
        name: "Stage",
        startDate: "2026-08-22",
        endDate: "2026-08-23",
      }),
    });
    const other = plan({
      event: event({ id: "sun", name: "Sunday only", startDate: "2026-08-23" }),
    });
    expect(plansOnIsoDate([weekend, other], "2026-08-22").map((p) => p.event.id)).toEqual(["stage"]);
    expect(plansOnIsoDate([weekend, other], "2026-08-23").map((p) => p.event.id)).toEqual([
      "stage",
      "sun",
    ]);
    expect(plansOnIsoDate([weekend, other], "2026-08-24")).toEqual([]);
  });
});

describe("raceDatesFromPlans", () => {
  it("dedupes start dates and covers multi-day races", () => {
    const a = plan({ event: event({ id: "a", name: "A", startDate: "2026-08-22" }) });
    const b = plan({ event: event({ id: "b", name: "B", startDate: "2026-08-22" }) });
    const stage = plan({
      event: event({
        id: "stage",
        name: "Stage",
        startDate: "2026-08-22",
        endDate: "2026-08-23",
      }),
    });
    expect(raceDatesFromPlans([a, b]).map(formatIsoDate)).toEqual(["2026-08-22"]);
    expect(raceDatesFromPlans([stage]).map(formatIsoDate)).toEqual(["2026-08-22", "2026-08-23"]);
  });
});

describe("memberPlanStatus", () => {
  it("ranks paid over registered over going", () => {
    expect(memberPlanStatus(null)).toBe("none");
    expect(memberPlanStatus({ status: "watching", registered: false, paid: false })).toBe("none");
    expect(memberPlanStatus({ status: "going", registered: false, paid: false })).toBe("going");
    expect(memberPlanStatus({ status: "watching", registered: true, paid: false })).toBe(
      "registered",
    );
    expect(memberPlanStatus({ status: "going", registered: true, paid: true })).toBe("paid");
  });

  it("maps status back to attendance flags", () => {
    expect(attendanceFieldsForStatus("none")).toBeNull();
    expect(attendanceFieldsForStatus("going")).toEqual({
      status: "going",
      registered: false,
      paid: false,
    });
    expect(attendanceFieldsForStatus("registered")).toEqual({
      status: "going",
      registered: true,
      paid: false,
    });
    expect(attendanceFieldsForStatus("paid")).toEqual({
      status: "going",
      registered: true,
      paid: true,
    });
  });
});

describe("parseFeeInput", () => {
  it("parses empty, integers, and Czech decimals", () => {
    expect(parseFeeInput("")).toBeNull();
    expect(parseFeeInput("  ")).toBeNull();
    expect(parseFeeInput("450")).toBe(450);
    expect(parseFeeInput("450,50")).toBe(450.5);
    expect(parseFeeInput("1 200")).toBe(1200);
  });

  it("rejects junk and negatives", () => {
    expect(parseFeeInput("abc")).toBe("invalid");
    expect(parseFeeInput("-1")).toBe("invalid");
    expect(parseFeeInput("12.345")).toBe("invalid");
  });
});

describe("feeAmountFromUnknown", () => {
  it("coerces postgres numerics", () => {
    expect(feeAmountFromUnknown(null)).toBeNull();
    expect(feeAmountFromUnknown("450.00")).toBe(450);
    expect(feeAmountFromUnknown(0)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { daysUntil, planAction, planActions } from "@/lib/plan-actions";
import type { EventPlan, PlanMemberStatus, PlannerMember } from "@/lib/planner";

const members: PlannerMember[] = [
  { id: "me", name: "Me", relationship: "self", isSelf: true },
  { id: "kid", name: "Ema", relationship: "child", isSelf: false },
];

function plan(
  startDate: string,
  memberStatus: Record<string, PlanMemberStatus>,
  favorited = true,
): EventPlan {
  return {
    event: {
      id: startDate + JSON.stringify(memberStatus),
      name: "Race " + startDate,
      startDate,
      endDate: null,
      slug: "race",
      level: null,
      classLabel: null,
      disciplines: ["mtb"],
      place: "Brno",
      countryCode: "CZ",
      registrationUrl: null,
      websiteUrl: null,
    },
    favorited,
    goingMemberIds: Object.entries(memberStatus)
      .filter(([, s]) => s !== "none")
      .map(([id]) => id),
    registered: Object.values(memberStatus).some((s) => s === "registered" || s === "paid"),
    paid: Object.values(memberStatus).some((s) => s === "paid"),
    memberStatus,
    feeAmount: null,
  };
}

const today = "2026-09-08";

describe("planAction", () => {
  it("asks to pay when someone has entered", () => {
    expect(planAction(plan("2026-09-12", { me: "registered" }), { members, today })?.kind).toBe(
      "pay",
    );
  });

  it("asks to pay while anyone is still unpaid", () => {
    // One rider paid, one only entered: the race is still owed money.
    const a = planAction(plan("2026-09-12", { me: "paid", kid: "registered" }), { members, today });
    expect(a?.kind).toBe("pay");
  });

  it("asks to enter when someone is only going", () => {
    expect(planAction(plan("2026-09-12", { me: "going" }), { members, today })?.kind).toBe("enter");
  });

  it("wants nothing more once everyone has paid", () => {
    expect(planAction(plan("2026-09-12", { me: "paid", kid: "paid" }), { members, today })).toBeNull();
  });

  it("asks who is going only once the race is near", () => {
    expect(planAction(plan("2026-09-12", {}), { members, today })?.kind).toBe("who");
    expect(planAction(plan("2026-12-12", {}), { members, today })).toBeNull();
  });

  it("says nothing about a shortlist with nobody on the account", () => {
    expect(planAction(plan("2026-09-12", {}), { members: [], today })).toBeNull();
  });

  it("says nothing about a race that has been ridden", () => {
    expect(planAction(plan("2026-09-01", { me: "going" }), { members, today })).toBeNull();
  });

  it("keeps a race that is on today", () => {
    expect(planAction(plan(today, { me: "going" }), { members, today })?.daysAway).toBe(0);
  });

  it("keeps a stage race that started yesterday and ends tomorrow", () => {
    const p = plan("2026-09-07", { me: "going" });
    p.event.endDate = "2026-09-09";
    expect(planAction(p, { members, today })?.kind).toBe("enter");
  });
});

describe("planActions", () => {
  it("puts the soonest race first", () => {
    const list = planActions(
      [plan("2026-09-26", { me: "going" }), plan("2026-09-12", { me: "registered" })],
      { members, today },
    );
    expect(list.map((a) => a.kind)).toEqual(["pay", "enter"]);
    expect(list[0]!.daysAway).toBe(4);
  });
});

describe("daysUntil", () => {
  it("counts calendar days across a month end", () => {
    expect(daysUntil("2026-10-01", "2026-09-30")).toBe(1);
    expect(daysUntil("2026-09-30", "2026-10-01")).toBe(-1);
  });
});

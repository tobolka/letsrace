import { describe, expect, it } from "vitest";
import { buildWeeklyDigest, digestHasContent, pickDigestNearby } from "@/lib/plan-digest";
import type { EventPlan, PlannerEvent } from "@/lib/planner";

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
    goingMemberIds: ["me"],
    registered: false,
    paid: false,
    memberStatus: { me: "going" },
    feeAmount: null,
    ...partial,
  };
}

describe("buildWeeklyDigest", () => {
  const wednesday = new Date("2026-08-19T06:00:00+02:00");

  it("lists this weekend, unpaid going races, and a free next weekend", () => {
    const thisRace = plan({ event: event({ id: "a", name: "Sat", startDate: "2026-08-22" }) });
    const later = plan({
      event: event({ id: "b", name: "Later", startDate: "2026-09-05" }),
      memberStatus: { me: "going" },
    });
    const digest = buildWeeklyDigest({ plans: [thisRace, later], now: wednesday });
    expect(digest.thisWeekend.map((p) => p.event.id)).toEqual(["a"]);
    expect(digest.thisWeekendFree).toBe(false);
    expect(digest.needsAction.map((p) => p.event.id)).toEqual(["a", "b"]);
    expect(digest.nextWeekendFree).toBe(true);
  });

  it("does not call next weekend free when a race is already there", () => {
    const next = plan({ event: event({ id: "n", name: "Next", startDate: "2026-08-29" }) });
    const digest = buildWeeklyDigest({ plans: [next], now: wednesday });
    expect(digest.nextWeekendFree).toBe(false);
    expect(digest.thisWeekendFree).toBe(true);
  });
});

describe("pickDigestNearby", () => {
  it("picks the closest race that is not already in the plan", () => {
    const hit = pickDigestNearby(
      [
        { id: "in", name: "In plan", slug: "in", startDate: "2026-08-30", km: 5, place: "Praha" },
        { id: "far", name: "Far", slug: "far", startDate: "2026-08-30", km: 40, place: "Kladno" },
        { id: "near", name: "Near", slug: "near", startDate: "2026-08-30", km: 12, place: "Brandýs" },
      ],
      ["in"],
    );
    expect(hit?.id).toBe("near");
  });
});

describe("digestHasContent", () => {
  it("skips people with no plan and no nearby race", () => {
    const empty = buildWeeklyDigest({ plans: [], now: new Date("2026-08-19T06:00:00+02:00") });
    expect(digestHasContent(empty, false)).toBe(false);
    expect(digestHasContent({ ...empty, thisWeekendFree: true }, true)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { filterPlans } from "@/lib/plan-filters";
import type { EventPlan, PlannerMember } from "@/lib/planner";

const members: PlannerMember[] = [
  { id: "a", name: "Anna", relationship: "self", isSelf: true },
  { id: "b", name: "Boris", relationship: "child", isSelf: false },
];
const race = (id: string, memberStatus: EventPlan["memberStatus"]) => ({ event: { id }, memberStatus } as EventPlan);
const plans = [race("shared", { a: "going", b: "paid" }), race("entered", { a: "registered" }), race("saved", {})];
const ids = (rows: EventPlan[]) => rows.map((p) => p.event.id);

describe("plan filters", () => {
  it("keeps the full plan without filters, including saved races", () => {
    expect(ids(filterPlans(plans, members, "", "all"))).toEqual(["shared", "entered", "saved"]);
  });
  it("shows only races assigned to the selected rider", () => {
    expect(ids(filterPlans(plans, members, "a", "all"))).toEqual(["shared", "entered"]);
    expect(ids(filterPlans(plans, members, "b", "all"))).toEqual(["shared"]);
  });
  it("applies the status to that same rider, using the current exact step", () => {
    expect(ids(filterPlans(plans, members, "a", "paid"))).toEqual([]);
    expect(ids(filterPlans(plans, members, "b", "paid"))).toEqual(["shared"]);
    expect(ids(filterPlans(plans, members, "", "registered"))).toEqual(["entered"]);
    expect(ids(filterPlans(plans, members, "", "going"))).toEqual(["shared"]);
  });
  it("allows finding races a rider is not attending and handles an empty household", () => {
    expect(ids(filterPlans(plans, members, "a", "none"))).toEqual(["saved"]);
    expect(ids(filterPlans(plans, members, "b", "none"))).toEqual(["entered", "saved"]);
    expect(ids(filterPlans([plans[2]!], [], "", "none"))).toEqual(["saved"]);
  });
});

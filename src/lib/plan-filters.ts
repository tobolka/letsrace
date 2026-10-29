import type { EventPlan, PlanMemberStatus, PlannerMember } from "@/lib/planner";

export type PlanStatusFilter = "all" | PlanMemberStatus;

/** Both conditions must belong to the same rider, never two different people. */
export function filterPlans(
  plans: EventPlan[],
  members: PlannerMember[],
  riderId: string,
  status: PlanStatusFilter,
): EventPlan[] {
  return plans.filter((plan) => {
    if (riderId) {
      const riderStatus = plan.memberStatus[riderId] ?? "none";
      return status === "all" ? riderStatus !== "none" : riderStatus === status;
    }
    if (status === "all") return true;
    const statuses = members.length
      ? members.map((member) => plan.memberStatus[member.id] ?? "none")
      : Object.values(plan.memberStatus);
    return statuses.length ? statuses.includes(status) : status === "none";
  });
}

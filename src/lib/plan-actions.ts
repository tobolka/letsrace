import { todayIso } from "@/lib/date-presets";
import { parseIsoDate, type EventPlan, type PlannerMember } from "@/lib/planner";

/**
 * What is actually owed on a race, and by when.
 *
 * The plan used to answer this with one boolean — "needs action" — which is
 * enough to colour a filter tab and not enough to do anything with. Somebody
 * looking at their season on a Wednesday evening does not want to know that
 * four races need something; they want to know that entries for Saturday close
 * and nobody has paid.
 *
 * So each race gets one job, the most urgent one it has, in the order the job
 * actually falls: you decide who is going, then you enter, then you pay.
 */

export type PlanActionKind = "who" | "enter" | "pay";

export type PlanAction = {
  plan: EventPlan;
  kind: PlanActionKind;
  /** Calendar days from today to the start. 0 is today. */
  daysAway: number;
  /**
   * The day this job actually runs out — the entry deadline when there is one
   * and the job is to enter, the race day otherwise. A race in three weeks
   * whose entries close on Friday is this week's job.
   */
  dueInDays: number;
  /** The stated entry deadline, when it is what makes this urgent. */
  closesAt?: string;
};

/**
 * How near a race has to be before "nobody has said who is going" counts as a
 * job rather than a shortlist. A race in May is not a question in September.
 */
const DECIDE_WITHIN_DAYS = 28;

export function daysUntil(iso: string, today = todayIso()): number {
  const ms = parseIsoDate(iso).getTime() - parseIsoDate(today).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * The one thing this race is waiting for, or null when it is waiting for
 * nothing. Later steps win: a race where one rider has paid and another has
 * only entered is still waiting to be paid for.
 */
export function planAction(
  plan: EventPlan,
  opts: { members: PlannerMember[]; today?: string },
): PlanAction | null {
  const today = opts.today ?? todayIso();
  const last = plan.event.endDate ?? plan.event.startDate;
  if (last < today) return null;

  const daysAway = daysUntil(plan.event.startDate, today);
  const statuses = opts.members.map((m) => plan.memberStatus[m.id] ?? "none");
  const marked = statuses.filter((s) => s !== "none");

  // Nobody named yet. With no riders on the account there is nobody to name,
  // so the race is not waiting on this screen — the riders page is.
  if (marked.length === 0) {
    if (opts.members.length === 0) return null;
    if (!plan.favorited) return null;
    return daysAway <= DECIDE_WITHIN_DAYS
      ? { plan, kind: "who", daysAway, dueInDays: daysAway }
      : null;
  }

  if (marked.some((s) => s === "registered")) {
    return { plan, kind: "pay", daysAway, dueInDays: daysAway };
  }
  if (marked.some((s) => s === "going")) {
    // Entries usually close before the race, and when the source says when,
    // that date is the deadline this job is measured against.
    const closesAt = plan.event.registrationClosesAt ?? null;
    const closesIn = closesAt ? daysUntil(closesAt, today) : null;
    return closesAt && closesIn != null && closesIn < daysAway
      ? { plan, kind: "enter", daysAway, dueInDays: closesIn, closesAt }
      : { plan, kind: "enter", daysAway, dueInDays: daysAway };
  }
  return null;
}

/** Every job in the plan, soonest deadline first. */
export function planActions(
  plans: EventPlan[],
  opts: { members: PlannerMember[]; today?: string },
): PlanAction[] {
  return plans
    .map((plan) => planAction(plan, opts))
    .filter((a): a is PlanAction => a !== null)
    .sort(
      (a, b) => a.dueInDays - b.dueInDays || a.plan.event.name.localeCompare(b.plan.event.name),
    );
}

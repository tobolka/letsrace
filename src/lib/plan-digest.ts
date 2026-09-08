import { nextWeekendRange, thisWeekendRange, todayIso } from "@/lib/date-presets";
import { isBusyIsoDate } from "@/lib/plan-prefs";
import {
  planNeedsAction,
  saturdayOfRaceWeekend,
  type EventPlan,
} from "@/lib/planner";

export type DigestNearby = {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  km: number;
  place: string | null;
};

export type WeeklyDigest = {
  thisWeekend: EventPlan[];
  thisWeekendFree: boolean;
  needsAction: EventPlan[];
  nextWeekendFree: boolean;
  nearby: DigestNearby | null;
};

export function pragueIsoDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isWednesdayInPrague(now: Date): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    weekday: "short",
  }).format(now);
  return weekday === "Wed";
}

export function pickDigestNearby(
  candidates: DigestNearby[],
  planEventIds: Iterable<string>,
): DigestNearby | null {
  const inPlan = new Set(planEventIds);
  const next = candidates
    .filter((c) => !inPlan.has(c.id))
    .sort((a, b) => a.km - b.km || a.startDate.localeCompare(b.startDate));
  return next[0] ?? null;
}

export function buildWeeklyDigest(opts: {
  plans: EventPlan[];
  busyWeekdays?: number[];
  /** Days claimed by something that is not a race. */
  blockedDays?: ReadonlySet<string>;
  nearby?: DigestNearby | null;
  now?: Date;
}): WeeklyDigest {
  const now = opts.now ?? new Date();
  const today = todayIso(now);
  const weekend = thisWeekendRange(now);
  const next = nextWeekendRange(now);
  const busy = opts.busyWeekdays ?? [];
  const blocked = opts.blockedDays ?? new Set<string>();
  // A weekend is claimed if either of its days is: a wedding on the Sunday
  // takes the weekend as surely as one on the Saturday.
  const weekendTaken = (range: { from: string; to: string }) =>
    blocked.has(range.from) || blocked.has(range.to);

  const thisWeekend = opts.plans.filter((p) => {
    const sat = saturdayOfRaceWeekend(p.event.startDate);
    return sat === weekend.from;
  });
  const nextWeekend = opts.plans.filter((p) => saturdayOfRaceWeekend(p.event.startDate) === next.from);
  const nextBusy = isBusyIsoDate(next.from, busy) || isBusyIsoDate(next.to, busy);

  return {
    thisWeekend,
    // Telling someone their weekend is free when they have already said it is
    // taken is the fastest way to make the whole mail untrustworthy.
    thisWeekendFree: thisWeekend.length === 0 && !weekendTaken(weekend),
    needsAction: opts.plans.filter((p) => planNeedsAction(p, today)),
    nextWeekendFree: nextWeekend.length === 0 && !nextBusy && !weekendTaken(next),
    nearby: opts.nearby ?? null,
  };
}

export function digestHasContent(digest: WeeklyDigest, hasUpcomingPlan: boolean): boolean {
  if (!hasUpcomingPlan && !digest.nearby) return false;
  return (
    digest.thisWeekend.length > 0 ||
    digest.thisWeekendFree ||
    digest.needsAction.length > 0 ||
    digest.nextWeekendFree ||
    Boolean(digest.nearby)
  );
}

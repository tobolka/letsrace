import { thisWeekendRange, todayIso } from "@/lib/date-presets";
import { isBusyIsoDate } from "@/lib/plan-prefs";

export type PlannerEvent = {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  slug: string;
  level: string | null;
  classLabel: string | null;
  disciplines: string[];
  place: string | null;
  countryCode: string | null;
  registrationUrl: string | null;
  websiteUrl: string | null;
  seriesId?: string | null;
};

export type PlannerMember = {
  id: string;
  name: string;
  relationship: string;
  isSelf: boolean;
};

export type PlannerAttendance = {
  eventId: string;
  memberId: string;
  status: string;
  registered: boolean;
  paid: boolean;
};

export const PLAN_MEMBER_STATUSES = ["none", "going", "registered", "paid"] as const;
export type PlanMemberStatus = (typeof PLAN_MEMBER_STATUSES)[number];

export type EventPlan = {
  event: PlannerEvent;
  favorited: boolean;
  goingMemberIds: string[];
  registered: boolean;
  paid: boolean;
  memberStatus: Record<string, PlanMemberStatus>;
  feeAmount: number | null;
};

export type WeekendBucket = {
  saturday: string;
  sunday: string;
  isCurrent: boolean;
  plans: EventPlan[];
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoFromParts(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function formatIsoDate(d: Date): string {
  return isoFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return formatIsoDate(d);
}

/**
 * Race weekends are Sat–Sun. Weekday races belong to the upcoming Saturday
 * (the weekend you're packing the car for).
 */
export function saturdayOfRaceWeekend(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  const day = d.getDay();
  if (day === 6) return isoDate;
  if (day === 0) {
    d.setDate(d.getDate() - 1);
    return formatIsoDate(d);
  }
  d.setDate(d.getDate() + (6 - day));
  return formatIsoDate(d);
}

export function isGoingStatus(status: string | null | undefined): boolean {
  return status === "going";
}

export function memberPlanStatus(row?: {
  status: string;
  registered: boolean;
  paid: boolean;
} | null): PlanMemberStatus {
  if (!row) return "none";
  if (row.paid) return "paid";
  if (row.registered) return "registered";
  if (isGoingStatus(row.status)) return "going";
  return "none";
}

export function attendanceFieldsForStatus(status: PlanMemberStatus): {
  status: string;
  registered: boolean;
  paid: boolean;
} | null {
  if (status === "none") return null;
  return {
    status: "going",
    registered: status === "registered" || status === "paid",
    paid: status === "paid",
  };
}

export function mergeEventPlans(input: {
  eventsById: Record<string, PlannerEvent>;
  favoriteIds: string[];
  attendance: PlannerAttendance[];
  feesByEventId?: Record<string, number | null>;
}): EventPlan[] {
  const favoriteSet = new Set(input.favoriteIds);
  const ids = new Set<string>([...favoriteSet, ...input.attendance.map((a) => a.eventId)]);
  const plans: EventPlan[] = [];

  for (const id of ids) {
    const event = input.eventsById[id];
    if (!event) continue;
    const rows = input.attendance.filter((a) => a.eventId === id);
    const memberStatus: Record<string, PlanMemberStatus> = {};
    for (const row of rows) {
      memberStatus[row.memberId] = memberPlanStatus(row);
    }
    const fee = input.feesByEventId?.[id];
    plans.push({
      event,
      favorited: favoriteSet.has(id),
      goingMemberIds: rows.filter((a) => isGoingStatus(a.status)).map((a) => a.memberId),
      registered: rows.some((a) => a.registered),
      paid: rows.some((a) => a.paid),
      memberStatus,
      feeAmount: fee == null || Number.isNaN(fee) ? null : fee,
    });
  }

  return plans.sort((a, b) => {
    const byDate = a.event.startDate.localeCompare(b.event.startDate);
    if (byDate !== 0) return byDate;
    return a.event.name.localeCompare(b.event.name);
  });
}

/** Empty → null. Czech comma decimals allowed. */
export function parseFeeInput(text: string): number | null | "invalid" {
  const trimmed = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return "invalid";
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return "invalid";
  return n;
}

export function feeAmountFromUnknown(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function planNeedsAction(plan: EventPlan, today = todayIso()): boolean {
  if (plan.event.startDate < today) return false;
  const statuses = Object.values(plan.memberStatus ?? {});
  if (statuses.length > 0) {
    return statuses.some((s) => s === "going" || s === "registered");
  }
  const committed = plan.goingMemberIds.length > 0 || plan.registered || plan.paid;
  if (!committed) return false;
  return !plan.registered || !plan.paid;
}

export function planIsOpen(plan: EventPlan, today = todayIso()): boolean {
  return (
    plan.event.startDate >= today &&
    plan.favorited &&
    plan.goingMemberIds.length === 0 &&
    !plan.registered &&
    !plan.paid
  );
}

export function plansOnIsoDate(plans: EventPlan[], iso: string): EventPlan[] {
  return plans.filter((p) => {
    if (p.event.startDate === iso) return true;
    if (p.event.endDate && p.event.startDate <= iso && p.event.endDate >= iso) return true;
    return false;
  });
}

export function raceDatesFromPlans(plans: EventPlan[]): Date[] {
  const seen = new Set<string>();
  const out: Date[] = [];
  for (const p of plans) {
    const last =
      p.event.endDate && p.event.endDate > p.event.startDate ? p.event.endDate : p.event.startDate;
    let iso = p.event.startDate;
    while (iso <= last) {
      if (!seen.has(iso)) {
        seen.add(iso);
        out.push(parseIsoDate(iso));
      }
      if (iso === last) break;
      iso = addDaysIso(iso, 1);
    }
  }
  return out;
}

export function buildWeekendBoard(opts: {
  plans: EventPlan[];
  now?: Date;
  weeks?: number;
}): { currentSaturday: string; weekends: WeekendBucket[]; past: EventPlan[] } {
  const now = opts.now ?? new Date();
  const weeks = opts.weeks ?? 16;
  const currentSaturday = thisWeekendRange(now).from;
  const past = opts.plans
    .filter((p) => saturdayOfRaceWeekend(p.event.startDate) < currentSaturday)
    .sort((a, b) => b.event.startDate.localeCompare(a.event.startDate));

  const futurePlans = opts.plans.filter(
    (p) => saturdayOfRaceWeekend(p.event.startDate) >= currentSaturday,
  );
  const saturdays: string[] = [];
  for (let i = 0; i < weeks; i++) saturdays.push(addDaysIso(currentSaturday, i * 7));
  for (const plan of futurePlans) {
    const sat = saturdayOfRaceWeekend(plan.event.startDate);
    if (!saturdays.includes(sat)) saturdays.push(sat);
  }
  saturdays.sort();

  const weekends: WeekendBucket[] = saturdays.map((saturday) => ({
    saturday,
    sunday: addDaysIso(saturday, 1),
    isCurrent: saturday === currentSaturday,
    plans: futurePlans.filter((p) => saturdayOfRaceWeekend(p.event.startDate) === saturday),
  }));

  return { currentSaturday, weekends, past };
}

export function countFreeWeekends(weekends: WeekendBucket[], busyWeekdays: number[] = []): number {
  return weekends.filter((w) => {
    if (w.plans.length > 0) return false;
    if (isBusyIsoDate(w.saturday, busyWeekdays) || isBusyIsoDate(w.sunday, busyWeekdays)) return false;
    return true;
  }).length;
}

export function currentWeekendPlans(weekends: WeekendBucket[]): EventPlan[] {
  return weekends.find((w) => w.isCurrent)?.plans ?? [];
}

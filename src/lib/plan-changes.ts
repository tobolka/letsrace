import { expandDisciplineFilter } from "@/lib/taxonomy";

export const PLAN_CHANGE_KINDS = ["date", "cancelled", "registration", "discipline"] as const;
export type PlanChangeKind = (typeof PLAN_CHANGE_KINDS)[number];

export type EventSnapshot = {
  name: string;
  startDate: string;
  endDate: string | null;
  status: string | null;
  disciplines: string[];
  registrationUrl: string | null;
};

export type PlanChange = {
  kind: PlanChangeKind;
  fingerprint: string;
  payload: Record<string, string>;
};

const CANCELLED_NAME =
  /\b(zrušen[áéýoa]|zrušeno|cancelled|canceled|abgesagt|absage|odwołan[yea]?)\b/i;

export function isCancelledRaceName(name: string): boolean {
  return CANCELLED_NAME.test(name);
}

function isoDay(value: string | null | undefined): string {
  return (value ?? "").slice(0, 10);
}

export function calendarDayDiff(fromIso: string, toIso: string): number {
  const from = Date.parse(`${isoDay(fromIso)}T12:00:00Z`);
  const to = Date.parse(`${isoDay(toIso)}T12:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

/** Sources that disagree by a few days are a span; a jump of 3+ days is a reschedule. */
export function shouldTreatAsReschedule(beforeStart: string, incomingStart: string): boolean {
  return Math.abs(calendarDayDiff(beforeStart, incomingStart)) >= 3;
}

function isStartListUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /startovk|startlist|startovn[ií][\s_-]?cas/i.test(url);
}

function realRegistrationUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() || null;
  if (!trimmed || isStartListUrl(trimmed)) return null;
  return trimmed;
}

function disciplineLeaves(ids: string[]): Set<string> {
  return new Set(expandDisciplineFilter(ids.filter((d) => d && d !== "other")));
}

function disciplinesSwitched(before: string[], incoming: string[]): boolean {
  const prev = disciplineLeaves(before);
  const next = disciplineLeaves(incoming);
  if (prev.size === 0 || next.size === 0) return false;
  for (const id of next) {
    if (prev.has(id)) return false;
  }
  return true;
}

export function detectPlanChanges(before: EventSnapshot, after: EventSnapshot): PlanChange[] {
  const changes: PlanChange[] = [];
  const beforeStart = isoDay(before.startDate);
  const afterStart = isoDay(after.startDate);

  if (beforeStart && afterStart && beforeStart !== afterStart) {
    changes.push({
      kind: "date",
      fingerprint: `date:${beforeStart}:${afterStart}`,
      payload: { from: beforeStart, to: afterStart },
    });
  }

  const cancelled =
    after.status === "cancelled" ||
    (before.status !== "cancelled" && isCancelledRaceName(after.name));
  if (cancelled && before.status !== "cancelled" && !isCancelledRaceName(before.name)) {
    changes.push({
      kind: "cancelled",
      fingerprint: "cancelled",
      payload: {},
    });
  }

  const beforeReg = realRegistrationUrl(before.registrationUrl);
  const afterReg = realRegistrationUrl(after.registrationUrl);
  const opened =
    (!beforeReg && Boolean(afterReg)) ||
    (before.status !== "registration_open" && after.status === "registration_open");
  if (opened) {
    changes.push({
      kind: "registration",
      fingerprint: `registration:${afterReg ?? "open"}`,
      payload: afterReg ? { url: afterReg } : {},
    });
  }

  if (disciplinesSwitched(before.disciplines, after.disciplines)) {
    const to = after.disciplines.filter(Boolean).join(",");
    changes.push({
      kind: "discipline",
      fingerprint: `discipline:${before.disciplines.filter(Boolean).sort().join(",")}:${to}`,
      payload: { to },
    });
  }

  return changes;
}

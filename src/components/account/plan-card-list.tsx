"use client";

import { Fragment } from "react";
import { addDays, format, parseISO } from "date-fns";
import { PlanRaceCard } from "@/components/account/plan-race-card";
import { Badge } from "@/components/ui/badge";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { saturdayOfRaceWeekend, type EventPlan, type PlanMemberStatus, type PlannerMember } from "@/lib/planner";
import type { AttendanceRecord } from "@/lib/planner-db";
import { cn } from "@/lib/utils";

/**
 * The same plan as the table, for a screen too narrow to hold one. A row that
 * has to be scrolled sideways to find out whether the entry is paid is not a
 * row anyone reads, so on a phone each race becomes a card instead.
 */
export function PlanCardList({
  locale,
  plans,
  members,
  attendanceByEvent,
  busyId,
  muted,
  currentSaturday,
  showWeekendBands = true,
  onStatusChange,
  onDiscard,
}: {
  locale: string;
  plans: EventPlan[];
  members: PlannerMember[];
  attendanceByEvent: Record<string, AttendanceRecord[]>;
  busyId: string | null;
  muted?: boolean;
  currentSaturday?: string;
  showWeekendBands?: boolean;
  onStatusChange: (eventId: string, memberId: string, status: PlanMemberStatus) => void;
  onDiscard: (eventId: string) => void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);

  return (
    <div className={cn("flex flex-col gap-3", muted && "opacity-70")}>
      {plans.map((plan, i) => {
        const sat = saturdayOfRaceWeekend(plan.event.startDate);
        const prev = plans[i - 1];
        const showBand =
          showWeekendBands && (!prev || saturdayOfRaceWeekend(prev.event.startDate) !== sat);
        const weekendCount = plans.filter(
          (p) => saturdayOfRaceWeekend(p.event.startDate) === sat,
        ).length;

        return (
          <Fragment key={plan.event.id}>
            {showBand ? (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-sm font-medium">
                <span className="tabular-nums">
                  {format(parseISO(sat), "d. M.", { locale: df })}–
                  {format(addDays(parseISO(sat), 1), "d. M.", { locale: df })}
                </span>
                {sat === currentSaturday ? <Badge>{t.thisWeekend}</Badge> : null}
                {weekendCount > 1 ? <Badge variant="secondary">{t.planConflict}</Badge> : null}
              </div>
            ) : null}
            <PlanRaceCard
              locale={locale}
              plan={plan}
              members={members}
              attendance={attendanceByEvent[plan.event.id] ?? []}
              busy={busyId === plan.event.id}
              onStatusChange={(memberId, status) =>
                onStatusChange(plan.event.id, memberId, status)
              }
              onDiscard={() => onDiscard(plan.event.id)}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

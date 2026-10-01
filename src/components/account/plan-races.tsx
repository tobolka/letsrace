"use client";

import { Fragment } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarPlus, Compass, History, MapPinned } from "lucide-react";
import { PlanRow, planColumns } from "@/components/account/plan-row";
import { memberLabel } from "@/components/account/race-plan-controls";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import type { EventPlan, PlanMemberStatus, PlannerMember } from "@/lib/planner";

/**
 * The races still ahead, one row each, under the month they fall in.
 *
 * The sheet and the month grid answer "is that day free"; neither let you mark
 * anyone entered or paid, so the one place to do it was the to-do rail — and a
 * race that was already settled had nowhere to be changed at all. This is the
 * list you work through: every upcoming race, every rider's switch on it.
 */
export function PlanRaces({
  locale,
  upcoming,
  hasPast,
  past = false,
  notes,
  members,
  busyId,
  onStatusChange,
  onDiscard,
}: {
  locale: string;
  /** The races to list, in the order to list them. */
  upcoming: EventPlan[];
  /** Whether anything was ever in the plan — "empty" and "all ridden" read differently. */
  hasPast: boolean;
  /** The history rather than what is ahead: quieter rows, its own empty state. */
  past?: boolean;
  /** What each race is waiting for, by event id. */
  notes?: Record<string, string>;
  members: PlannerMember[];
  busyId: string | null;
  onStatusChange: (eventId: string, memberId: string, status: PlanMemberStatus) => void;
  onDiscard: (eventId: string) => void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);

  if (upcoming.length === 0 && past) {
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>{t.planPastEmpty}</EmptyTitle>
          <EmptyDescription>{t.planPastEmptyBody}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (upcoming.length === 0) {
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarPlus />
          </EmptyMedia>
          <EmptyTitle>{t.planNoUpcoming}</EmptyTitle>
          <EmptyDescription>{hasPast ? t.planNoUpcomingBody : t.planEmpty}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center">
          <Button asChild size="sm">
            <Link href={`/${locale}/account/recommendations`}>
              <Compass data-icon="inline-start" />
              {t.accountDiscover}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/${locale}`}>
              <MapPinned data-icon="inline-start" />
              {t.viewOnMap}
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div style={{ ["--plan-cols" as string]: planColumns(members.length) }}>
      {/* The columns, named once: the race, then each rider. Phones have no
          columns — each row carries the rider's name itself. */}
      <div
        className="hidden border-b bg-card py-2 pl-6 pr-4 text-xs font-medium text-muted-foreground md:grid md:gap-x-3 md:[grid-template-columns:var(--plan-cols)]"
        role="row"
      >
        <span>{t.planRaceColumn}</span>
        {members.map((m) => (
          <span key={m.id} className="truncate">
            {memberLabel(m, t)}
          </span>
        ))}
        <span aria-hidden />
      </div>
      {upcoming.map((plan, i) => {
        const newMonth =
          i === 0 || plan.event.startDate.slice(0, 7) !== upcoming[i - 1]!.event.startDate.slice(0, 7);
        return (
          <Fragment key={plan.event.id}>
            {newMonth ? (
              <h3 className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold tracking-wide first-letter:uppercase md:px-6 [&:not(:first-child)]:border-t">
                {format(parseISO(plan.event.startDate), "LLLL yyyy", { locale: df })}
              </h3>
            ) : (
              <div className="ml-4 border-t md:ml-6" aria-hidden />
            )}
            <PlanRow
              locale={locale}
              plan={plan}
              members={members}
              muted={past}
              note={notes?.[plan.event.id]}
              busy={busyId === plan.event.id}
              onStatusChange={(memberId, status) => onStatusChange(plan.event.id, memberId, status)}
              onDiscard={() => onDiscard(plan.event.id)}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import { MapPin, X } from "lucide-react";
import { planStatusLabels } from "@/components/account/plan-status-toggle";
import { memberLabel } from "@/components/account/race-plan-controls";
import { MonthCalendar, type CalendarItem } from "@/components/calendar/month-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { planRaceDates } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { eventMapPath } from "@/lib/event-url";
import { disciplineColor } from "@/lib/map-visuals";
import { isBusyIsoDate } from "@/lib/plan-prefs";
import type { BlockedDay, EventPlan, PlannerMember } from "@/lib/planner";

/**
 * The plan's month, on the app's one calendar.
 *
 * The same grid the race calendar uses — dots on the days races run, "+N"
 * opening the day — with what only the plan knows laid over it: days already
 * spoken for are greyed and say why, and a race opens a card with who is going
 * and whether it is paid for, instead of the catalogue's card.
 */
export function PlanMonthView({
  locale,
  month,
  plans,
  members,
  busyWeekdays,
  blocked,
  selectedDay,
  onPickDay,
  renderDayActions,
  fill = false,
}: {
  locale: string;
  /** Any date in the month being shown. */
  month: string;
  plans: EventPlan[];
  members: PlannerMember[];
  busyWeekdays: number[];
  blocked: Record<string, BlockedDay>;
  selectedDay: string | null;
  onPickDay: (iso: string) => void;
  renderDayActions: (iso: string) => React.ReactNode;
  fill?: boolean;
}) {
  const t = messagesFor(locale);
  const items: CalendarItem[] = plans.map((p) => ({
    id: p.event.id,
    name: p.event.name,
    startDate: p.event.startDate,
    endDate: p.event.endDate,
    color: disciplineColor(p.event.disciplines),
    meta: [p.event.place, p.event.countryCode].filter(Boolean).join(" · "),
  }));
  const byId = new Map(plans.map((p) => [p.event.id, p]));

  return (
    <MonthCalendar
      locale={locale}
      month={month}
      items={items}
      selectedDay={selectedDay}
      onPickDay={onPickDay}
      renderDayActions={renderDayActions}
      fill={fill}
      dayInfo={(iso) => {
        const taken = blocked[iso];
        const busy = isBusyIsoDate(iso, busyWeekdays);
        if (!taken && !busy) return undefined;
        return { muted: true, note: taken ? taken.note || t.weekendTaken : undefined };
      }}
      renderDetail={(id, close) => {
        const plan = byId.get(id);
        return plan ? <PlanRaceCard locale={locale} plan={plan} members={members} onClose={close} /> : null;
      }}
    />
  );
}

/** A race in the plan, floating over its day: when, where, who, and what is left to do. */
function PlanRaceCard({
  locale,
  plan,
  members,
  onClose,
}: {
  locale: string;
  plan: EventPlan;
  members: PlannerMember[];
  onClose: () => void;
}) {
  const t = messagesFor(locale);
  const { event } = plan;
  const labels = planStatusLabels(t);
  const attendees = members
    .map((member) => ({ member, status: plan.memberStatus[member.id] ?? "none" }))
    .filter(({ status }) => status !== "none");

  return (
    <Card className="w-80 gap-0 border-0 py-0 shadow-none">
      <CardHeader className="flex flex-row items-start gap-2 border-b px-4 py-3 [.border-b]:pb-3">
        <CardTitle className="flex min-w-0 flex-1 items-stretch gap-2.5 text-base leading-snug">
          <span
            aria-hidden
            className="mt-1 w-[3px] shrink-0 self-stretch rounded-full"
            style={{ background: disciplineColor(event.disciplines) }}
          />
          <span className="min-w-0">{event.name}</span>
        </CardTitle>
        <CardAction>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t.close} onClick={onClose}>
            <X />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 py-3 text-sm">
        <p className="first-letter:uppercase">{planRaceDates(event, locale, "long")}</p>
        {event.place ? (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-4" aria-hidden />
            {[event.place, event.countryCode].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {attendees.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {attendees.map(({ member, status }) => (
              <Badge key={member.id} variant="secondary">
                {memberLabel(member, t)} · {labels[status]}
              </Badge>
            ))}
          </div>
        ) : members.length > 0 ? (
          <p className="text-xs text-muted-foreground">{t.planNotGoing}</p>
        ) : null}
      </CardContent>
      <CardFooter className="border-t px-4 py-2 [.border-t]:pt-2">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link
            href={eventMapPath(locale, {
              slug: event.slug,
              startDate: event.startDate,
              endDate: event.endDate,
            })}
          >
            <MapPin data-icon="inline-start" />
            {t.viewOnMap}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

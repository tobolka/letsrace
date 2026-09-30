"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Check, MapPin, X } from "lucide-react";
import { MonthCalendar, type CalendarItem } from "@/components/calendar/month-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { dateFnsLocale } from "@/lib/i18n/dates";
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
  const df = dateFnsLocale(locale);
  const { event } = plan;
  const going = members.filter((m) => plan.goingMemberIds.includes(m.id));
  const date =
    format(parseISO(event.startDate), "EEEE d. MMMM", { locale: df }) +
    (event.endDate && event.endDate !== event.startDate
      ? ` – ${format(parseISO(event.endDate), "d. MMMM", { locale: df })}`
      : "");

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
        <p className="first-letter:uppercase">{date}</p>
        {event.place ? (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-4" aria-hidden />
            {[event.place, event.countryCode].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {going.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t.planGoing}:</span>
            {going.map((m) => (
              <Badge key={m.id} variant="secondary">
                {m.name}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={plan.registered ? "secondary" : "outline"} className="gap-1">
            {plan.registered ? <Check className="text-emerald-600" /> : null}
            {t.planRegistered}
          </Badge>
          <Badge variant={plan.paid ? "secondary" : "outline"} className="gap-1">
            {plan.paid ? <Check className="text-emerald-600" /> : null}
            {t.planPaid}
          </Badge>
        </div>
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

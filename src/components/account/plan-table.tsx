"use client";

import { Fragment } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { PlanDiscardButton } from "@/components/account/plan-discard-button";
import { PlanStatusToggle, planRowSummary } from "@/components/account/plan-status-toggle";
import { memberLabel } from "@/components/account/race-plan-controls";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { eventMapPath } from "@/lib/event-url";
import {
  saturdayOfRaceWeekend,
  weekendSpread,
  type EventPlan,
  type PlanMemberStatus,
  type PlannerMember,
} from "@/lib/planner";
import { DISCIPLINE_LABELS, type Discipline } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

function weekendKey(plan: EventPlan) {
  return saturdayOfRaceWeekend(plan.event.startDate);
}

export function PlanTable({
  locale,
  plans,
  members,
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
    <Card className="overflow-hidden py-0">
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 z-10 min-w-56 bg-card">
            {t.planColRace}
          </TableHead>
          {members.map((m) => (
            <TableHead key={m.id} className="min-w-32">
              {memberLabel(m, t)}
            </TableHead>
          ))}
          <TableHead className="min-w-24">{t.planPaid}</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">{t.planDiscard}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plans.map((plan, i) => {
          const prev = plans[i - 1];
          const sat = weekendKey(plan);
          const showBand = showWeekendBands && (!prev || weekendKey(prev) !== sat);
          const weekendPlans = plans.filter((p) => weekendKey(p) === sat);
          const disc =
            DISCIPLINE_LABELS[(plan.event.disciplines[0] ?? "") as Discipline] ||
            plan.event.disciplines[0];
          const place = [plan.event.place, plan.event.countryCode].filter(Boolean).join(" · ");

          return (
            <Fragment key={plan.event.id}>
              {showBand ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3 + members.length} className="bg-muted/50">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="tabular-nums">
                        {format(parseISO(sat), "d. M.", { locale: df })}
                        –
                        {format(addDays(parseISO(sat), 1), "d. M.", { locale: df })}
                      </span>
                      {sat === currentSaturday ? <Badge>{t.thisWeekend}</Badge> : null}
                      <WeekendSpreadBadge locale={locale} plans={weekendPlans} />
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
              <TableRow className={cn(muted && "opacity-70")}>
                <TableCell className="sticky left-0 z-10 whitespace-normal bg-card">
                  <div className="flex min-w-52 flex-col gap-0.5">
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {format(parseISO(plan.event.startDate), "EEE d. M.", { locale: df })}
                      {place ? ` · ${place}` : ""}
                      {disc ? ` · ${disc}` : ""}
                    </p>
                    <Link
                      href={eventMapPath(locale, {
                        slug: plan.event.slug,
                        startDate: plan.event.startDate,
                        endDate: plan.event.endDate,
                      })}
                      className="font-medium leading-snug hover:underline"
                    >
                      {plan.event.name}
                    </Link>
                  </div>
                </TableCell>
                {members.map((m) => {
                  const status = plan.memberStatus[m.id] ?? "none";
                  return (
                    <TableCell key={m.id}>
                      <PlanStatusToggle
                        locale={locale}
                        value={status}
                        disabled={busyId === plan.event.id}
                        memberName={memberLabel(m, t)}
                        eventName={plan.event.name}
                        onChange={(next) => onStatusChange(plan.event.id, m.id, next)}
                      />
                    </TableCell>
                  );
                })}
                <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {(() => {
                    const sum = planRowSummary(
                      members.map((m) => plan.memberStatus[m.id] ?? "none"),
                    );
                    if (sum.going === 0) return null;
                    const settled = sum.paid === sum.going;
                    return (
                      <Badge variant={settled ? "secondary" : "outline"}>
                        {sum.paid}/{sum.going} {t.planPaid.toLowerCase()}
                      </Badge>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <PlanDiscardButton
                    locale={locale}
                    eventName={plan.event.name}
                    disabled={busyId === plan.event.id}
                    iconOnly
                    onConfirm={() => onDiscard(plan.event.id)}
                  />
                </TableCell>
              </TableRow>
            </Fragment>
          );
        })}
      </TableBody>
      </Table>
    </Card>
  );
}

function WeekendSpreadBadge({ locale, plans }: { locale: string; plans: EventPlan[] }) {
  const t = messagesFor(locale);
  const spread = weekendSpread(plans);
  if (spread === "single") return null;
  return (
    <Badge variant={spread === "same-day" ? "outline" : "secondary"}>
      {spread === "same-day" ? t.planSameDay : t.planBothDays}
    </Badge>
  );
}

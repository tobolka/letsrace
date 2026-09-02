"use client";

import Link from "next/link";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ExternalLink, MapPin } from "lucide-react";
import { PlanStatusToggle } from "@/components/account/plan-status-toggle";
import { memberLabel } from "@/components/account/race-plan-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { eventMapPath } from "@/lib/event-url";
import { todayIso } from "@/lib/date-presets";
import type { EventPlan, PlanMemberStatus, PlannerMember } from "@/lib/planner";
import { DISCIPLINE_LABELS, type Discipline } from "@/lib/taxonomy";

/**
 * The one race that is actually about to happen, at the top, with the two
 * questions it raises answered in place: how long have I got, and is everyone
 * signed up. Everything below this card is planning; this is the week.
 */
export function NextRaceCard({
  locale,
  plan,
  members,
  busy,
  onStatusChange,
}: {
  locale: string;
  plan: EventPlan;
  members: PlannerMember[];
  busy: boolean;
  onStatusChange: (memberId: string, status: PlanMemberStatus) => void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const days = differenceInCalendarDays(parseISO(plan.event.startDate), parseISO(todayIso()));
  const countdown =
    days <= 0 ? t.nextRaceToday : days === 1 ? t.nextRaceTomorrow : t.nextRaceIn.replace("{n}", String(days));
  const disc =
    DISCIPLINE_LABELS[(plan.event.disciplines[0] ?? "") as Discipline] || plan.event.disciplines[0];
  const meta = [
    format(parseISO(plan.event.startDate), "EEEE d. MMMM", { locale: df }),
    [plan.event.place, plan.event.countryCode].filter(Boolean).join(" · "),
    disc,
  ]
    .filter(Boolean)
    .join(" · ");
  const marked = members.filter((m) => (plan.memberStatus[m.id] ?? "none") !== "none").length;

  return (
    <Card className="overflow-hidden border-brand/30">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.nextRaceTitle}
              <Badge className="tabular-nums">{countdown}</Badge>
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight">
              <Link
                href={eventMapPath(locale, {
                  slug: plan.event.slug,
                  startDate: plan.event.startDate,
                  endDate: plan.event.endDate,
                })}
                className="hover:underline"
              >
                {plan.event.name}
              </Link>
            </h2>
            <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">{meta}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                href={eventMapPath(locale, {
                  slug: plan.event.slug,
                  startDate: plan.event.startDate,
                  endDate: plan.event.endDate,
                })}
              >
                <MapPin data-icon="inline-start" />
                {t.planOpenMap}
              </Link>
            </Button>
            {plan.event.registrationUrl ? (
              <Button asChild size="sm">
                <a href={plan.event.registrationUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink data-icon="inline-start" />
                  {t.register}
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        {members.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
            {marked === 0 ? (
              <span className="text-sm text-muted-foreground">{t.planNobodyYet}</span>
            ) : null}
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="text-sm font-medium">{memberLabel(m, t)}</span>
                <PlanStatusToggle
                  locale={locale}
                  value={plan.memberStatus[m.id] ?? "none"}
                  disabled={busy}
                  memberName={memberLabel(m, t)}
                  eventName={plan.event.name}
                  onChange={(next) => onStatusChange(m.id, next)}
                />
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

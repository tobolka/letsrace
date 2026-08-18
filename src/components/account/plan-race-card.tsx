"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ExternalLink, MapPin } from "lucide-react";
import { PlanDiscardButton } from "@/components/account/plan-discard-button";
import { RacePlanControls } from "@/components/account/race-plan-controls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { eventMapPath } from "@/lib/event-url";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import type { AttendanceRecord } from "@/lib/planner-db";
import type { EventPlan, PlanMemberStatus, PlannerMember } from "@/lib/planner";
import { DISCIPLINE_LABELS, type Discipline } from "@/lib/taxonomy";

export function PlanRaceCard({
  locale,
  plan,
  members,
  attendance,
  busy,
  onStatusChange,
  onDiscard,
}: {
  locale: string;
  plan: EventPlan;
  members: PlannerMember[];
  attendance: AttendanceRecord[];
  busy?: boolean;
  onStatusChange: (memberId: string, status: PlanMemberStatus) => void;
  onDiscard: () => void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const disc =
    DISCIPLINE_LABELS[(plan.event.disciplines[0] ?? "") as Discipline] ||
    plan.event.disciplines[0];
  const place = [plan.event.place, plan.event.countryCode].filter(Boolean).join(" · ");
  const meta = [
    format(parseISO(plan.event.startDate), "EEE d. M.", { locale: df }),
    place,
    disc,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardHeader>
        <CardDescription className="tabular-nums">{meta}</CardDescription>
        <CardTitle className="text-lg leading-snug">{plan.event.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {members.length > 0 ? (
          <RacePlanControls
            locale={locale}
            members={members}
            attendance={attendance}
            busy={busy}
            addPeopleHref={`/${locale}/account`}
            onStatusChange={onStatusChange}
          />
        ) : (
          <Link
            href={`/${locale}/account`}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {t.planAddPeople}…
          </Link>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <PlanDiscardButton
          locale={locale}
          eventName={plan.event.name}
          disabled={busy}
          onConfirm={onDiscard}
        />
        <div className="flex flex-wrap gap-2">
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
              <a
                href={plan.event.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink data-icon="inline-start" />
                {t.register}
              </a>
            </Button>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}

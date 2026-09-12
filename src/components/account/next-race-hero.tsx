"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ExternalLink, MapPin } from "lucide-react";
import { PlanStatusToggle } from "@/components/account/plan-status-toggle";
import { memberLabel } from "@/components/account/race-plan-controls";
import { Button } from "@/components/ui/button";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { eventMapPath } from "@/lib/event-url";
import { disciplineColor } from "@/lib/map-visuals";
import { daysUntil } from "@/lib/plan-actions";
import type { EventPlan, PlanMemberStatus, PlannerMember } from "@/lib/planner";
import { disciplineLabel } from "@/lib/i18n/taxonomy";

/**
 * The race that is actually about to happen, given the room a whole page used
 * to spend on a month grid.
 *
 * The date is set as a date and not as a sentence, because the question this
 * answers on a Wednesday evening is "how many sleeps", and a number answers it
 * before the name has been read. Everything else on this page is the season;
 * this is the week.
 */
export function NextRaceHero({
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
  const start = parseISO(plan.event.startDate);
  const days = daysUntil(plan.event.startDate);
  const countdown =
    days <= 0
      ? t.nextRaceToday
      : days === 1
        ? t.nextRaceTomorrow
        : t.nextRaceIn.replace("{n}", String(days));
  const disc =
    disciplineLabel(plan.event.disciplines[0] ?? "", locale);
  const meta = [
    [plan.event.place, plan.event.countryCode].filter(Boolean).join(" · "),
    disc,
    plan.event.classLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const href = eventMapPath(locale, {
    slug: plan.event.slug,
    startDate: plan.event.startDate,
    endDate: plan.event.endDate,
  });
  const accent = disciplineColor(plan.event.disciplines);
  // An entry deadline is only news while it is ahead of you and ahead of the
  // race; after either it is a date that can only mislead.
  const closesAt = plan.event.registrationClosesAt ?? null;
  const showClosing =
    closesAt && daysUntil(closesAt) >= 0 && closesAt < plan.event.startDate ? closesAt : null;

  return (
    <section
      aria-labelledby="next-race"
      className="relative overflow-hidden rounded-xl border bg-card"
    >
      {/* The discipline runs down the edge, the same statement the map pins
          and the race list make. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <div className="flex flex-col gap-5 p-5 pl-6 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex shrink-0 items-baseline gap-2 sm:flex-col sm:items-center sm:gap-0">
          <span className="text-4xl font-semibold leading-none tabular-nums sm:text-5xl">
            {format(start, "d", { locale: df })}
          </span>
          <span className="text-sm uppercase tracking-wide text-muted-foreground sm:mt-1">
            {format(start, "MMM", { locale: df })}
          </span>
          <span className="text-xs text-muted-foreground sm:mt-0.5">
            {format(start, "EEEE", { locale: df })}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.nextRaceTitle} · <span className="tabular-nums text-foreground">{countdown}</span>
            </p>
            <h2 id="next-race" className="text-xl font-semibold leading-tight sm:text-2xl">
              <Link href={href} className="hover:underline">
                {plan.event.name}
              </Link>
            </h2>
            {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
          </div>

          {members.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{memberLabel(m, t)}</span>
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

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={href}>
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
            ) : plan.event.websiteUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={plan.event.websiteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink data-icon="inline-start" />
                  {t.openWebsite}
                </a>
              </Button>
            ) : null}
            {showClosing ? (
              <span className="self-center text-xs tabular-nums text-muted-foreground">
                {t.planEntryCloses.replace(
                  "{date}",
                  format(parseISO(showClosing), "d. M.", { locale: df }),
                )}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

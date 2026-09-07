"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ExternalLink } from "lucide-react";
import { PlanDiscardButton } from "@/components/account/plan-discard-button";
import { PlanStatusToggle } from "@/components/account/plan-status-toggle";
import { memberLabel } from "@/components/account/race-plan-controls";
import { Button } from "@/components/ui/button";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { eventMapPath } from "@/lib/event-url";
import { disciplineColor } from "@/lib/map-visuals";
import type { EventPlan, PlanMemberStatus, PlannerMember } from "@/lib/planner";
import { DISCIPLINE_LABELS, type Discipline } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

/**
 * One race in the plan, on one row, on every screen.
 *
 * There were two of these — a table for desktop whose paid column had to be
 * scrolled sideways to reach, and a stack of cards for phones, each with a
 * header, a body and a footer for a race that is three facts and three
 * switches. They said the same thing twice and drifted apart every time either
 * changed.
 *
 * The shape is the one the map list settled on: name, then the details under
 * it in a quieter size, with the discipline as a coloured edge rather than a
 * dot that reads like an unread badge. What is different here is the right
 * side, because this is the screen where you actually mark the family in.
 */
export function PlanRow({
  locale,
  plan,
  members,
  busy,
  muted,
  note,
  onStatusChange,
  onDiscard,
}: {
  locale: string;
  plan: EventPlan;
  members: PlannerMember[];
  busy?: boolean;
  muted?: boolean;
  /** What this race is waiting for, when it is being shown as a job. */
  note?: string;
  onStatusChange: (memberId: string, status: PlanMemberStatus) => void;
  onDiscard: () => void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const disc =
    DISCIPLINE_LABELS[(plan.event.disciplines[0] ?? "") as Discipline] ||
    plan.event.disciplines[0];
  const meta = [
    format(parseISO(plan.event.startDate), "EEE d. M.", { locale: df }),
    [plan.event.place, plan.event.countryCode].filter(Boolean).join(" · "),
    disc,
  ]
    .filter(Boolean)
    .join(" · ");
  const href = eventMapPath(locale, {
    slug: plan.event.slug,
    startDate: plan.event.startDate,
    endDate: plan.event.endDate,
  });

  const actions = (
    <>
      {plan.event.registrationUrl ? (
        <Button asChild variant="ghost" size="icon-sm" aria-label={t.register}>
          <a href={plan.event.registrationUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
          </a>
        </Button>
      ) : null}
      <PlanDiscardButton
        locale={locale}
        eventName={plan.event.name}
        disabled={busy}
        iconOnly
        onConfirm={onDiscard}
      />
    </>
  );

  return (
    <div
      className={cn(
        "relative flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5 pl-4 pr-1.5",
        muted && "opacity-70",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-2.5 left-0 w-[3px] rounded-full"
        style={{ background: disciplineColor(plan.event.disciplines) }}
      />
      <div className="flex min-w-0 flex-1 basis-56 items-start gap-1">
        <div className="min-w-0 flex-1">
          <Link
            href={href}
            className="block truncate text-sm font-medium leading-snug hover:underline"
          >
            {plan.event.name}
          </Link>
          <span className="block truncate text-xs leading-snug text-muted-foreground">
            {note ? <span className="font-medium text-foreground">{note} · </span> : null}
            {meta}
          </span>
        </div>
        {/* A finger-sized toggle is 44px, and three of them each for two riders
            plus these two buttons do not fit across a phone. On that width the
            buttons sit up on the name instead, where there is room. */}
        <div className="flex shrink-0 items-center sm:hidden">{actions}</div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
        <div className="hidden shrink-0 items-center sm:flex">{actions}</div>
      </div>
    </div>
  );
}

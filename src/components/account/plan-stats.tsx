"use client";

import { CalendarCheck, CalendarRange, CircleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { messagesFor } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * The three numbers that answer "how is the season going" without opening
 * anything: how much is booked, what still needs doing, and how many weekends
 * are still free.
 */
export function PlanStats({
  locale,
  upcoming,
  needsAction,
  freeWeekends,
  onShowAction,
}: {
  locale: string;
  upcoming: number;
  needsAction: number;
  freeWeekends: number;
  onShowAction: () => void;
}) {
  const t = messagesFor(locale);

  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat icon={CalendarCheck} label={t.planStatsRaces} value={String(upcoming)} />
      <Stat
        icon={CircleAlert}
        label={t.planStatsAction}
        value={String(needsAction)}
        tone={needsAction > 0 ? "warn" : undefined}
        onClick={needsAction > 0 ? onShowAction : undefined}
      />
      <Stat icon={CalendarRange} label={t.planStatsFree} value={String(freeWeekends)} />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
  tone,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  note?: string;
  tone?: "warn";
  onClick?: () => void;
}) {
  // The number leads so the three tiles line up even when a label wraps to a
  // second line on a narrow phone.
  const body = (
    <>
      <span
        className={cn(
          "truncate text-2xl font-semibold leading-none tabular-nums",
          tone === "warn" && "text-brand",
        )}
      >
        {value}
      </span>
      <span className="flex items-start gap-1.5 text-xs leading-tight text-muted-foreground">
        <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
        {label}
      </span>
      {note ? <span className="truncate text-xs tabular-nums text-muted-foreground">{note}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <Card className="min-w-0 gap-1.5 p-0 transition-colors hover:bg-accent">
        <button type="button" onClick={onClick} className="flex min-w-0 flex-col gap-1.5 p-3 text-left">
          {body}
        </button>
      </Card>
    );
  }
  return <Card className="min-w-0 gap-1.5 p-3">{body}</Card>;
}

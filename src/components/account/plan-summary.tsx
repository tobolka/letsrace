"use client";

import { format, parseISO } from "date-fns";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { daysUntil } from "@/lib/plan-actions";
import type { EventPlan } from "@/lib/planner";
import { cn } from "@/lib/utils";

/**
 * The four numbers someone opens the plan to learn, before they read a row:
 * how long until the next start, how much is booked, what is still waiting on
 * them, and how the year has gone. One strip, not four cards — they are one
 * answer to "where are we".
 */
export function PlanSummary({
  locale,
  nextRace,
  upcoming,
  todo,
  ridden,
}: {
  locale: string;
  nextRace: EventPlan | null;
  upcoming: number;
  todo: number;
  ridden: number;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const days = nextRace ? daysUntil(nextRace.event.startDate) : null;
  const countdown =
    days == null
      ? t.planStatNone
      : days <= 0
        ? t.nextRaceToday
        : days === 1
          ? t.nextRaceTomorrow
          : t.nextRaceIn.replace("{n}", String(days));

  const tiles: { label: string; value: string; hint?: string; tone?: "brand" | "muted" }[] = [
    {
      label: t.planStatNext,
      value: countdown,
      hint: nextRace
        ? format(parseISO(nextRace.event.startDate), "EEEE d. M.", { locale: df })
        : undefined,
      tone: days == null ? "muted" : undefined,
    },
    { label: t.planStatUpcoming, value: String(upcoming) },
    { label: t.planStatTodo, value: String(todo), tone: todo > 0 ? "brand" : undefined },
    { label: t.planStatRidden, value: String(ridden) },
  ];

  return (
    <dl className="grid grid-cols-2 overflow-clip rounded-xl border bg-card shadow-sm lg:grid-cols-4">
      {tiles.map((tile, i) => (
        <div
          key={tile.label}
          className={cn(
            "flex min-w-0 flex-col gap-1 px-4 py-3.5",
            // Hairlines between tiles, never on the card's own edge.
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t lg:border-t-0",
            i === 2 && "lg:border-l",
          )}
        >
          <dt className="truncate text-xs text-muted-foreground">{tile.label}</dt>
          <dd
            className={cn(
              "truncate text-xl font-semibold leading-tight tabular-nums first-letter:uppercase",
              tile.tone === "brand" && "text-brand",
              tile.tone === "muted" && "text-base font-medium text-muted-foreground",
            )}
          >
            {tile.value}
          </dd>
          {tile.hint ? (
            <dd className="truncate text-xs text-muted-foreground first-letter:uppercase">
              {tile.hint}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

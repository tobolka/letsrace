"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarOff } from "lucide-react";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { eventMapPath } from "@/lib/event-url";
import { disciplineColor } from "@/lib/map-visuals";
import { monthGrid, type MonthDay } from "@/lib/plan-month";
import { isBusyIsoDate } from "@/lib/plan-prefs";
import { plansOnIsoDate, type BlockedDay, type EventPlan } from "@/lib/planner";
import { cn } from "@/lib/utils";

/** How many races fit in a cell before it says "+2". */
const PER_CELL = 3;

/**
 * The month, with every day on it.
 *
 * A row of weekends could not hold a Wednesday criterium and could not tell a
 * month with one race from a month with five. Here a race sits on its own day,
 * the free weekends are still the holes you scan for, and a day you have
 * already spoken for is greyed rather than silently counted as free.
 */
export function PlanMonthView({
  locale,
  month,
  plans,
  busyWeekdays,
  blocked,
  selectedDay,
  onPickDay,
}: {
  locale: string;
  /** Any date in the month being shown. */
  month: string;
  plans: EventPlan[];
  busyWeekdays: number[];
  blocked: Record<string, BlockedDay>;
  selectedDay: string | null;
  onPickDay: (day: MonthDay) => void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const weeks = monthGrid(month);
  // Monday-first weekday headings, taken from the first row so they follow the
  // reader's locale rather than a hard-coded list.
  const headings = weeks[0]!.map((d) => format(parseISO(d.iso), "EEEEEE", { locale: df }));

  return (
    <div>
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {headings.map((label, i) => (
          <div
            key={label + i}
            className={cn(
              "px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide",
              i >= 5 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((day, i) => {
          const dayPlans = plansOnIsoDate(plans, day.iso);
          const taken = blocked[day.iso];
          const isBusy = isBusyIsoDate(day.iso, busyWeekdays);
          const blockedHere = Boolean(taken);
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onPickDay(day)}
              aria-current={day.isToday ? "date" : undefined}
              className={cn(
                "flex min-h-24 flex-col gap-1 border-r border-b p-1.5 text-left align-top transition-colors",
                // The last column and the last row would draw a line on the
                // card's own border.
                i % 7 === 6 && "border-r-0",
                i >= weeks.flat().length - 7 && "border-b-0",
                day.inMonth ? "bg-card" : "bg-muted/20",
                // The weekend is the part of the row people plan around, so it
                // is shaded rather than outlined — an outline on two cells of
                // seven reads as an error, not as emphasis.
                day.isWeekend && day.inMonth && "bg-stone-200/55 dark:bg-stone-900/50",
                (isBusy || blockedHere) && "bg-muted/60",
                day.iso === selectedDay && "bg-brand/8 inset-ring inset-ring-brand/40",
                "hover:bg-accent/60",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-xs tabular-nums",
                  day.inMonth ? "text-foreground" : "text-muted-foreground/60",
                  day.isToday && "bg-brand font-semibold text-white",
                )}
              >
                {day.day}
              </span>

              {dayPlans.slice(0, PER_CELL).map((plan) => (
                <Link
                  key={plan.event.id}
                  href={eventMapPath(locale, {
                    slug: plan.event.slug,
                    startDate: plan.event.startDate,
                    endDate: plan.event.endDate,
                  })}
                  title={plan.event.name}
                  onClick={(e) => e.stopPropagation()}
                  className="flex min-w-0 items-center gap-1 rounded py-0.5 text-[11px] leading-tight hover:bg-accent sm:px-1"
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: disciplineColor(plan.event.disciplines) }}
                  />
                  {/* Seven columns across a phone leaves fifty pixels a cell,
                      which is not enough for a race name and is enough for the
                      dot that says a race is there. The list view is the one
                      that reads on a phone. */}
                  <span className="hidden truncate sm:inline">{plan.event.name}</span>
                </Link>
              ))}
              {dayPlans.length > PER_CELL ? (
                <span className="px-1 text-[11px] text-muted-foreground">
                  +{dayPlans.length - PER_CELL}
                </span>
              ) : null}

              {dayPlans.length === 0 && blockedHere ? (
                <span
                  className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground sm:px-1"
                  title={taken!.note || t.weekendTaken}
                >
                  <CalendarOff className="size-3 shrink-0" aria-hidden />
                  <span className="hidden truncate sm:inline">{taken!.note || t.weekendTaken}</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

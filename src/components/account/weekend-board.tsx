"use client";

import { addDays, format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { isBusyIsoDate } from "@/lib/plan-prefs";
import type { WeekendBucket } from "@/lib/planner";
import { cn } from "@/lib/utils";

/**
 * The season the way it is actually planned: not a list of races but a row of
 * weekends, some of which have something in them. The holes are the point —
 * they are what a family looking for "a race every weekend" is scanning for,
 * and clicking one asks what could go in it.
 */
export function WeekendBoard({
  locale,
  weekends,
  busyWeekdays,
  selected,
  onSelect,
}: {
  locale: string;
  weekends: WeekendBucket[];
  busyWeekdays: number[];
  selected: string | null;
  onSelect: (weekend: WeekendBucket) => void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  if (weekends.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.weekendBoardTitle}</CardTitle>
        <CardDescription>{t.weekendBoardBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {weekends.map((w) => {
            const busy =
              isBusyIsoDate(w.saturday, busyWeekdays) || isBusyIsoDate(w.sunday, busyWeekdays);
            const free = w.plans.length === 0 && !busy;
            const isSelected = selected === w.saturday;
            const label = `${format(parseISO(w.saturday), "d.", { locale: df })}–${format(
              addDays(parseISO(w.saturday), 1),
              "d. M.",
              { locale: df },
            )}`;

            return (
              <button
                key={w.saturday}
                type="button"
                aria-pressed={isSelected}
                disabled={!free}
                onClick={() => onSelect(w)}
                className={cn(
                  "flex min-w-0 flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                  free && "border-dashed hover:border-solid hover:bg-accent",
                  isSelected && "border-solid border-brand bg-accent",
                  !free && "cursor-default",
                  busy && "opacity-50",
                )}
              >
                <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  {label}
                  {w.isCurrent ? <i aria-hidden className="size-1.5 rounded-full bg-brand" /> : null}
                </span>
                {w.plans.length > 0 ? (
                  <span className="truncate text-xs font-medium" title={w.plans[0].event.name}>
                    {w.plans[0].event.name}
                    {w.plans.length > 1 ? ` +${w.plans.length - 1}` : ""}
                  </span>
                ) : (
                  <Badge variant={busy ? "outline" : "secondary"} className="w-fit">
                    {busy ? t.weekendBusy : t.weekendFree}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t.weekendPickFree}</p>
      </CardContent>
    </Card>
  );
}

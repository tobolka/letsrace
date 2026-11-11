"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Check, Plus, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { Panel } from "@/components/account/panel";
import { messagesFor } from "@/lib/i18n/messages";
import { todayIso } from "@/lib/date-presets";
import { eventMapPath } from "@/lib/event-url";
import type { SeriesProgress, SeriesRound } from "@/lib/plan-series";
import { cn } from "@/lib/utils";
import { localePath } from "@/lib/localized-paths";

/**
 * A season told the way people tell it: not eight separate races, but "we do
 * the Solid MTB Maraton, we've done four, the next one is in a fortnight".
 * The pips are the season at a glance — solid for ridden, ringed for booked,
 * hollow for a round nobody has claimed yet.
 */
export function SeriesProgressCard({
  locale,
  items,
  plannedEventIds,
  onAddRounds,
}: {
  locale: string;
  items: SeriesProgress[];
  plannedEventIds: Set<string>;
  onAddRounds: (eventIds: string[]) => Promise<void> | void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <Panel title={t.seriesTitle} description={t.seriesBody} bodyClassName="p-2">
      <div className="flex flex-col">
        {items.map((s) => {
          const remaining = s.remaining.length;
          const busy = busyId === s.seriesId;
          const progress = [
            t.seriesProgress.replace("{done}", String(s.inPlan)).replace("{total}", String(s.total)),
            s.next ? `${t.seriesNext} ${format(parseISO(s.next.startDate), "d. M.", { locale: df })}` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <div key={s.seriesId} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
              <span className="flex h-[42px] w-11 shrink-0 items-center justify-center rounded-md border border-l-[3px] border-l-brand bg-background">
                <Trophy className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                {s.seriesSlug ? (
                  <Link href={localePath(locale, `series/${s.seriesSlug}`)} className="block truncate text-sm font-medium hover:underline">
                    {s.seriesName}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-medium">{s.seriesName}</span>
                )}
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <RoundPips locale={locale} rounds={s.rounds} plannedEventIds={plannedEventIds} />
                  <span className="truncate tabular-nums">{progress}</span>
                </div>
              </div>
              <div className="shrink-0">
                {remaining === 0 ? (
                  <Badge variant="secondary">
                    <Check className="size-3" aria-hidden /> {s.next ? t.seriesAllIn : t.seriesDone}
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusyId(s.seriesId);
                      try {
                        await onAddRounds(s.remaining.map((r) => r.id));
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    {busy ? <Spinner /> : <Plus />}
                    <span className="tabular-nums">{t.seriesRoundsLeft.replace("{n}", String(remaining))}</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function RoundPips({
  locale,
  rounds,
  plannedEventIds,
}: {
  locale: string;
  rounds: SeriesRound[];
  plannedEventIds: Set<string>;
}) {
  const df = dateFnsLocale(locale);
  const today = todayIso();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1" aria-hidden={false}>
      {rounds.map((r) => {
        const inPlan = plannedEventIds.has(r.id);
        const isRidden = inPlan && (r.endDate ?? r.startDate) < today;
        const isBooked = inPlan && !isRidden;
        return (
          <Tooltip key={r.id}>
            <TooltipTrigger asChild>
              <Link
                href={eventMapPath(locale, {
                  slug: r.slug,
                  startDate: r.startDate,
                  endDate: r.endDate,
                })}
                aria-label={`${r.name} — ${format(parseISO(r.startDate), "d. M.", { locale: df })}`}
                className={cn(
                  "size-2.5 rounded-full border transition-colors",
                  isRidden && "border-brand bg-brand",
                  isBooked && "border-brand bg-transparent",
                  !isRidden && !isBooked && "border-muted-foreground/40 bg-transparent",
                )}
              />
            </TooltipTrigger>
            <TooltipContent>
              <span className="tabular-nums">
                {format(parseISO(r.startDate), "d. M.", { locale: df })}
              </span>{" "}
              {r.name}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

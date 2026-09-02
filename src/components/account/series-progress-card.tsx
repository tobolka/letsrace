"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { todayIso } from "@/lib/date-presets";
import { eventMapPath } from "@/lib/event-url";
import type { SeriesProgress, SeriesRound } from "@/lib/plan-series";
import { cn } from "@/lib/utils";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.seriesTitle}</CardTitle>
        <CardDescription>{t.seriesBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {items.map((s) => {
            const remaining = s.remaining.length;
            const busy = busyId === s.seriesId;
            return (
              <Item
                key={s.seriesId}
                variant="outline"
                className="flex-col items-stretch sm:flex-row sm:items-start"
              >
                <ItemContent className="min-w-0 gap-2">
                  <ItemTitle className="w-full min-w-0">
                    {s.seriesSlug ? (
                      <Link
                        href={`/${locale}/series/${s.seriesSlug}`}
                        className="truncate hover:underline"
                      >
                        {s.seriesName}
                      </Link>
                    ) : (
                      <span className="truncate">{s.seriesName}</span>
                    )}
                  </ItemTitle>
                  <RoundPips locale={locale} rounds={s.rounds} plannedEventIds={plannedEventIds} />
                  <ItemDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="tabular-nums">
                      {[
                        t.seriesProgress
                          .replace("{done}", String(s.inPlan))
                          .replace("{total}", String(s.total)),
                        s.next
                          ? `${t.seriesNext} ${format(parseISO(s.next.startDate), "d. M.", { locale: df })}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {s.next ? null : <Badge variant="secondary">{t.seriesDone}</Badge>}
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="justify-end">
                  {remaining === 0 ? (
                    s.next ? (
                      <Badge variant="secondary">
                        <Check className="size-3" aria-hidden /> {t.seriesAllIn}
                      </Badge>
                    ) : null
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
                      <span className="hidden sm:inline">{t.seriesAddAll}</span>
                      <span className="sm:hidden tabular-nums">
                        {t.seriesRoundsLeft.replace("{n}", String(remaining))}
                      </span>
                    </Button>
                  )}
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
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
    <div className="flex flex-wrap items-center gap-1" aria-hidden={false}>
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

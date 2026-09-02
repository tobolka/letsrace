"use client";

import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { CalendarOff, Search, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { isBusyIsoDate } from "@/lib/plan-prefs";
import type { WeekendBucket } from "@/lib/planner";
import { cn } from "@/lib/utils";

export type BlockedWeekend = { saturday: string; note: string | null };

/**
 * The season the way it is actually planned: not a list of races but a row of
 * weekends, some of which have something in them. The holes are the point —
 * they are what a family looking for "a race every weekend" is scanning for.
 *
 * A hole is not always an opening, though: a wedding fills a weekend as
 * completely as a race does. Saying so here is what keeps the free count
 * honest and stops the suggestions offering a weekend nobody can go to.
 */
export function WeekendBoard({
  locale,
  weekends,
  busyWeekdays,
  blocked,
  selected,
  onSelect,
  onBlock,
  onUnblock,
}: {
  locale: string;
  weekends: WeekendBucket[];
  busyWeekdays: number[];
  blocked: Record<string, BlockedWeekend>;
  selected: string | null;
  onSelect: (weekend: WeekendBucket) => void;
  onBlock: (saturday: string, note: string) => Promise<void> | void;
  onUnblock: (saturday: string) => Promise<void> | void;
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
          {weekends.map((w) => (
            <WeekendTile
              key={w.saturday}
              locale={locale}
              weekend={w}
              blocked={blocked[w.saturday] ?? null}
              recurringBusy={
                isBusyIsoDate(w.saturday, busyWeekdays) || isBusyIsoDate(w.sunday, busyWeekdays)
              }
              selected={selected === w.saturday}
              label={`${format(parseISO(w.saturday), "d.", { locale: df })}–${format(
                addDays(parseISO(w.saturday), 1),
                "d. M.",
                { locale: df },
              )}`}
              onSelect={() => onSelect(w)}
              onBlock={(note) => onBlock(w.saturday, note)}
              onUnblock={() => onUnblock(w.saturday)}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t.weekendPickFree}</p>
      </CardContent>
    </Card>
  );
}

function WeekendTile({
  locale,
  weekend,
  blocked,
  recurringBusy,
  selected,
  label,
  onSelect,
  onBlock,
  onUnblock,
}: {
  locale: string;
  weekend: WeekendBucket;
  blocked: BlockedWeekend | null;
  recurringBusy: boolean;
  selected: boolean;
  label: string;
  onSelect: () => void;
  onBlock: (note: string) => Promise<void> | void;
  onUnblock: () => Promise<void> | void;
}) {
  const t = messagesFor(locale);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const hasRace = weekend.plans.length > 0;
  const free = !hasRace && !blocked && !recurringBusy;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-pressed={selected}
          className={cn(
            "flex min-w-0 flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
            free && "border-dashed hover:border-solid hover:bg-accent",
            selected && "border-solid border-brand bg-accent",
            (blocked || recurringBusy) && "bg-muted/40",
            recurringBusy && !blocked && "opacity-60",
          )}
        >
          <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            {label}
            {weekend.isCurrent ? <i aria-hidden className="size-1.5 rounded-full bg-brand" /> : null}
          </span>
          {hasRace ? (
            <span className="truncate text-xs font-medium" title={weekend.plans[0].event.name}>
              {weekend.plans[0].event.name}
              {weekend.plans.length > 1 ? ` +${weekend.plans.length - 1}` : ""}
            </span>
          ) : blocked ? (
            <span className="flex min-w-0 items-center gap-1 text-xs font-medium text-muted-foreground">
              <CalendarOff className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{blocked.note || t.weekendTaken}</span>
            </span>
          ) : (
            <Badge variant={recurringBusy ? "outline" : "secondary"} className="w-fit">
              {recurringBusy ? t.weekendBusy : t.weekendFree}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium tabular-nums">{label}</p>
          {blocked ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                setOpen(false);
                await onUnblock();
              }}
            >
              <Undo2 data-icon="inline-start" />
              {t.weekendFreeAgain}
            </Button>
          ) : (
            <>
              {!hasRace ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    onSelect();
                  }}
                >
                  <Search data-icon="inline-start" />
                  {t.weekendFindRace}
                </Button>
              ) : null}
              <div className="flex flex-col gap-2">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.weekendTakenNote}
                  aria-label={t.weekendTakenNote}
                  onKeyDown={async (e) => {
                    if (e.key !== "Enter") return;
                    setOpen(false);
                    await onBlock(note.trim());
                    setNote("");
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setOpen(false);
                    await onBlock(note.trim());
                    setNote("");
                  }}
                >
                  <CalendarOff data-icon="inline-start" />
                  {t.weekendTakenAction}
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

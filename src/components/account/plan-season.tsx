"use client";

import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { CalendarDays, CalendarOff, ChevronLeft, ChevronRight, List, Undo2 } from "lucide-react";
import { PlanMonthView } from "@/components/account/plan-month-view";
import { PlanRow } from "@/components/account/plan-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { pluralize } from "@/lib/i18n/plural";
import { todayIso } from "@/lib/date-presets";
import { addMonths, monthStart, type MonthDay } from "@/lib/plan-month";
import { isBusyIsoDate } from "@/lib/plan-prefs";
import {
  saturdayOfRaceWeekend,
  type BlockedWeekend,
  type EventPlan,
  type PlanMemberStatus,
  type PlannerMember,
} from "@/lib/planner";

const VIEWS = ["calendar", "list"] as const;

/**
 * The season, and it is the page's centre of gravity.
 *
 * It was a row of weekend tiles: the right shape for "is Saturday free" and
 * the wrong one for everything else. A Wednesday criterium had nowhere to sit,
 * a month with one race looked like a month with five, and nothing said which
 * day of the weekend a race was on. It is a month calendar now, with a list
 * for reading the same season straight through, and every race is on its day.
 */
export function PlanSeason({
  locale,
  plans,
  past,
  members,
  busyWeekdays,
  blocked,
  freeCount,
  selected,
  busyId,
  onSelectWeekend,
  onBlock,
  onUnblock,
  onStatusChange,
  onDiscard,
}: {
  locale: string;
  /** Every race in the plan, past and future — the calendar shows both. */
  plans: EventPlan[];
  past: EventPlan[];
  members: PlannerMember[];
  busyWeekdays: number[];
  blocked: Record<string, BlockedWeekend>;
  freeCount: number;
  selected: string | null;
  busyId: string | null;
  onSelectWeekend: (saturday: string) => void;
  onBlock: (saturday: string, note: string) => Promise<void> | void;
  onUnblock: (saturday: string) => Promise<void> | void;
  onStatusChange: (eventId: string, memberId: string, status: PlanMemberStatus) => void;
  onDiscard: (eventId: string) => void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const today = todayIso();
  const [view, setView] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("calendar"));
  const [month, setMonth] = useState(() => monthStart(today));

  const upcoming = plans.filter((p) => (p.event.endDate ?? p.event.startDate) >= today);
  // The list reads day by day, so races that share a date share one heading.
  const byDay = new Map<string, EventPlan[]>();
  for (const plan of upcoming) {
    byDay.set(plan.event.startDate, [...(byDay.get(plan.event.startDate) ?? []), plan]);
  }
  const days = [...byDay.keys()].sort();

  return (
    <section aria-labelledby="plan-season" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="plan-season" className="text-base font-semibold">
          {t.weekendBoardTitle}
        </h2>
        <p className="text-xs tabular-nums text-muted-foreground">
          {pluralize(freeCount, asLocale(locale), {
            one: t.countFreeOne,
            few: t.countFreeFew,
            many: t.countFreeMany,
          })}
        </p>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => {
            if (v) void setView(v as (typeof VIEWS)[number]);
          }}
          variant="outline"
          size="sm"
          className="ml-auto"
        >
          <ToggleGroupItem value="calendar">
            <CalendarDays data-icon="inline-start" />
            {t.planViewCalendar}
          </ToggleGroupItem>
          <ToggleGroupItem value="list">
            <List data-icon="inline-start" />
            {t.planViewList}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === "calendar" ? (
        <>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={format(parseISO(addMonths(month, -1)), "LLLL yyyy", { locale: df })}
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={format(parseISO(addMonths(month, 1)), "LLLL yyyy", { locale: df })}
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight />
            </Button>
            <p className="text-sm font-medium tabular-nums first-letter:uppercase">
              {format(parseISO(month), "LLLL yyyy", { locale: df })}
            </p>
            {month !== monthStart(today) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setMonth(monthStart(today))}
              >
                {t.planToday}
              </Button>
            ) : null}
          </div>

          <PlanMonthView
            locale={locale}
            month={month}
            plans={plans}
            busyWeekdays={busyWeekdays}
            blocked={blocked}
            selectedSaturday={selected}
            onPickDay={(day: MonthDay) => onSelectWeekend(day.saturday)}
          />

          {selected ? (
            <WeekendBar
              locale={locale}
              saturday={selected}
              blocked={blocked[selected] ?? null}
              busy={
                isBusyIsoDate(selected, busyWeekdays) ||
                isBusyIsoDate(addDaysIso(selected), busyWeekdays)
              }
              hasRace={plans.some((p) => saturdayOfRaceWeekend(p.event.startDate) === selected)}
              onBlock={(note) => onBlock(selected, note)}
              onUnblock={() => onUnblock(selected)}
            />
          ) : null}
        </>
      ) : days.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.planNoUpcoming}</p>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {days.map((iso) => (
            <div key={iso}>
              <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-4 py-1.5 text-xs font-medium">
                <span className="tabular-nums first-letter:uppercase">
                  {format(parseISO(iso), "EEEE d. MMMM", { locale: df })}
                </span>
                {saturdayOfRaceWeekend(iso) === saturdayOfRaceWeekend(today) ? (
                  <Badge>{t.thisWeekend}</Badge>
                ) : null}
              </div>
              <div className="divide-y">
                {byDay.get(iso)!.map((plan) => (
                  <PlanRow
                    key={plan.event.id}
                    locale={locale}
                    plan={plan}
                    members={members}
                    busy={busyId === plan.event.id}
                    showDate={false}
                    onStatusChange={(memberId, status) =>
                      onStatusChange(plan.event.id, memberId, status)
                    }
                    onDiscard={() => onDiscard(plan.event.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-xs text-muted-foreground underline-offset-4 hover:underline">
            {t.planPast} · <span className="tabular-nums">{past.length}</span>
          </summary>
          <div className="mt-2 divide-y rounded-xl border bg-card">
            {past.map((plan) => (
              <PlanRow
                key={plan.event.id}
                locale={locale}
                plan={plan}
                members={members}
                muted
                busy={busyId === plan.event.id}
                onStatusChange={(memberId, status) =>
                  onStatusChange(plan.event.id, memberId, status)
                }
                onDiscard={() => onDiscard(plan.event.id)}
              />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function addDaysIso(iso: string): string {
  const d = parseISO(iso);
  return format(addDays(d, 1), "yyyy-MM-dd");
}

/**
 * What can be done with the weekend that was just clicked.
 *
 * This used to live in a popover on each weekend tile, which meant the actions
 * were invisible until you guessed that a tile was pressable. One bar under
 * the calendar, about the weekend you actually picked, says the same thing out
 * loud — and the suggestions further down are already answering for it.
 */
function WeekendBar({
  locale,
  saturday,
  blocked,
  busy,
  hasRace,
  onBlock,
  onUnblock,
}: {
  locale: string;
  saturday: string;
  blocked: BlockedWeekend | null;
  busy: boolean;
  hasRace: boolean;
  onBlock: (note: string) => Promise<void> | void;
  onUnblock: () => Promise<void> | void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const label = `${format(parseISO(saturday), "d.", { locale: df })}–${format(
    addDays(parseISO(saturday), 1),
    "d. M.",
    { locale: df },
  )}`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="tabular-nums text-muted-foreground">{label}</span>
      {blocked ? (
        <>
          <span className="flex items-center gap-1 text-muted-foreground">
            <CalendarOff className="size-3.5" aria-hidden />
            {blocked.note || t.weekendTaken}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => void onUnblock()}>
            <Undo2 data-icon="inline-start" />
            {t.weekendFreeAgain}
          </Button>
        </>
      ) : (
        <>
          {!hasRace && !busy ? (
            <span className="text-muted-foreground">{t.weekendPickFree}</span>
          ) : null}
          {busy ? <Badge variant="outline">{t.weekendBusy}</Badge> : null}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <CalendarOff data-icon="inline-start" />
                {t.weekendTakenAction}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
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
                  size="sm"
                  onClick={async () => {
                    setOpen(false);
                    await onBlock(note.trim());
                    setNote("");
                  }}
                >
                  {t.weekendTakenSave}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}

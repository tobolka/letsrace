"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { CalendarDays, CalendarOff, History, List, Undo2 } from "lucide-react";
import { PlanMonthView } from "@/components/account/plan-month-view";
import { MonthToolbar } from "@/components/calendar/month-calendar";
import { PlanRaces } from "@/components/account/plan-races";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { todayIso } from "@/lib/date-presets";
import { monthStart } from "@/lib/plan-month";
import {
  type BlockedDay,
  type EventPlan,
  type PlanMemberStatus,
  type PlannerMember,
} from "@/lib/planner";

// What is ahead, what has been, and the month. The day-per-row sheet that
// used to be a fourth view was the same races again with the riders as
// columns; the calendar carries its one extra job, marking a day as taken.
const VIEWS = ["upcoming", "past", "calendar"] as const;

/**
 * The season, and it is the page's centre of gravity.
 *
 * It was a row of weekend tiles: the right shape for one question — is
 * Saturday free — and the wrong one for the rest. A Wednesday criterium had
 * nowhere to sit, a month with one race looked like a month with five, and
 * picking anything picked a whole weekend.
 *
 * Two views of the same days now. The month is for seeing the shape of a
 * season at a glance. The rows are the shape people already keep this in: a
 * day per line, a rider per column, every day present whether anything is on
 * it or not. Both select a single day, because a day is what a race is on.
 */
export function PlanSeason({
  locale,
  plans,
  past,
  members,
  busyWeekdays,
  blocked,
  selected,
  busyId,
  onSelectDay,
  onSetNote,
  onStatusChange,
  onDiscard,
  notes,
}: {
  locale: string;
  /** Every race in the plan, past and future — both views show both. */
  plans: EventPlan[];
  past: EventPlan[];
  members: PlannerMember[];
  busyWeekdays: number[];
  blocked: Record<string, BlockedDay>;
  selected: string | null;
  busyId: string | null;
  onSelectDay: (day: string) => void;
  onSetNote: (day: string, note: string) => Promise<void> | void;
  onStatusChange: (eventId: string, memberId: string, status: PlanMemberStatus) => void;
  onDiscard: (eventId: string) => void;
  /** What each upcoming race is waiting for, by event id. */
  notes?: Record<string, string>;
}) {
  const today = todayIso();
  const [view] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("upcoming"));
  const upcoming = plans.filter((p) => (p.event.endDate ?? p.event.startDate) >= today);
  const [month, setMonth] = useState(() => monthStart(selected ?? today));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {view === "calendar" ? (
        <>
          <MonthToolbar locale={locale} month={month} onMonth={setMonth} />
          <PlanMonthView
            locale={locale}
            month={month}
            plans={plans}
            members={members}
            busyWeekdays={busyWeekdays}
            blocked={blocked}
            selectedDay={selected}
            onPickDay={onSelectDay}
            fill
          />
          {selected ? (
            <DayBar
              locale={locale}
              day={selected}
              note={blocked[selected]?.note ?? null}
              onSetNote={(note) => onSetNote(selected, note)}
            />
          ) : null}
        </>
      ) : (
        <PlanRaces
          locale={locale}
          // Newest first in the history: the race you just rode is the one you
          // come to mark in.
          upcoming={view === "past" ? [...past].reverse() : upcoming}
          past={view === "past"}
          hasPast={past.length > 0}
          notes={view === "past" ? undefined : notes}
          members={members}
          busyId={busyId}
          onStatusChange={onStatusChange}
          onDiscard={onDiscard}
        />
      )}
    </div>
  );
}

/**
 * The day you just clicked, and the one thing you might want to say about it:
 * that it is already taken. Typed here rather than hidden in a popover on a
 * tile, which is where nobody found it.
 */
function DayBar({
  locale,
  day,
  note,
  onSetNote,
}: {
  locale: string;
  day: string;
  note: string | null;
  onSetNote: (note: string) => Promise<void> | void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const [draft, setDraft] = useState(note ?? "");
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-sm">
      <span className="tabular-nums text-muted-foreground first-letter:uppercase">
        {format(parseISO(day), "EEEE d. MMMM", { locale: df })}
      </span>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft.trim() !== (note ?? "")) void onSetNote(draft.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(note ?? "");
              setEditing(false);
            }
          }}
          placeholder={t.weekendTakenNote}
          aria-label={t.weekendTakenNote}
          className="h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring"
        />
      ) : note ? (
        <>
          <span className="flex items-center gap-1 text-muted-foreground">
            <CalendarOff className="size-3.5" aria-hidden />
            {note}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => void onSetNote("")}>
            <Undo2 data-icon="inline-start" />
            {t.weekendFreeAgain}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setDraft("");
            setEditing(true);
          }}
        >
          <CalendarOff data-icon="inline-start" />
          {t.weekendTakenAction}
        </Button>
      )}
    </div>
  );
}

/**
 * The three views of the season, for the page header — the same place the
 * list and the calendar keep their controls. It shares the `view` query
 * parameter with `PlanSeason`, so the two never disagree.
 */
export function PlanViewToggle({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const [view, setView] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("upcoming"));
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(v) => {
        if (v) void setView(v as (typeof VIEWS)[number]);
      }}
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem value="upcoming" aria-label={t.planViewUpcoming}>
        <List data-icon="inline-start" />
        <span className="max-sm:sr-only">{t.planViewUpcoming}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="past" aria-label={t.planViewPast}>
        <History data-icon="inline-start" />
        <span className="max-sm:sr-only">{t.planViewPast}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="calendar" aria-label={t.planViewCalendar}>
        <CalendarDays data-icon="inline-start" />
        <span className="max-sm:sr-only">{t.planViewCalendar}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

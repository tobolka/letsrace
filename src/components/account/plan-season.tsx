"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { CalendarDays, CalendarOff, History, List, Sheet, Undo2 } from "lucide-react";
import { PlanFilters } from "@/components/account/plan-filters";
import { filterPlans, type PlanStatusFilter } from "@/lib/plan-filters";
import { PlanAgenda } from "@/components/account/plan-agenda";
import { PlanMonthView } from "@/components/account/plan-month-view";
import { PlanFeedSubscribe } from "@/components/account/plan-feed-subscribe";
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

// What is ahead, what has been, the season as a sheet — a day per row, a
// rider per column (it keeps the `list` value old links use) — and the month.
const VIEWS = ["upcoming", "past", "list", "calendar"] as const;

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
  userId,
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
  /** For the calendar subscription; without it the button is left out. */
  userId?: string | null;
}) {
  const t = messagesFor(locale);
  const [riderId, setRiderId] = useState("");
  const [status, setStatus] = useState<PlanStatusFilter>("all");
  const filteredPlans = filterPlans(plans, members, riderId, status);
  const filteredPast = filterPlans(past, members, riderId, status);
  const visibleMembers = riderId ? members.filter((member) => member.id === riderId) : members;
  const hasFilters = Boolean(riderId) || status !== "all";
  const today = todayIso();
  const [view] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("upcoming"));
  const upcoming = filteredPlans.filter((p) => (p.event.endDate ?? p.event.startDate) >= today);
  const [month, setMonth] = useState(() => monthStart(selected ?? today));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PlanFilters
        locale={locale}
        members={members}
        riderId={riderId}
        status={status}
        onRider={setRiderId}
        onStatus={setStatus}
        onClear={() => { setRiderId(""); setStatus("all"); }}
      />
      {hasFilters && (view === "past" ? filteredPast : view === "upcoming" ? upcoming : filteredPlans).length === 0 ? (
        <p role="status" className="border-b px-4 py-3 text-sm text-muted-foreground">{t.planFilterEmpty}</p>
      ) : null}
      {view === "list" ? (
        <>
          <PlanAgenda
            locale={locale}
            plans={filteredPlans}
            members={visibleMembers}
            blocked={blocked}
            busyWeekdays={busyWeekdays}
            selected={selected}
            onSelectDay={onSelectDay}
            onSetNote={onSetNote}
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
      ) : view === "calendar" ? (
        <>
          <MonthToolbar locale={locale} month={month} onMonth={setMonth}>
            {userId ? <PlanFeedSubscribe locale={locale} userId={userId} /> : null}
          </MonthToolbar>
          <PlanMonthView
            locale={locale}
            month={month}
            plans={filteredPlans}
            members={visibleMembers}
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
      ) : hasFilters && (view === "past" ? filteredPast : upcoming).length === 0 ? null : (
        <PlanRaces
          locale={locale}
          // Newest first in the history: the race you just rode is the one you
          // come to mark in.
          upcoming={view === "past" ? [...filteredPast].reverse() : upcoming}
          past={view === "past"}
          hasPast={past.length > 0}
          notes={view === "past" ? undefined : notes}
          members={visibleMembers}
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
    <div className="flex items-center gap-2">
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
        <ToggleGroupItem value="list" aria-label={t.planViewList}>
          <Sheet data-icon="inline-start" />
          <span className="max-sm:sr-only">{t.planViewList}</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="calendar" aria-label={t.planViewCalendar}>
          <CalendarDays data-icon="inline-start" />
          <span className="max-sm:sr-only">{t.planViewCalendar}</span>
        </ToggleGroupItem>
      </ToggleGroup>
      {/* History is the record, not a way of looking at the season: its own group. */}
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(v) => {
          if (v) void setView(v as (typeof VIEWS)[number]);
        }}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="past" aria-label={t.planViewPast}>
          <History data-icon="inline-start" />
          <span className="max-sm:sr-only">{t.planViewPast}</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

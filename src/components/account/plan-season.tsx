"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { CalendarDays, CalendarOff, ChevronLeft, ChevronRight, Rows3, Undo2 } from "lucide-react";
import { PlanAgenda } from "@/components/account/plan-agenda";
import { Panel } from "@/components/account/panel";
import { PlanMonthView } from "@/components/account/plan-month-view";
import { PlanRow } from "@/components/account/plan-row";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { todayIso } from "@/lib/date-presets";
import { addMonths, monthStart, type MonthDay } from "@/lib/plan-month";
import {
  type BlockedDay,
  type EventPlan,
  type PlanMemberStatus,
  type PlannerMember,
} from "@/lib/planner";

const VIEWS = ["list", "calendar"] as const;

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
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const today = todayIso();
  const [view, setView] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("list"));
  const [month, setMonth] = useState(() => monthStart(selected ?? today));

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title={t.weekendBoardTitle}
        bodyClassName="p-0"
        actions={
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => {
              if (v) void setView(v as (typeof VIEWS)[number]);
            }}
            variant="outline"
            size="xs"
          >
            <ToggleGroupItem value="list">
              <Rows3 data-icon="inline-start" />
              {t.planViewList}
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar">
              <CalendarDays data-icon="inline-start" />
              {t.planViewCalendar}
            </ToggleGroupItem>
          </ToggleGroup>
        }
      >
        {view === "calendar" ? (
          <>
            <div className="flex items-center gap-2 border-b px-4 py-2">
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
              selectedDay={selected}
              onPickDay={(day: MonthDay) => onSelectDay(day.iso)}
            />
          </>
        ) : (
          <PlanAgenda
            locale={locale}
            plans={plans}
            members={members}
            blocked={blocked}
            busyWeekdays={busyWeekdays}
            selected={selected}
            onSelectDay={onSelectDay}
            onSetNote={onSetNote}
          />
        )}

        {selected ? (
          <DayBar
            locale={locale}
            day={selected}
            note={blocked[selected]?.note ?? null}
            onSetNote={(note) => onSetNote(selected, note)}
          />
        ) : null}
      </Panel>

      {past.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-xs text-muted-foreground underline-offset-4 hover:underline">
            {t.planPast} · <span className="tabular-nums">{past.length}</span>
          </summary>
          <div className="mt-2 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
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

"use client";

import { useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { eventMapPath } from "@/lib/event-url";
import { disciplineColor } from "@/lib/map-visuals";
import { todayIso } from "@/lib/date-presets";
import { isBusyIsoDate } from "@/lib/plan-prefs";
import {
  plansOnIsoDate,
  type BlockedDay,
  type EventPlan,
  type PlannerMember,
} from "@/lib/planner";
import { cn } from "@/lib/utils";

const WEEKS_AT_A_TIME = 8;

/** Sticks under the app bar; the row it sits in cannot stick for it. */
const HEAD =
  "sticky top-0 z-10 border-b bg-muted py-1.5 text-xs font-medium md:top-14";

/** A column heading has room for a name, not for a full name. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * The season as a row per day and a column per rider.
 *
 * This is the shape people already keep the family season in — a spreadsheet
 * with the date down the side, one column each for the people it applies to,
 * and every day present whether anything is on it or not. The empty rows are
 * as much of the answer as the full ones: you read a fortnight of nothing and
 * know there is room.
 *
 * The note column is what a note column in that spreadsheet is: the holiday,
 * the wedding, the school play. It is the same day-off the suggestions and the
 * free-day count read, typed where you would type it.
 */
export function PlanAgenda({
  locale,
  plans,
  members,
  blocked,
  busyWeekdays,
  selected,
  onSelectDay,
  onSetNote,
}: {
  locale: string;
  plans: EventPlan[];
  members: PlannerMember[];
  blocked: Record<string, BlockedDay>;
  busyWeekdays: number[];
  selected: string | null;
  onSelectDay: (day: string) => void;
  onSetNote: (day: string, note: string) => Promise<void> | void;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const today = todayIso();
  const [weeks, setWeeks] = useState(WEEKS_AT_A_TIME);

  const start = parseISO(today);
  const days: string[] = [];
  for (let i = 0; i < weeks * 7; i++) days.push(format(addDays(start, i), "yyyy-MM-dd"));

  /**
   * A race nobody has been marked on is not nobody's race — it is in the plan
   * and anyone in the house could still be the one who rides it, so it stands
   * in every column, quietly, until somebody is named.
   */
  function racesFor(iso: string, memberId: string): { plan: EventPlan; claimed: boolean }[] {
    return plansOnIsoDate(plans, iso)
      .map((plan) => ({
        plan,
        claimed: (plan.memberStatus[memberId] ?? "none") !== "none",
        anyone: members.some((m) => (plan.memberStatus[m.id] ?? "none") !== "none"),
      }))
      .filter((r) => r.claimed || !r.anyone)
      .map(({ plan, claimed }) => ({ plan, claimed }));
  }

  return (
    <div className="flex flex-col gap-3">
      {/*
        `overflow-x: auto` makes this a scroll container in both axes, and a
        sticky heading inside one sticks to the container — which never scrolls
        — so it sat 56px down the table, on top of the second row. Wide enough
        to need sideways scrolling only on a phone; above that the page is the
        scrollport and the heading sticks under the bar as intended.
      */}
      <div className="overflow-x-auto rounded-xl border bg-card md:overflow-x-visible">
        {/* `border-separate` because a sticky heading does not stick inside a
            collapsed-border table — the borders are drawn by the cells here. */}
        <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left">
              <th scope="col" className={cn(HEAD, "w-24 px-3 text-right")}>
                {t.date}
              </th>
              <th scope="col" className={cn(HEAD, "w-24 px-2")}>
                {t.planDay}
              </th>
              <th scope="col" className={cn(HEAD, "w-40 px-2")}>
                {t.planNote}
              </th>
              {members.map((m) => (
                <th
                  key={m.id}
                  scope="col"
                  className={cn(HEAD, "px-2")}
                  // The rider columns share whatever is left, evenly, so the
                  // table does not jump about as names come and go.
                  style={{ width: `${70 / members.length}%` }}
                >
                  {firstName(m.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((iso) => {
              const d = parseISO(iso);
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              const isToday = iso === today;
              const note = blocked[iso];
              const busy = isBusyIsoDate(iso, busyWeekdays);
              return (
                <tr
                  key={iso}
                  onClick={() => onSelectDay(iso)}
                  className={cn(
                    "group/row align-middle [&>*]:border-b [&>*]:last:border-b-0",
                    weekend && "bg-stone-200/45 dark:bg-stone-900/50",
                    (note || busy) && "bg-muted/60",
                    selected === iso && "bg-brand/8 inset-ring inset-ring-brand/40",
                    "hover:bg-accent/60",
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      "px-3 py-1 text-right text-xs font-normal tabular-nums whitespace-nowrap",
                      isToday ? "font-semibold text-brand" : "text-muted-foreground",
                    )}
                  >
                    {format(d, "d. M. yyyy", { locale: df })}
                  </th>
                  <td className="px-2 py-1 text-xs whitespace-nowrap text-muted-foreground first-letter:uppercase">
                    {format(d, "EEEE", { locale: df })}
                  </td>
                  <td className="px-2 py-1">
                    <NoteCell
                      locale={locale}
                      value={note?.note ?? ""}
                      onSave={(next) => onSetNote(iso, next)}
                    />
                  </td>
                  {members.map((m) => (
                    <td key={m.id} className="px-2 py-1">
                      <div className="flex flex-col gap-0.5">
                        {racesFor(iso, m.id).map(({ plan, claimed }) => (
                          <Link
                            key={plan.event.id}
                            href={eventMapPath(locale, {
                              slug: plan.event.slug,
                              startDate: plan.event.startDate,
                              endDate: plan.event.endDate,
                            })}
                            title={plan.event.name}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "flex min-w-0 items-center gap-1.5 text-xs leading-tight hover:underline",
                              !claimed && "text-muted-foreground",
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn("size-1.5 shrink-0 rounded-full", !claimed && "opacity-50")}
                              style={{ background: disciplineColor(plan.event.disciplines) }}
                            />
                            <span className="truncate">{plan.event.name}</span>
                          </Link>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setWeeks((w) => w + WEEKS_AT_A_TIME)}
      >
        {t.planMoreDays}
      </Button>
    </div>
  );
}

/**
 * Click, type, done — the way a cell in a spreadsheet behaves. A dialog for
 * one short word is why nobody ever filled this in.
 */
function NoteCell({
  locale,
  value,
  onSave,
}: {
  locale: string;
  value: string;
  onSave: (next: string) => Promise<void> | void;
}) {
  const t = messagesFor(locale);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDraft(value);
          setEditing(true);
        }}
        aria-label={t.weekendTakenNote}
        className={cn(
          "w-full min-w-16 truncate rounded px-1 py-0.5 text-left text-xs hover:bg-accent",
          value ? "text-foreground" : "text-muted-foreground/50",
        )}
      >
        {/* A plus on every one of sixty empty rows is noise; it appears when
            the row is under the cursor, and the cell is clickable regardless. */}
        <span className={value ? undefined : "opacity-0 group-hover/row:opacity-100"}>
          {value || "+"}
        </span>
      </button>
    );
  }

  const commit = async () => {
    setEditing(false);
    if (draft.trim() !== value) await onSave(draft.trim());
  };

  return (
    <Input
      autoFocus
      value={draft}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") void commit();
        if (e.key === "Escape") setEditing(false);
      }}
      placeholder={t.weekendTakenNote}
      className="h-6 min-w-24 px-1 py-0 text-xs"
    />
  );
}

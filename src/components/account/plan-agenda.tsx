"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { eventMapPath } from "@/lib/event-url";
import { disciplineColor } from "@/lib/map-visuals";
import { todayIso } from "@/lib/date-presets";
import { isBusyIsoDate } from "@/lib/plan-prefs";
import { monthStart } from "@/lib/plan-month";
import {
  plansOnIsoDate,
  type BlockedDay,
  type EventPlan,
  type PlannerMember,
} from "@/lib/planner";
import { cn } from "@/lib/utils";

/** How much further "show more days" reaches each time it is pressed. */
const WEEKS_AT_A_TIME = 8;

/** Sticks under the app bar; the row it sits in cannot stick for it. */
const HEAD = "sticky top-0 z-10 border-b bg-muted py-2 text-xs font-medium md:top-14";

const CELL = "border-b px-2 py-1.5";

/** A column heading has room for a name, not for a full name. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function iso(d: Date): string {
  return format(d, "yyyy-MM-dd");
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
 * It runs from the first of this month, not from today, because a month you
 * are eight days into is still this month and the races already ridden are
 * part of how it reads. And it always runs far enough to hold the last race in
 * the plan: a table that leaves out a race you have entered is worse than no
 * table.
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
  const [extraWeeks, setExtraWeeks] = useState(0);

  const days = useMemo(() => {
    const from = parseISO(monthStart(today));
    const lastPlanned = plans.reduce(
      (max, p) => ((p.event.endDate ?? p.event.startDate) > max ? p.event.endDate ?? p.event.startDate : max),
      today,
    );
    const floor = iso(addDays(parseISO(today), (WEEKS_AT_A_TIME + extraWeeks) * 7));
    const until = parseISO(lastPlanned > floor ? lastPlanned : floor);
    const out: string[] = [];
    for (let d = from; iso(d) <= iso(until); d = addDays(d, 1)) out.push(iso(d));
    return out;
  }, [plans, today, extraWeeks]);

  /**
   * A race nobody has been marked on is not nobody's race — it is in the plan
   * and anyone in the house could still be the one who rides it, so it stands
   * in every column, quietly, until somebody is named.
   */
  function racesFor(day: string, memberId: string) {
    return plansOnIsoDate(plans, day)
      .map((plan) => {
        const marked = members.filter((m) => (plan.memberStatus[m.id] ?? "none") !== "none");
        return {
          plan,
          claimed: (plan.memberStatus[memberId] ?? "none") !== "none",
          unclaimed: marked.length === 0,
          settled: marked.length > 0 && marked.every((m) => plan.memberStatus[m.id] === "paid"),
        };
      })
      .filter((r) => r.claimed || r.unclaimed);
  }

  if (members.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-medium">{t.planSetupPeople}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.planSetupPeopleBody}</p>
        <Button asChild size="sm" className="mt-4">
          <Link href={`/${locale}/account/riders`}>
            <Plus data-icon="inline-start" />
            {t.profilesAdd}
          </Link>
        </Button>
      </div>
    );
  }

  let lastMonth = "";

  return (
    <div>
      {/*
        `overflow-x: auto` makes this a scroll container in both axes, and a
        sticky heading inside one sticks to the container — which never scrolls
        — so it sat 56px down the table, on top of the second row. Wide enough
        to need sideways scrolling only on a phone; above that the page is the
        scrollport and the heading sticks under the bar as intended.
      */}
      <div className="overflow-x-auto md:overflow-x-visible">
        {/* `border-separate` because a sticky heading does not stick inside a
            collapsed-border table — the borders are drawn by the cells here. */}
        <table className="w-full min-w-[38rem] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left">
              <th scope="col" className={cn(HEAD, "w-24 px-3 text-right")}>
                {t.date}
              </th>
              <th scope="col" className={cn(HEAD, "w-24 px-2")}>
                {t.planDay}
              </th>
              <th scope="col" className={cn(HEAD, "w-44 px-2")}>
                {t.planNote}
              </th>
              {members.map((m) => (
                <th
                  key={m.id}
                  scope="col"
                  className={cn(HEAD, "px-2")}
                  // The rider columns share whatever is left, evenly, so the
                  // table does not jump about as names come and go.
                  style={{ width: `${68 / members.length}%` }}
                >
                  {firstName(m.name)}
                </th>
              ))}
              <th scope="col" className={cn(HEAD, "w-10 px-2")}>
                <Link
                  href={`/${locale}/account/riders`}
                  aria-label={t.profilesAdd}
                  title={t.profilesAdd}
                  className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                </Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const d = parseISO(day);
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              const isToday = day === today;
              const past = day < today;
              const note = blocked[day];
              const busy = isBusyIsoDate(day, busyWeekdays);
              const month = day.slice(0, 7);
              const newMonth = month !== lastMonth;
              lastMonth = month;

              return (
                <Fragment key={day}>
                  {/* Sixty numbered rows need somewhere to breathe; the month
                      it turns into is the natural place. */}
                  {newMonth ? (
                    <tr>
                      <td
                        colSpan={4 + members.length}
                        className="border-b bg-muted/40 px-3 py-1 text-xs font-semibold tracking-wide first-letter:uppercase"
                      >
                        {format(d, "LLLL yyyy", { locale: df })}
                      </td>
                    </tr>
                  ) : null}
                  <tr
                    onClick={() => onSelectDay(day)}
                    className={cn(
                      "group/row cursor-default align-middle",
                      weekend && "bg-stone-200/45 dark:bg-stone-900/50",
                      (note || busy) && "bg-muted/60",
                      past && "opacity-55",
                      selected === day && "bg-brand/8 inset-ring inset-ring-brand/40",
                      "hover:bg-accent/60",
                    )}
                  >
                    <th
                      scope="row"
                      className={cn(
                        CELL,
                        "px-3 text-right text-xs font-normal tabular-nums whitespace-nowrap",
                        isToday ? "font-semibold text-brand" : "text-muted-foreground",
                      )}
                    >
                      {format(d, "d. M.", { locale: df })}
                    </th>
                    <td
                      className={cn(
                        CELL,
                        "text-xs whitespace-nowrap text-muted-foreground first-letter:uppercase",
                      )}
                    >
                      {format(d, "EEEE", { locale: df })}
                    </td>
                    <td className={CELL}>
                      <NoteCell
                        locale={locale}
                        value={note?.note ?? ""}
                        onSave={(next) => onSetNote(day, next)}
                      />
                    </td>
                    {members.map((m) => (
                      <td key={m.id} className={CELL}>
                        <div className="flex flex-col gap-0.5">
                          {racesFor(day, m.id).map(({ plan, unclaimed, settled }) => (
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
                                unclaimed && "text-muted-foreground",
                              )}
                            >
                              <span
                                aria-hidden
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full",
                                  unclaimed && "opacity-50",
                                )}
                                style={{ background: disciplineColor(plan.event.disciplines) }}
                              />
                              <span className="truncate">{plan.event.name}</span>
                              {/* Entered and paid for: the one state worth a
                                  mark, because it is the one that means there
                                  is nothing left to do. */}
                              {settled ? (
                                <Check
                                  className="size-3 shrink-0 text-muted-foreground"
                                  aria-label={t.planPaid}
                                />
                              ) : null}
                            </Link>
                          ))}
                        </div>
                      </td>
                    ))}
                    <td className={CELL} />
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExtraWeeks((w) => w + WEEKS_AT_A_TIME)}
        >
          {t.planMoreDays}
        </Button>
      </div>
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

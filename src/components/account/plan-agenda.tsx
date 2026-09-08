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
import { memberLabel } from "@/components/account/race-plan-controls";
import { isBusyIsoDate } from "@/lib/plan-prefs";
import {
  plansOnIsoDate,
  type BlockedDay,
  type EventPlan,
  type PlannerMember,
} from "@/lib/planner";
import { cn } from "@/lib/utils";

const WEEKS_AT_A_TIME = 8;

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

  // A race nobody has been marked on yet belongs to the household, not to a
  // person — the same column a family sheet keeps for "all of us".
  const columns = [{ id: "__all__", label: t.planEveryone }, ...members.map((m) => ({
    id: m.id,
    label: memberLabel(m, t),
  }))];

  function racesFor(iso: string, columnId: string): EventPlan[] {
    const onDay = plansOnIsoDate(plans, iso);
    if (columnId === "__all__") {
      return onDay.filter((p) => members.every((m) => (p.memberStatus[m.id] ?? "none") === "none"));
    }
    return onDay.filter((p) => (p.memberStatus[columnId] ?? "none") !== "none");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead className="sticky top-12 z-10">
            <tr className="border-b bg-muted text-left">
              <th scope="col" className="px-3 py-1.5 text-xs font-medium">
                {t.date}
              </th>
              <th scope="col" className="px-2 py-1.5 text-xs font-medium">
                {t.planDay}
              </th>
              <th scope="col" className="px-2 py-1.5 text-xs font-medium">
                {t.planNote}
              </th>
              {columns.map((c) => (
                <th key={c.id} scope="col" className="px-2 py-1.5 text-xs font-medium">
                  {c.label}
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
                    "group/row border-b align-top last:border-b-0",
                    weekend && "bg-stone-200/45 dark:bg-stone-900/50",
                    (note || busy) && "bg-muted/60",
                    selected === iso && "bg-brand/8 inset-ring inset-ring-brand/40",
                    "hover:bg-accent/60",
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      "px-3 py-1 text-left text-xs font-normal tabular-nums whitespace-nowrap",
                      isToday ? "font-semibold text-brand" : "text-muted-foreground",
                    )}
                  >
                    {format(d, "d. M. yyyy", { locale: df })}
                  </th>
                  <td className="px-2 py-1 text-xs whitespace-nowrap text-muted-foreground">
                    {format(d, "EEEE", { locale: df })}
                  </td>
                  <td className="px-2 py-1">
                    <NoteCell
                      locale={locale}
                      value={note?.note ?? ""}
                      onSave={(next) => onSetNote(iso, next)}
                    />
                  </td>
                  {columns.map((c) => (
                    <td key={c.id} className="px-2 py-1">
                      <div className="flex flex-col gap-0.5">
                        {racesFor(iso, c.id).map((plan) => (
                          <Link
                            key={plan.event.id}
                            href={eventMapPath(locale, {
                              slug: plan.event.slug,
                              startDate: plan.event.startDate,
                              endDate: plan.event.endDate,
                            })}
                            onClick={(e) => e.stopPropagation()}
                            className="flex min-w-0 items-center gap-1.5 text-xs leading-tight hover:underline"
                          >
                            <span
                              aria-hidden
                              className="size-1.5 shrink-0 rounded-full"
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

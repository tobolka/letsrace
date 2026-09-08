import { todayIso } from "@/lib/date-presets";
import { formatIsoDate, parseIsoDate, saturdayOfRaceWeekend } from "@/lib/planner";

/**
 * A month as a grid of days, Monday first.
 *
 * The season used to be a row of weekends, which is the right shape for "is
 * this Saturday free" and the wrong one for everything else: a Wednesday
 * criterium had nowhere to sit, and a month with one race in it looked the
 * same as a month with five. A calendar puts every day on the page, so a race
 * lands on the day it is actually on.
 *
 * Weeks run Monday to Sunday because that is the week in the countries this
 * catalogue covers, and it keeps the weekend — the part people plan around —
 * together at the end of the row instead of split across two.
 */

export type MonthDay = {
  iso: string;
  day: number;
  /** False for the leading and trailing days that fill the first and last row. */
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  /** The Saturday of the weekend this day is planned around. */
  saturday: string;
};

/** The first day of the month a date belongs to, as `YYYY-MM-01`. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, delta: number): string {
  const [y, m] = monthStart(iso).split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1 + delta, 1);
  return formatIsoDate(d);
}

export function monthGrid(anchorIso: string, opts?: { today?: string }): MonthDay[][] {
  const today = opts?.today ?? todayIso();
  const first = parseIsoDate(monthStart(anchorIso));
  const month = first.getMonth();
  // getDay() is Sunday-based; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), month + 1, 0).getDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);

  const grid: MonthDay[][] = [];
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() - lead);
  for (let w = 0; w < weeks; w++) {
    const row: MonthDay[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = formatIsoDate(cursor);
      row.push({
        iso,
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
        isToday: iso === today,
        isWeekend: d >= 5,
        saturday: saturdayOfRaceWeekend(iso),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    grid.push(row);
  }
  return grid;
}

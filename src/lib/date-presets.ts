/** Shared date presets for explore SSR + client. */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso(now = new Date()) {
  return iso(now);
}

/**
 * Sat–Sun of the current calendar weekend
 * (including today if already weekend).
 */
export function thisWeekendRange(now = new Date()): { from: string; to: string } {
  const day = now.getDay(); // 0 Sun … 6 Sat
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (day === 6) {
    const sun = new Date(start);
    sun.setDate(sun.getDate() + 1);
    return { from: iso(start), to: iso(sun) };
  }
  if (day === 0) {
    const sat = new Date(start);
    sat.setDate(sat.getDate() - 1);
    return { from: iso(sat), to: iso(start) };
  }
  const sat = new Date(start);
  sat.setDate(sat.getDate() + (6 - day));
  const sun = new Date(sat);
  sun.setDate(sun.getDate() + 1);
  return { from: iso(sat), to: iso(sun) };
}

export function nextWeekendRange(now = new Date()): { from: string; to: string } {
  const thisW = thisWeekendRange(now);
  const from = new Date(thisW.from + "T12:00:00");
  from.setDate(from.getDate() + 7);
  const to = new Date(thisW.to + "T12:00:00");
  to.setDate(to.getDate() + 7);
  return { from: iso(from), to: iso(to) };
}

export function thisMonthRange(now = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: iso(from), to: iso(to) };
}

export function nextMonthRange(now = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return { from: iso(from), to: iso(to) };
}

export type DatePresetId = "weekend" | "nextWeekend" | "upcoming" | "thisMonth" | "nextMonth" | "any";

/**
 * The quick choices for the date filter, in the order a phone offers them,
 * each with the range it sets and whether it is the one in force.
 */
export function datePresetRanges(
  dateFrom: string,
  dateTo: string,
  now = new Date(),
): { id: DatePresetId; from: string; to: string; active: boolean }[] {
  const ranges: { id: DatePresetId; from: string; to: string }[] = [
    { id: "weekend", ...thisWeekendRange(now) },
    { id: "nextWeekend", ...nextWeekendRange(now) },
    { id: "upcoming", from: todayIso(now), to: "" },
    { id: "thisMonth", ...thisMonthRange(now) },
    { id: "nextMonth", ...nextMonthRange(now) },
    { id: "any", from: "", to: "" },
  ];
  return ranges.map((r) => ({ ...r, active: r.from === dateFrom && r.to === dateTo }));
}

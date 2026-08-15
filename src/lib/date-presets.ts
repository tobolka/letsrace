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

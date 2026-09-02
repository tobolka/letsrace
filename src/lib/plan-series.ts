/**
 * A series is the one thing in a season that has a shape: eight rounds, you
 * did four, the next one is in a fortnight. The plan knows about single races;
 * this turns the ones that belong together back into the thing people actually
 * say out loud — "we do the Solid MTB Maraton".
 */

import { todayIso } from "@/lib/date-presets";

export type SeriesRound = {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string | null;
  place: string | null;
  seriesId: string;
  seriesName: string;
  seriesSlug: string | null;
};

export type SeriesProgress = {
  seriesId: string;
  seriesName: string;
  seriesSlug: string | null;
  /** Every round of the series in the season being looked at. */
  rounds: SeriesRound[];
  /** Rounds that are in the plan, past or future. */
  inPlan: number;
  /** Rounds in the plan that have already been ridden. */
  ridden: number;
  total: number;
  /** The next round still to come, whether or not it is in the plan. */
  next: SeriesRound | null;
  /** Upcoming rounds not in the plan — what "add the rest" would add. */
  remaining: SeriesRound[];
};

export function buildSeriesProgress(
  rounds: SeriesRound[],
  opts: { plannedEventIds: Set<string>; today?: string },
): SeriesProgress[] {
  const today = opts.today ?? todayIso();
  const bySeries = new Map<string, SeriesRound[]>();
  for (const round of rounds) {
    const list = bySeries.get(round.seriesId);
    if (list) list.push(round);
    else bySeries.set(round.seriesId, [round]);
  }

  const out: SeriesProgress[] = [];
  for (const [seriesId, list] of bySeries) {
    const sorted = [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const planned = sorted.filter((r) => opts.plannedEventIds.has(r.id));
    // A series nobody in this household has entered is not "a series you ride".
    if (planned.length === 0) continue;
    const upcoming = sorted.filter((r) => (r.endDate ?? r.startDate) >= today);
    out.push({
      seriesId,
      seriesName: sorted[0].seriesName,
      seriesSlug: sorted[0].seriesSlug,
      rounds: sorted,
      inPlan: planned.length,
      ridden: planned.filter((r) => (r.endDate ?? r.startDate) < today).length,
      total: sorted.length,
      next: upcoming[0] ?? null,
      remaining: upcoming.filter((r) => !opts.plannedEventIds.has(r.id)),
    });
  }

  // A series still running matters more than one that finished in May.
  out.sort((a, b) => {
    if (Boolean(a.next) !== Boolean(b.next)) return a.next ? -1 : 1;
    if (a.next && b.next) return a.next.startDate.localeCompare(b.next.startDate);
    return a.seriesName.localeCompare(b.seriesName);
  });
  return out;
}

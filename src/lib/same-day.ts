/**
 * What the signed-in family already has on a race's days: other races in the
 * plan that overlap them, and days marked as taken. A pure check, so the race
 * card and the race page say the same thing.
 */
export type PlannedRace = { id: string; name: string; slug: string; startDate: string; endDate: string | null };
export type TakenDay = { day: string; note: string | null };

export type SameDayConflicts = { races: PlannedRace[]; days: TakenDay[] };

export function sameDayConflicts(
  race: { id: string; startDate: string; endDate?: string | null },
  planned: PlannedRace[],
  taken: TakenDay[],
): SameDayConflicts {
  const from = race.startDate, to = race.endDate || race.startDate;
  const seen = new Set<string>();
  const races = planned
    .filter((p) => p.id !== race.id && !seen.has(p.id) && Boolean(seen.add(p.id)))
    .filter((p) => p.startDate <= to && (p.endDate || p.startDate) >= from)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
  const days = taken.filter((d) => d.day >= from && d.day <= to).sort((a, b) => a.day.localeCompare(b.day));
  return { races, days };
}

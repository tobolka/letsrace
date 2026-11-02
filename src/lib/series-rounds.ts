/** A pause this long between two rounds ends a season. */
const SEASON_GAP_DAYS = 90;

const day = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000;

/**
 * Which round of its season a race is: "3 of 8". The season is read from the
 * dates, not the `season` field — sources write "2026" and "2026/27" for the
 * same cyclocross winter — so rounds belong together until a long pause.
 * Null when the season has fewer than two rounds or the race is not in it.
 */
export function roundOf(raceId: string, rounds: { id: string; startDate: string }[]): { n: number; of: number } | null {
  const sorted = [...rounds].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  let season: typeof sorted = [];
  for (const round of sorted) {
    const last = season.at(-1);
    if (last && day(round.startDate) - day(last.startDate) > SEASON_GAP_DAYS) {
      if (season.some((r) => r.id === raceId)) break;
      season = [];
    }
    season.push(round);
  }
  const index = season.findIndex((r) => r.id === raceId);
  return index < 0 || season.length < 2 ? null : { n: index + 1, of: season.length };
}

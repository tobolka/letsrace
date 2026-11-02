export type SeriesRound = { id: string; startDate: string; name?: string; season?: string | null; disciplines?: string[] };
export type RoundPosition = { n: number; of: number | null };

/** Only an actual round designation, never an edition number or chronological guess. */
export function statedRound(name: string): number | null {
  const match = name.match(/\b(\d{1,2})\.?\s*(?:kolo|round|runda|lauf)\b/i) ??
    name.match(/\b(?:kolo|round|runda|lauf|wyścig|wyscig)\s*[#:]?\s*(\d{1,2})\b/i);
  const n = match ? Number(match[1]) : 0;
  return n > 0 ? n : null;
}

function seasonOf(race: SeriesRound): string {
  const year = Number(race.startDate.slice(0, 4));
  const winter = race.season?.match(/^(20\d{2})\s*[/-]\s*((?:20)?\d{2})$/);
  if (winter) {
    const end = winter[2].length === 2 ? Number(winter[1].slice(0, 2) + winter[2]) : Number(winter[2]);
    if (end === Number(winter[1]) + 1) return String(end);
  }
  if (race.disciplines?.includes("cx")) return String(year + (Number(race.startDate.slice(5, 7)) >= 9 ? 1 : 0));
  return String(year);
}

/** Known round number and number of listed rounds, not a claim of calendar completeness. */
export function roundOf(raceId: string, rounds: SeriesRound[]): RoundPosition | null {
  const race = rounds.find(row => row.id === raceId);
  if (!race) return null;
  const n = statedRound(race.name ?? "");
  if (!n) return null;
  const season = rounds.filter(row => seasonOf(row) === seasonOf(race));
  const numbers = season.map(row => statedRound(row.name ?? ""));
  const unique = new Set(numbers);
  const completeRun = numbers.every(value => value != null) && unique.size >= 2 && Math.max(...numbers as number[]) === unique.size;
  return { n, of: completeRun ? unique.size : null };
}

/** A cached tooltip result belongs to one race and one series only. */
export function currentSeriesRound(result: { key: string; value: RoundPosition | null } | null, key: string) {
  return result?.key === key ? result.value : null;
}

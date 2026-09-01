import { distanceKm } from "@/lib/geo/distance";

/**
 * What to put in front of someone on a weekend they have nothing planned.
 *
 * Two signals, in this order, because they are the two reasons people said they
 * pick a race: it is the next round of something they are already doing, and it
 * is close enough to drive to on a Saturday morning. A race that is both beats
 * either alone.
 */
export type SuggestionCandidate = {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string | null;
  seriesId: string | null;
  seriesName: string | null;
  disciplines: string[];
  place: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
};

export type SuggestionContext = {
  /** Where they said they are, from their race alert. */
  home: { lat: number; lng: number } | null;
  /** How far they were willing to be told about. */
  radiusKm: number;
  /** Series they have already entered at least one round of. */
  riddenSeriesIds: Set<string>;
  /** Disciplines they have actually raced, not everything on the map. */
  riddenDisciplines: Set<string>;
  /** Already in the plan — never suggest these back. */
  plannedEventIds: Set<string>;
};

export type Suggestion = SuggestionCandidate & {
  distanceKm: number | null;
  /** Why it is being shown, so the card can say so rather than just listing. */
  reason: "series" | "nearby" | "discipline";
};

/** Beyond this a Saturday race is a weekend away, not a morning out. */
const HARD_LIMIT_KM = 2.5;

export function rankSuggestions(
  candidates: SuggestionCandidate[],
  ctx: SuggestionContext,
  limit = 4,
): Suggestion[] {
  const maxKm = ctx.radiusKm * HARD_LIMIT_KM;

  const scored = candidates
    .filter((c) => !ctx.plannedEventIds.has(c.id))
    .map((c) => {
      const km =
        ctx.home && c.lat != null && c.lng != null
          ? distanceKm(ctx.home, { lat: c.lat, lng: c.lng })
          : null;
      const sameSeries = Boolean(c.seriesId && ctx.riddenSeriesIds.has(c.seriesId));
      const sameDiscipline = c.disciplines.some((d) => ctx.riddenDisciplines.has(d));
      return { c, km, sameSeries, sameDiscipline };
    })
    // A race on the far side of the country is not an answer to "this weekend
    // is free", however well it matches otherwise.
    .filter((s) => s.km == null || s.km <= maxKm)
    .map((s) => {
      const reason: Suggestion["reason"] = s.sameSeries
        ? "series"
        : s.km != null && s.km <= ctx.radiusKm
          ? "nearby"
          : "discipline";
      return { ...s, reason };
    });

  scored.sort((a, b) => {
    // A series they are already riding wins outright: missing a round matters
    // in a way that a new race nearby does not.
    if (a.sameSeries !== b.sameSeries) return a.sameSeries ? -1 : 1;
    if (a.sameDiscipline !== b.sameDiscipline) return a.sameDiscipline ? -1 : 1;
    if (a.km != null && b.km != null && a.km !== b.km) return a.km - b.km;
    if (a.km == null !== (b.km == null)) return a.km == null ? 1 : -1;
    return a.c.startDate.localeCompare(b.c.startDate);
  });

  return scored.slice(0, limit).map((s) => ({ ...s.c, distanceKm: s.km, reason: s.reason }));
}

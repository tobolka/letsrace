import type { EventListItem } from "@/lib/events";
import { distanceKm } from "@/lib/dedup";
import { AGE_BAND_PARENT, eventDisciplineFamily, type AgeCategory } from "@/lib/taxonomy";

/** How far a rider goes for another start; a box this size is asked of the database. */
export const NEARBY_RADIUS_KM = 75;
export const NEARBY_LIMIT = 6;
/** Fewer races of the same kind than this, and other kinds nearby fill the list. */
const MIN_SIMILAR = 3;

/** The age groups a race is for: "u9" counts as kids, so a U9 race and a kids' race meet. */
function ageGroups(event: EventListItem): Set<string> {
  return new Set(event.ageCategories.map((a) => AGE_BAND_PARENT[a as AgeCategory] ?? a));
}

/**
 * Whether the same riders could start both. Categories decide when both races
 * have them; otherwise the audience does, and a race open to all ("mixed")
 * fits anyone. Unknown is not a reason to hide a race.
 */
export function sharesRiders(a: EventListItem, b: EventListItem): boolean {
  const ga = ageGroups(a);
  const gb = ageGroups(b);
  if (ga.size && gb.size) return [...ga].some((g) => gb.has(g));
  if (!a.audience || !b.audience || a.audience === "mixed" || b.audience === "mixed") return true;
  return a.audience === b.audience;
}

export type NearbyRace = { event: EventListItem; km: number };

/**
 * Races near this one that the same rider would want: the same kind of racing
 * for the same age groups first, soonest first. Only when there are too few of
 * those do other races nearby fill the list. Rounds of the race's own series
 * are listed by the page already.
 */
export function pickNearbyRaces(
  race: EventListItem,
  candidates: EventListItem[],
  today: string,
  limit = NEARBY_LIMIT,
): NearbyRace[] {
  const here = race.location;
  if (here?.lat == null || here.lng == null) return [];
  const family = eventDisciplineFamily(race.disciplines);

  const near = candidates.flatMap((e) => {
    if (e.id === race.id || (race.series && e.series?.id === race.series.id)) return [];
    if ((e.endDate ?? e.startDate) < today || ["cancelled", "postponed"].includes(e.status)) return [];
    const at = e.location;
    if (at?.lat == null || at.lng == null) return [];
    const km = distanceKm({ lat: here.lat!, lng: here.lng! }, { lat: at.lat, lng: at.lng });
    if (km > NEARBY_RADIUS_KM) return [];
    const sameKind = family !== "other" && eventDisciplineFamily(e.disciplines) === family;
    const rank = sameKind ? (sharesRiders(race, e) ? 0 : 1) : 2;
    return [{ event: e, km, rank }];
  });

  const byRankThenDate = (a: (typeof near)[number], b: (typeof near)[number]) =>
    a.rank - b.rank || a.event.startDate.localeCompare(b.event.startDate) || a.km - b.km;
  const similar = near.filter((n) => n.rank < 2).sort(byRankThenDate);
  const picked = similar.length >= MIN_SIMILAR ? similar : near.sort(byRankThenDate);
  return picked
    .slice(0, limit)
    .sort((a, b) => a.event.startDate.localeCompare(b.event.startDate) || a.km - b.km)
    .map(({ event, km }) => ({ event, km }));
}

/** The box around a point that holds a circle of `km`, for a coarse first cut in SQL. */
export function boxAround(lat: number, lng: number, km: number) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.1));
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
}

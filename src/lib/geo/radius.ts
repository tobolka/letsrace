import { eventDistanceKm } from "./distance";

type Located = Parameters<typeof eventDistanceKm>[0];
export type RadiusArea = { lat: number; lng: number; km: number };

/** A bounding box is a fetch optimization; the actual distance decides membership. */
export function eventsWithinRadius<T extends Located>(events: T[], area: RadiusArea | null): T[] {
  if (!area) return events;
  return events.filter((event) => {
    const km = eventDistanceKm(event, area);
    return km != null && km <= area.km;
  });
}

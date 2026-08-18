import { distanceKm } from "@/lib/geo/distance";
import { shouldHideFromMap, PUBLIC_EVENT_STATUSES } from "@/lib/event-visibility";
import { isBusyIsoDate } from "@/lib/plan-prefs";
import { expandDisciplineFilter } from "@/lib/taxonomy";

export const ALERT_RADIUS_PRESETS = [30, 50, 80, 120, 200] as const;
export const ALERT_RADIUS_DEFAULT = 80;
export const ALERT_RADIUS_MIN = 10;
export const ALERT_RADIUS_MAX = 400;

export type RaceAlert = {
  id: string;
  userId: string;
  enabled: boolean;
  label: string;
  lat: number;
  lng: number;
  radiusKm: number;
  disciplines: string[];
  locale: string;
  createdAt: string;
};

export type AlertCandidate = {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  disciplines: string[];
  status: string | null;
  visibility: string | null;
  createdAt: string;
  lat: number | null;
  lng: number | null;
  place: string | null;
  countryCode: string | null;
};

export type AlertMatch = {
  event: AlertCandidate;
  km: number;
};

export function clampRadiusKm(n: number): number {
  if (!Number.isFinite(n)) return ALERT_RADIUS_DEFAULT;
  return Math.min(ALERT_RADIUS_MAX, Math.max(ALERT_RADIUS_MIN, Math.round(n)));
}

export function disciplinesMatch(eventDisciplines: string[], alertDisciplines: string[]): boolean {
  if (alertDisciplines.length === 0) return true;
  const wanted = new Set(expandDisciplineFilter(alertDisciplines));
  return eventDisciplines.some((d) => wanted.has(d));
}

export function matchAlert(
  alert: Pick<RaceAlert, "lat" | "lng" | "radiusKm" | "disciplines" | "createdAt">,
  event: AlertCandidate,
  todayIso: string,
  busyWeekdays: number[] = [],
): AlertMatch | null {
  if (event.startDate < todayIso) return null;
  if (isBusyIsoDate(event.startDate, busyWeekdays)) return null;
  if (event.createdAt < alert.createdAt) return null;
  if (shouldHideFromMap(event.name, event.status, event.visibility)) return null;
  if (event.status && !PUBLIC_EVENT_STATUSES.includes(event.status as (typeof PUBLIC_EVENT_STATUSES)[number])) {
    return null;
  }
  if (event.lat == null || event.lng == null) return null;
  if (!disciplinesMatch(event.disciplines, alert.disciplines)) return null;
  const km = distanceKm({ lat: alert.lat, lng: alert.lng }, { lat: event.lat, lng: event.lng });
  if (km > alert.radiusKm) return null;
  return { event, km };
}

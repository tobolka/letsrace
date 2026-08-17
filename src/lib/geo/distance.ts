/** Haversine distance in km. Safe to import from client components. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistanceKm(km: number, locale = "en"): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) {
    const meters = Math.max(50, Math.round(km * 20) * 50);
    return `${meters}\u00a0m`;
  }
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  const text = new Intl.NumberFormat(locale, {
    maximumFractionDigits: km < 10 ? 1 : 0,
  }).format(rounded);
  return `${text}\u00a0km`;
}

type Located = {
  startDate?: string;
  location?: { lat?: number | null; lng?: number | null } | null;
};

function eventPoint(event: Located): { lat: number; lng: number } | null {
  const lat = event.location?.lat;
  const lng = event.location?.lng;
  if (lat == null || lng == null) return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return { lat: la, lng: ln };
}

export function eventDistanceKm(
  event: Located,
  origin: { lat: number; lng: number } | null,
): number | null {
  if (!origin) return null;
  const pt = eventPoint(event);
  if (!pt) return null;
  return distanceKm(origin, pt);
}

/** Nearest first; undated/unlocated events go last. Date is the tiebreaker. */
export function sortByDistanceFrom<T extends Located>(
  events: T[],
  origin: { lat: number; lng: number } | null,
): T[] {
  if (!origin) return events;
  return [...events].sort((a, b) => {
    const da = eventDistanceKm(a, origin) ?? Number.POSITIVE_INFINITY;
    const db = eventDistanceKm(b, origin) ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return (a.startDate || "").localeCompare(b.startDate || "");
  });
}

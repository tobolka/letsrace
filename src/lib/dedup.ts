import { normalizeName } from "@/lib/domain";

/** Haversine distance in km */
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

/** Dice coefficient on character bigrams */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bigrams = (s: string) => {
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };
  const A = bigrams(x);
  const B = bigrams(y);
  if (!A.length || !B.length) return 0;
  let inter = 0;
  const pool = [...B];
  for (const g of A) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      inter += 1;
      pool.splice(i, 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

/**
 * Same race if same date + (same fingerprint OR close place + similar name).
 * Used to merge Sumator / ČSC / organizer pages into one event.
 */
export function isLikelyDuplicate(
  a: {
    startDate: string;
    name: string;
    lat?: number | null;
    lng?: number | null;
    fingerprint?: string;
  },
  b: {
    startDate: string;
    name: string;
    lat?: number | null;
    lng?: number | null;
    fingerprint?: string;
  },
): boolean {
  if (a.startDate !== b.startDate) return false;
  if (a.fingerprint && b.fingerprint && a.fingerprint === b.fingerprint) return true;
  const sim = nameSimilarity(a.name, b.name);
  if (sim >= 0.92) return true;
  if (
    a.lat != null &&
    a.lng != null &&
    b.lat != null &&
    b.lng != null &&
    distanceKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= 15 &&
    sim >= 0.55
  ) {
    return true;
  }
  if (sim >= 0.75 && normalizeName(a.name).includes(normalizeName(b.name).slice(0, 12))) {
    return true;
  }
  return false;
}

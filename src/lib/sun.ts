/**
 * Sunrise and sunset for a place and day, computed here — no service. The
 * method is the one SunCalc uses (after the NOAA formulas), accurate to a
 * minute or two in Europe: plenty for "is it light at the start".
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const OBLIQUITY = RAD * 23.4397;

const toDays = (date: Date) => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * DAY_MS);
const meanAnomaly = (d: number) => RAD * (357.5291 + 0.98560028 * d);
const eclipticLongitude = (m: number) =>
  m + RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)) + RAD * 102.9372 + Math.PI;
const transit = (ds: number, m: number, l: number) => J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);

/** Times in UTC; null for a day the sun does not rise or set (far north). */
export function sunTimes(lat: number, lng: number, isoDay: string): { rise: Date; set: Date } | null {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(new Date(`${isoDay}T12:00:00Z`));
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + lw / (2 * Math.PI) + n;
  const m = meanAnomaly(ds);
  const l = eclipticLongitude(m);
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
  const noon = transit(ds, m, l);
  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosH < -1 || cosH > 1) return null;
  const w = Math.acos(cosH);
  const set = transit(0.0009 + (w + lw) / (2 * Math.PI) + n, m, l);
  return { rise: fromJulian(noon - (set - noon)), set: fromJulian(set) };
}

/** The clock a race's country keeps; Central European time unless listed. */
const ZONES: Record<string, string> = {
  GB: "Europe/London",
  IE: "Europe/Dublin",
  PT: "Europe/Lisbon",
  FI: "Europe/Helsinki",
  EE: "Europe/Tallinn",
  LV: "Europe/Riga",
  LT: "Europe/Vilnius",
  RO: "Europe/Bucharest",
  BG: "Europe/Sofia",
  GR: "Europe/Athens",
  UA: "Europe/Kyiv",
  MD: "Europe/Chisinau",
  CY: "Asia/Nicosia",
};
export const zoneOf = (countryCode: string | null | undefined) => ZONES[countryCode ?? ""] ?? "Europe/Berlin";

/** "7:02" in the race's own time. */
export function localClock(at: Date, countryCode: string | null | undefined, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: zoneOf(countryCode) }).format(at);
}

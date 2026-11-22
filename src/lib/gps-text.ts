/**
 * Coordinates an organiser wrote into a line of text: "GPS: 49.6689169N, 14.4300139E",
 * "49.6689°N 14.4300°E", "N 49.6689, E 14.43", "GPS 49.6689, 14.43" or degrees-minutes-seconds.
 * Read only from the quote itself, so what the page shows is what the document says.
 * Roughly Europe: a pair outside it is a different number, not a place.
 */
export type GpsPoint = { lat: number; lng: number };

const inEurope = (lat: number, lng: number) => lat >= 34 && lat <= 72 && lng >= -25 && lng <= 45;
const decimals = (value: string) => Number(value.replace(",", "."));

export function gpsFromText(text: string): GpsPoint | null {
  const s = text.replace(/[  ]/g, " ");
  // Degrees, minutes, seconds: 49°40'08.1"N 14°25'48.1"E
  const dms = /(\d{1,2})\s*°\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["″”]|'')?\s*([NS])[\s,;]+(\d{1,3})\s*°\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["″”]|'')?\s*([EW])/i.exec(s);
  if (dms) {
    const lat = (Number(dms[1]) + Number(dms[2]) / 60 + decimals(dms[3]!) / 3600) * (dms[4]!.toUpperCase() === "S" ? -1 : 1);
    const lng = (Number(dms[5]) + Number(dms[6]) / 60 + decimals(dms[7]!) / 3600) * (dms[8]!.toUpperCase() === "W" ? -1 : 1);
    return inEurope(lat, lng) ? { lat, lng } : null;
  }
  // 49.6689169N, 14.4300139E  /  49.6689° N 14.43° E
  const after = /(\d{1,2}[.,]\d{3,})\s*°?\s*([NS])\s*[,;\s]+\s*(\d{1,3}[.,]\d{3,})\s*°?\s*([EW])/i.exec(s);
  // N 49.6689, E 14.4300
  const before = /([NS])\s*:?\s*(\d{1,2}[.,]\d{3,})\s*°?\s*[,;\s]+\s*([EW])\s*:?\s*(\d{1,3}[.,]\d{3,})/i.exec(s);
  // GPS: 49.6689, 14.4300
  const plain = /\b(?:GPS|souřadnice|souradnice|coordinates|koordinaten)\s*:?\s*(\d{1,2}[.,]\d{3,})\s*°?\s*[,;/\s]\s*(\d{1,3}[.,]\d{3,})/i.exec(s);
  let lat: number, lng: number;
  if (after) {
    lat = decimals(after[1]!) * (after[2]!.toUpperCase() === "S" ? -1 : 1);
    lng = decimals(after[3]!) * (after[4]!.toUpperCase() === "W" ? -1 : 1);
  } else if (before) {
    lat = decimals(before[2]!) * (before[1]!.toUpperCase() === "S" ? -1 : 1);
    lng = decimals(before[4]!) * (before[3]!.toUpperCase() === "W" ? -1 : 1);
  } else if (plain) {
    lat = decimals(plain[1]!);
    lng = decimals(plain[2]!);
  } else return null;
  return inEurope(lat, lng) ? { lat, lng } : null;
}

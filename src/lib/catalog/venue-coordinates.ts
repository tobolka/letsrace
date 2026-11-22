import { gpsFromText, type GpsPoint } from "@/lib/gps-text";

/**
 * A venue read without its coordinates, though the document states them beside it:
 * "Místo konání: Areál RAC Sedlčany" with "GPS: 49.6689N, 14.4300E" on the same or a neighbouring line.
 * Only a line within `reach` lines of the quoted venue counts, so a coordinate for the finish, a parking
 * place or another race never moves the venue. The quote grows to the contiguous passage that holds both,
 * so the page can still be checked against the document.
 */
export function venueCoordinatesFromDocument(
  text: string,
  venueQuote: string,
  reach = 2,
): { point: GpsPoint; quote: string } | null {
  const lines = text.split("\n").map((line) => line.trim());
  const first = venueQuote.split("\n").map((line) => line.trim()).find(Boolean);
  if (!first) return null;
  const at = lines.findIndex((line) => line.length > 0 && (line.includes(first) || first.includes(line)) && Math.min(line.length, first.length) >= 8);
  if (at < 0) return null;
  const last = at + Math.max(0, venueQuote.split("\n").filter((l) => l.trim()).length - 1);
  // Nearest first: the line itself, then outward.
  const order: number[] = [];
  for (let d = 0; d <= reach; d++) for (const i of d === 0 ? [at] : [at - d, last + d]) order.push(i);
  for (const i of order) {
    const point = lines[i] ? gpsFromText(lines[i]!) : null;
    if (!point) continue;
    const from = Math.min(at, i), to = Math.max(last, i);
    const quote = lines.slice(from, to + 1).filter(Boolean).join("\n");
    if (quote.length > 1500) return null;
    return { point, quote };
  }
  return null;
}

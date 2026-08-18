export type ViewportBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/**
 * True when the camera moved enough that a new area search is worth it.
 * Tiny nudges, padding jitter, and pin-focus pans stay put.
 */
export function viewportChangedEnough(prev: ViewportBox, next: ViewportBox): boolean {
  const pw = prev.east - prev.west;
  const ph = prev.north - prev.south;
  const nw = next.east - next.west;
  const nh = next.north - next.south;
  if (pw <= 0 || ph <= 0 || nw <= 0 || nh <= 0) return true;

  const cx = Math.abs((prev.west + prev.east) / 2 - (next.west + next.east) / 2);
  const cy = Math.abs((prev.south + prev.north) / 2 - (next.south + next.north) / 2);
  const panned = cx > pw * 0.18 || cy > ph * 0.18;
  const zoomed =
    nw / pw < 0.72 || nw / pw > 1.38 || nh / ph < 0.72 || nh / ph > 1.38;
  return panned || zoomed;
}

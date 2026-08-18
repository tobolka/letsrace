export type ViewportBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** How much to grow the camera box on each side when fetching pins. */
export const VIEWPORT_FETCH_PAD = 0.65;

/**
 * Grow a camera box so nearby races load before they enter the frame.
 * `pad` is a fraction of the current width/height added on every side.
 */
export function expandViewport(box: ViewportBox, pad = VIEWPORT_FETCH_PAD): ViewportBox {
  const w = box.east - box.west;
  const h = box.north - box.south;
  if (w <= 0 || h <= 0) return box;
  return {
    west: box.west - w * pad,
    south: box.south - h * pad,
    east: box.east + w * pad,
    north: box.north + h * pad,
  };
}

/**
 * True when the visible camera is about to leave the area we already fetched.
 * `fetched` should be the expanded box from the last request.
 */
export function viewportNeedsFetch(fetched: ViewportBox, visible: ViewportBox): boolean {
  const fw = fetched.east - fetched.west;
  const fh = fetched.north - fetched.south;
  const vw = visible.east - visible.west;
  const vh = visible.north - visible.south;
  if (fw <= 0 || fh <= 0 || vw <= 0 || vh <= 0) return true;

  const mx = fw * 0.1;
  const my = fh * 0.1;
  return (
    visible.west < fetched.west + mx ||
    visible.east > fetched.east - mx ||
    visible.south < fetched.south + my ||
    visible.north > fetched.north - my
  );
}

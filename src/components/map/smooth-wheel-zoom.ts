import type { LeafletMap, LatLng, Point } from "./leaflet-runtime";

/**
 * Leaflet 1.9.4's native wheel handler batches input into separate 250 ms zooms.
 * Use the same continuous camera path as its built-in pinch/fly handlers. The
 * private methods are deliberately isolated here and tied to our vendored 1.9.4.
 */
export interface WheelMap extends LeafletMap {
  stop(): this;
  getMinZoom(): number;
  getMaxZoom(): number;
  mouseEventToContainerPoint(event: MouseEvent): Point;
  _moveStart(zoomChanged: boolean, noMoveStart?: boolean): this;
  _move(center: LatLng, zoom: number, data: { pinch: boolean; round: boolean }): this;
  _moveEnd(zoomChanged: boolean): this;
}

export function attachSmoothWheelZoom(map: WheelMap, container: HTMLElement) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let frame = 0;
  let active = false;
  let targetZoom = map.getZoom();
  let cursor: Point;
  let anchor: LatLng;
  let lastFrame = 0;
  let lastInput = 0;

  const finish = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!active) return;
    active = false;
    // A single settle per gesture: labels, clusters and fetching stay off the frame loop.
    map._moveEnd(true);
  };
  const move = (zoom: number) => {
    const world = map.project([anchor.lat, anchor.lng], zoom);
    const size = map.getSize();
    const center = map.unproject([world.x + size.x / 2 - cursor.x, world.y + size.y / 2 - cursor.y], zoom);
    map._move(center, zoom, { pinch: true, round: false });
  };
  const animate = (now: number) => {
    frame = 0;
    if (!active) return;
    const elapsed = Math.min(64, Math.max(1, now - lastFrame));
    lastFrame = now;
    const current = map.getZoom();
    const remaining = targetZoom - current;
    if (Math.abs(remaining) > 0.001) {
      const next = reduceMotion || Math.abs(remaining) < 0.003
        ? targetZoom : current + remaining * (1 - Math.exp(-elapsed / 65));
      move(next);
    }
    if (now - lastInput >= 100 && Math.abs(targetZoom - map.getZoom()) <= 0.001) {
      move(targetZoom);
      finish();
      return;
    }
    frame = requestAnimationFrame(animate);
  };
  const wheel = (event: WheelEvent) => {
    if (event.target instanceof Element && event.target.closest(".leaflet-control, .fast-map-controls, a, button, input, select, textarea")) return;
    if (!Number.isFinite(event.deltaY) || !event.deltaY) return;
    event.preventDefault();
    event.stopPropagation();
    const now = performance.now();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1);
    if (!active) {
      map.stop();
      targetZoom = map.getZoom();
    }
    // Keep large mouse notches controllable; small trackpad deltas remain fractional.
    const nextTarget = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), targetZoom - Math.max(-0.75, Math.min(0.75, pixels / 160))));
    if (!active && nextTarget === targetZoom) return;
    targetZoom = nextTarget;
    cursor = map.mouseEventToContainerPoint(event);
    anchor = map.containerPointToLatLng([cursor.x, cursor.y]);
    lastInput = now;
    if (!active) {
      active = true;
      lastFrame = now;
      map._moveStart(true);
    }
    if (!frame) frame = requestAnimationFrame(animate);
  };
  container.addEventListener("wheel", wheel, { passive: false });
  container.addEventListener("pointerdown", finish);
  container.addEventListener("keydown", finish);
  return () => {
    cancelAnimationFrame(frame);
    active = false;
    container.removeEventListener("wheel", wheel);
    container.removeEventListener("pointerdown", finish);
    container.removeEventListener("keydown", finish);
  };
}

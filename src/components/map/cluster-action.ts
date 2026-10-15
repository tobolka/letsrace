import type { MapBounds } from "./race-map";
import type { LatLng } from "./leaflet-runtime";

export function clusterAction(points: LatLng[], zoom: number, maxZoom = 18):
  | { type: "expand" }
  | { type: "zoom"; bounds: MapBounds; maxZoom: number } {
  const latitudes = points.map((p) => p.lat), longitudes = points.map((p) => p.lng);
  const bounds = { west: Math.min(...longitudes), east: Math.max(...longitudes), south: Math.min(...latitudes), north: Math.max(...latitudes) };
  // More zoom cannot separate coincident venues. Allow individual selection there.
  if (points.length < 2 || zoom >= maxZoom - 0.01 ||
      (bounds.east - bounds.west < 0.000001 && bounds.north - bounds.south < 0.000001)) {
    return { type: "expand" };
  }
  // Preserve orientation: reveal the area progressively instead of jumping to street level.
  return { type: "zoom", bounds, maxZoom: Math.min(maxZoom, zoom + 2) };
}

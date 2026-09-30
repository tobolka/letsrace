"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { loadMapLibre } from "@/lib/maplibre";
import { MAP_STYLE } from "@/lib/map-style";

export type RadiusPoint = { id: string; lat: number; lng: number; color: string };

const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();

/** A circle of `km` around a point, as a polygon the map can fill. */
function circle(lat: number, lng: number, km: number, steps = 96): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = [];
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

function points(list: RadiusPoint[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: list.map((p) => ({
      type: "Feature",
      properties: { color: p.color },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    })),
  };
}

/**
 * The watched circle, drawn on the map.
 *
 * "Within 80 km" is a number until you can see which towns it takes in. The
 * circle follows the radius as it is changed, the camera refits to it, and the
 * races the alert would catch sit inside it as dots in their discipline's
 * colour — so the setting and what it catches are one picture.
 */
export function RadiusMap({
  lat,
  lng,
  radiusKm,
  races,
  muted = false,
  className,
}: {
  lat: number;
  lng: number;
  radiusKm: number;
  races: RadiusPoint[];
  /** The alert is switched off: the circle turns grey. */
  muted?: boolean;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const latest = useRef({ lat, lng, radiusKm, races, muted });
  latest.current = { lat, lng, radiusKm, races, muted };

  function sync(map: MapLibreMap, animate: boolean) {
    const { lat, lng, radiusKm, races, muted } = latest.current;
    const area = circle(lat, lng, radiusKm);
    (map.getSource("radius") as GeoJSONSource | undefined)?.setData(area);
    (map.getSource("races") as GeoJSONSource | undefined)?.setData(points(races));
    (map.getSource("home") as GeoJSONSource | undefined)?.setData(
      points([{ id: "home", lat, lng, color: "#1c1917" }]),
    );
    const brand = muted ? "#a8a29e" : "#c81d25";
    if (map.getLayer("radius-fill")) map.setPaintProperty("radius-fill", "fill-color", brand);
    if (map.getLayer("radius-line")) map.setPaintProperty("radius-line", "line-color", brand);
    const ring = area.geometry.coordinates[0]!;
    const lngs = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 24, duration: animate ? 450 : 0 },
    );
  }

  useEffect(() => {
    let cancelled = false;
    void loadMapLibre().then((ml) => {
      if (cancelled || !el.current) return;
      const map = new ml.Map({
        container: el.current,
        style: MAP_STYLE,
        center: [latest.current.lng, latest.current.lat],
        zoom: 7,
        attributionControl: { compact: true },
        // A picture of a setting, not a place to browse: no scroll-zoom to
        // steal the page's scrolling, but drag and pinch still work.
        scrollZoom: false,
        transformRequest: cartoKey
          ? (url) =>
              url.includes("basemaps.cartocdn.com") && !/[?&]key=/.test(url)
                ? { url: `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(cartoKey)}` }
                : { url }
          : undefined,
      });
      mapRef.current = map;
      map.on("load", () => {
        const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
        map.addSource("radius", { type: "geojson", data: empty });
        map.addSource("races", { type: "geojson", data: empty });
        map.addSource("home", { type: "geojson", data: empty });
        map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#c81d25", "fill-opacity": 0.07 } });
        map.addLayer({
          id: "radius-line",
          type: "line",
          source: "radius",
          paint: { "line-color": "#c81d25", "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.7 },
        });
        map.addLayer({
          id: "races",
          type: "circle",
          source: "races",
          paint: {
            "circle-radius": 5,
            "circle-color": ["get", "color"],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
          },
        });
        map.addLayer({
          id: "home",
          type: "circle",
          source: "home",
          paint: { "circle-radius": 6, "circle-color": "#1c1917", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
        });
        sync(map, false);
      });
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once; later changes go through `sync`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const racesKey = races.map((r) => r.id).join(",");
  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded()) sync(map, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusKm, racesKey, muted]);

  return <div ref={el} className={className} aria-hidden />;
}

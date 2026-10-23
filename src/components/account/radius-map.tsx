"use client";

import { useEffect, useRef } from "react";
import { loadLeaflet, type LeafletMap, type Circle, type LayerGroup, type LeafletApi } from "@/components/map/leaflet-runtime";
import { addLightBasemap, drawCityLabels, loadCities, type City } from "@/components/map/light-basemap";
import { cn } from "@/lib/utils";
import "@/components/map/light-race-map.css";
import { MAP_COLORS } from "@/lib/map-visuals";

export type RadiusPoint = { id: string; lat: number; lng: number; color: string };
type Props = { lat: number; lng: number; radiusKm: number; races: RadiusPoint[]; muted?: boolean; className?: string; label?: string };

/** Same lightweight basemap as explore; the circle previews the alert's real radius. */
export function RadiusMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const latest = useRef(props);
  const sync = useRef<() => void>(() => {});
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void loadLeaflet().then((L: LeafletApi) => {
      if (disposed || !container.current) return;
      const m = L.map(container.current, { zoomControl: false, scrollWheelZoom: false, zoomSnap: 0, maxZoom: 18 });
      map.current = m;
      const initial = latest.current;
      m.setView([initial.lat, initial.lng], 7);
      addLightBasemap(L, m);
      m.createPane("city-labels").style.zIndex = "450";
      m.createPane("radius-points").style.zIndex = "600";
      const labels = L.layerGroup().addTo(m), dots: LayerGroup = L.layerGroup().addTo(m);
      let cities: City[] = [], area: Circle | undefined, lastArea = "";
      const label = () => {
        labels.clearLayers();
        const p = latest.current;
        const occupied: [number, number, number, number][] = [...p.races, p].map((point) => {
          const at = m.latLngToContainerPoint([point.lat, point.lng]);
          return [at.x - 10, at.y - 10, at.x + 10, at.y + 10];
        });
        drawCityLabels(L, m, labels, cities, occupied);
      };
      sync.current = () => {
        const { lat, lng, radiusKm, races, muted } = latest.current;
        const color = muted ? MAP_COLORS.brandMuted : MAP_COLORS.brand;
        const point: [number, number] = [lat, lng];
        if (!area) area = L.circle(point, { radius: radiusKm * 1000, interactive: false }).addTo(m);
        area.setLatLng(point).setRadius(radiusKm * 1000).setStyle({ color, weight: 1.5, dashArray: "5 5", fillColor: color, fillOpacity: 0.07 });
        dots.clearLayers();
        for (const race of races) L.circleMarker([race.lat, race.lng], { pane: "radius-points", radius: 4, color: MAP_COLORS.paper, weight: 1.5, fillColor: race.color, fillOpacity: 1, interactive: false }).addTo(dots);
        L.circleMarker(point, { pane: "radius-points", radius: 5, color: MAP_COLORS.paper, weight: 2, fillColor: MAP_COLORS.ink, fillOpacity: 1, interactive: false }).addTo(dots);
        const key = `${lat}:${lng}:${radiusKm}`;
        if (key !== lastArea) {
          const bounds = area.getBounds();
          m.fitBounds([[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]], { padding: [24, 24], animate: Boolean(lastArea) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
          lastArea = key;
        }
        label();
      };
      sync.current();
      m.on("moveend", label);
      void loadCities().then((data) => { if (!disposed) { cities = data; label(); } }).catch(() => {});
      const observer = new ResizeObserver(() => m.invalidateSize({ pan: false }));
      observer.observe(container.current);
      cleanup = () => { observer.disconnect(); m.remove(); map.current = null; sync.current = () => {}; };
    }).catch(() => {});
    return () => { disposed = true; cleanup?.(); };
  }, []);
  useEffect(() => { sync.current(); }, [props.lat, props.lng, props.radiusKm, props.races, props.muted]);
  return <div className={cn("fast-map relative isolate overflow-hidden", props.className)} role="region" aria-label={props.label ?? "Race notification area"}><div ref={container} className="absolute inset-0" /></div>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, Minus, Plus } from "lucide-react";
import type { EventListItem } from "@/lib/events";
import type { MapBounds } from "@/components/map/race-map";
import { disciplineColor, disciplineIcon, DISCIPLINE_FAMILY_ICONS } from "@/lib/map-visuals";
import { loadLeaflet, type LeafletMap, type LeafletApi, type LayerGroup } from "./leaflet-runtime";

type City = [name: string, lat: number, lng: number, population: number, capital: boolean];
export type MapProps = {
  events: EventListItem[];
  selectedId: string | null;
  initialBounds: MapBounds;
  onSelect: (id: string) => void;
  onBounds: (bounds: MapBounds) => void;
};
const key = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();
const pin = (event: EventListItem, count: number, selected: boolean) => {
  const root = document.createElement("div");
  root.className = `fast-pin${selected ? " fast-pin-selected" : ""}`;
  root.style.setProperty("--pin-color", disciplineColor(event.disciplines));
  const disc = document.createElement("span");
  disc.className = "fast-pin-disc";
  const icon = DISCIPLINE_FAMILY_ICONS[disciplineIcon(event.disciplines)];
  if (icon) {
    const img = document.createElement("img");
    img.src = icon; img.alt = ""; img.width = 16; img.height = 16;
    disc.append(img);
  }
  root.append(disc);
  if (count > 1) {
    const badge = document.createElement("span");
    badge.className = "fast-pin-count"; badge.textContent = String(count);
    root.append(badge);
  }
  return root;
};

export function LightMap(props: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const redraw = useRef<() => void>(() => {});
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const controller = new AbortController();
    void loadLeaflet().then((L) => {
      if (disposed || !container.current) return;
      const map = L.map(container.current, {
        zoomControl: false, attributionControl: true, zoomSnap: 0.25,
        zoomDelta: 0.5, minZoom: 4, maxZoom: 18, maxBounds: [[30, -30], [73, 50]],
      });
      mapRef.current = map;
      map.attributionControl.setPrefix(false);
      const b = latest.current.initialBounds;
      map.fitBounds([[b.south, b.west], [b.north, b.east]], { animate: false, padding: [12, 12] });
      L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}${window.devicePixelRatio > 1 ? "@2x" : ""}.png${key ? `?key=${encodeURIComponent(key)}` : ""}`, {
        tileSize: 256, maxZoom: 20, keepBuffer: 2,
        attribution: '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>',
      }).addTo(map);
      map.createPane("city-labels").style.zIndex = "450";
      const labels = L.layerGroup().addTo(map);
      const markers = L.layerGroup().addTo(map);
      let cities: City[] = [];
      let expanded = "";

      const draw = () => {
        markers.clearLayers(); labels.clearLayers();
        const bounds = map.getBounds();
        const occupied: [number, number, number, number][] = [];
        const groups = new Map<string, EventListItem[]>();
        for (const e of latest.current.events) {
          if (e.location?.lat == null || e.location.lng == null) continue;
          const lat = Number(e.location.lat), lng = Number(e.location.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || !bounds.contains([lat, lng])) continue;
          const p = map.latLngToContainerPoint([lat, lng]);
          const bucket = `${Math.round(p.x / 34)}:${Math.round(p.y / 34)}`;
          groups.set(bucket, [...(groups.get(bucket) ?? []), e]);
        }
        for (const [bucket, events] of groups) {
          const chosen = events.find((e) => e.id === latest.current.selectedId) ?? events[0];
          const lat = Number(chosen.location!.lat), lng = Number(chosen.location!.lng);
          const p = map.latLngToContainerPoint([lat, lng]);
          occupied.push([p.x - 24, p.y - 24, p.x + 24, p.y + 24]);
          if (expanded === bucket && events.length > 1) {
            events.forEach((e, i) => {
              const angle = (i / events.length) * Math.PI * 2 - Math.PI / 2;
              const place = map.containerPointToLatLng([p.x + Math.cos(angle) * 48, p.y + Math.sin(angle) * 48]);
              addMarker(L, map, markers, e, [place.lat, place.lng], 1, latest.current.selectedId, () => latest.current.onSelect(e.id));
            });
          } else {
            addMarker(L, map, markers, chosen, [lat, lng], events.length, latest.current.selectedId, () => {
              if (events.length > 1) { expanded = bucket; draw(); }
              else latest.current.onSelect(chosen.id);
            });
          }
        }
        const zoom = map.getZoom();
        const threshold = zoom < 5.5 ? 600000 : zoom < 6.5 ? 180000 : zoom < 7.5 ? 70000 : zoom < 8.5 ? 30000 : 15000;
        let drawn = 0;
        const size = map.getSize();
        for (const [name, lat, lng, population, capital] of cities) {
          if (drawn >= 70 || (population < threshold && !capital) || !bounds.contains([lat, lng])) continue;
          const p = map.latLngToContainerPoint([lat, lng]);
          const width = Math.min(name.length * 6.2 + 15, 160);
          const rect: [number, number, number, number] = [p.x - width / 2 - 10, p.y - 12, p.x + width / 2 + 10, p.y + 12];
          if (rect[0] < 0 || rect[2] > size.x || rect[1] < 0 || rect[3] > size.y) continue;
          if (occupied.some((r) => rect[0] < r[2] && rect[2] > r[0] && rect[1] < r[3] && rect[3] > r[1])) continue;
          occupied.push(rect); drawn++;
          const text = document.createElement("span");
          text.className = `fast-city-label${capital || population >= 200000 ? " fast-city-major" : ""}`;
          text.textContent = name;
          L.marker([lat, lng], { pane: "city-labels", interactive: false, keyboard: false,
            icon: L.divIcon({ className: "fast-city", html: text, iconSize: [width, 20], iconAnchor: [width / 2, 10] }),
          }).addTo(labels);
        }
      };
      redraw.current = draw;
      const report = () => {
        const bounds = map.getBounds();
        latest.current.onBounds({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() });
      };
      const settled = () => { expanded = ""; draw(); report(); };
      const collapse = () => { if (expanded) { expanded = ""; draw(); } };
      map.on("moveend", settled).on("click", collapse);
      draw(); report();
      void fetch("/prototypes/fast-map/cities.json", { signal: controller.signal })
        .then((r) => { if (!r.ok) throw new Error("City labels unavailable"); return r.json(); })
        .then((data: City[]) => { if (!disposed) { cities = data; draw(); } })
        .catch((e: Error) => { if (e.name !== "AbortError") console.warn(e.message); });
      const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      observer.observe(container.current);
      cleanup = () => { observer.disconnect(); map.remove(); mapRef.current = null; };
    }).catch(() => { if (!disposed) setError("Mapu se nepodařilo načíst. Seznam závodů je stále k dispozici."); });
    return () => { disposed = true; controller.abort(); cleanup?.(); };
  }, []);

  useEffect(() => { redraw.current(); }, [props.events, props.selectedId]);
  useEffect(() => {
    const e = props.events.find((e) => e.id === props.selectedId);
    if (e?.location?.lat == null || e.location.lng == null) return;
    mapRef.current?.panInside([Number(e.location.lat), Number(e.location.lng)], {
      paddingTopLeft: [window.innerWidth >= 768 ? 350 : 24, 72], paddingBottomRight: [60, 220], animate: true,
    });
  }, [props.selectedId, props.events]);

  function locate() {
    navigator.geolocation?.getCurrentPosition((p) => {
      mapRef.current?.setView([p.coords.latitude, p.coords.longitude], 8, { animate: true });
      setError("");
    }, () => setError("Poloha není dostupná. Mapou můžete posouvat ručně."));
  }
  return <div className="fast-map absolute inset-0">
    <div ref={container} className="h-full w-full" aria-label="Mapa cyklistických závodů" />
    <div className="fast-map-controls">
      <button type="button" aria-label="Moje poloha" onClick={locate}><LocateFixed size={19} /></button>
      <div className="fast-map-zoom"><button type="button" aria-label="Přiblížit" onClick={() => mapRef.current?.zoomIn()}><Plus size={19} /></button><button type="button" aria-label="Oddálit" onClick={() => mapRef.current?.zoomOut()}><Minus size={19} /></button></div>
    </div>
    {error && <p className="absolute inset-x-4 top-16 z-[600] rounded-lg border bg-background px-4 py-3 text-sm" role="status">{error}</p>}
  </div>;
}

function addMarker(L: LeafletApi, map: LeafletMap, layer: LayerGroup, e: EventListItem, point: [number, number], count: number, selected: string | null, onClick: () => void) {
  const tooltip = document.createElement("div"); tooltip.textContent = count > 1 ? `${count} závodů · kliknutím rozbalíte` : e.name;
  const marker = L.marker(point, {
    title: count > 1 ? `${count} závodů · ${e.location?.municipality ?? ""}` : e.name,
    alt: e.name, keyboard: true, riseOnHover: true, zIndexOffset: e.id === selected ? 1000 : 0,
    icon: L.divIcon({ html: pin(e, count, e.id === selected), className: "fast-marker", iconSize: [40, 40], iconAnchor: [20, 20] }),
  }).addTo(layer).on("click", onClick).bindTooltip(tooltip, { direction: "top", offset: [0, -16], opacity: 1 });
  const el = marker.getElement();
  if (el) {
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", count > 1 ? `${count} závodů, rozbalit` : e.name);
    el.addEventListener("keydown", (event) => {
      if (event.key === " ") { event.preventDefault(); onClick(); }
    });
  }
  void map;
}

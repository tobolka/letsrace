"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, Minus, Plus, X } from "lucide-react";
import type { EventListItem } from "@/lib/events";
import type { MapBounds, BoundsChangeReason, RaceMapProps } from "./race-map";
import { EUROPE_CAMERA_BOUNDS, isInEuropeMap } from "@/lib/geo/europe";
import { disciplineColor, disciplineIcon, DISCIPLINE_FAMILY_ICONS } from "@/lib/map-visuals";
import { messagesFor } from "@/lib/i18n/messages";
import { loadLeaflet, type LeafletMap, type LeafletApi, type LayerGroup, type Marker, type Circle } from "./leaflet-runtime";
import { attachSmoothWheelZoom, type WheelMap } from "./smooth-wheel-zoom";
import { clusterAction } from "./cluster-action";
import { addLightBasemap, drawCityLabels, loadCities, type City } from "./light-basemap";
import "./light-race-map.css";

const defaultPadding = { top: 16, right: 56, bottom: 56, left: 48 };
const zoomLabels: Record<string, [string, string]> = {
  cs: ["Přiblížit", "Oddálit"], en: ["Zoom in", "Zoom out"],
  de: ["Vergrößern", "Verkleinern"], pl: ["Przybliż", "Oddal"], sk: ["Priblížiť", "Oddialiť"],
};
const errorLabels: Record<string, string> = {
  cs: "Mapu se nepodařilo načíst. Seznam závodů je stále k dispozici.",
  en: "The map could not load. The race list is still available.",
  de: "Die Karte konnte nicht geladen werden. Die Rennliste ist weiterhin verfügbar.",
  pl: "Nie udało się wczytać mapy. Lista wyścigów jest nadal dostępna.",
  sk: "Mapu sa nepodarilo načítať. Zoznam pretekov je stále k dispozícii.",
};
function pin(event: EventListItem, count: number, selected: boolean) {
  const root = document.createElement("div");
  root.className = `fast-pin${selected ? " fast-pin-selected" : ""}`;
  root.style.setProperty("--pin-color", disciplineColor(event.disciplines));
  const disc = document.createElement("span"); disc.className = "fast-pin-disc";
  const icon = DISCIPLINE_FAMILY_ICONS[disciplineIcon(event.disciplines)];
  if (icon) {
    const img = document.createElement("img"); img.src = icon; img.alt = ""; img.width = 16; img.height = 16;
    disc.append(img);
  }
  root.append(disc);
  if (count > 1) {
    const badge = document.createElement("span"); badge.className = "fast-pin-count"; badge.textContent = String(count); root.append(badge);
  }
  return root;
}
function cameraBounds(map: LeafletMap): MapBounds {
  const b = map.getBounds();
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
}
function paddingFor(props: RaceMapProps) {
  return { ...defaultPadding, ...props.padding };
}
function fitOptions(props: RaceMapProps, animate = true) {
  const p = paddingFor(props);
  return { paddingTopLeft: [p.left, p.top], paddingBottomRight: [p.right, p.bottom],
    animate: animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches, duration: 0.45 };
}
function fitBox(map: LeafletMap, b: MapBounds, props: RaceMapProps, animate = true, maxZoom = 11) {
  map.fitBounds([[b.south, b.west], [b.north, b.east]], { ...fitOptions(props, animate), maxZoom });
}
function focusPoint(map: LeafletMap, lat: number, lng: number, props: RaceMapProps, animate = false) {
  // Match the original camera: a 200 km radius, never less detailed than zoom 7.
  const dLat = 200 / 111, dLng = dLat / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const p = paddingFor(props);
  const zoom = Math.max(7, Math.min(9, map.getBoundsZoom([[lat - dLat, lng - dLng], [lat + dLat, lng + dLng]], false,
    [p.left + p.right, p.top + p.bottom])));
  const projected = map.project([lat, lng], zoom);
  const center = map.unproject([projected.x + (p.right - p.left) / 2, projected.y + (p.bottom - p.top) / 2], zoom);
  map.setView([center.lat, center.lng], zoom, fitOptions(props, animate));
}

export function LightRaceMap(props: RaceMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const redraw = useRef<() => void>(() => {});
  const highlight = useRef<() => void>(() => {});
  const radiusLayer = useRef<Circle | null>(null);
  const apiRef = useRef<LeafletApi | null>(null);
  const locateRef = useRef<() => void>(() => {});
  const reportRef = useRef<() => void>(() => {});
  const reason = useRef<BoundsChangeReason>("sync");
  const handled = useRef({ fit: 0, destination: 0, locate: 0, initialFocus: false });
  const userMoved = useRef(false);
  const selectionPan = useRef<{ id?: string | null; epoch: number; done: boolean }>({ epoch: 0, done: false });
  const [epoch, setEpoch] = useState(0);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  useEffect(() => {
    if (!locationError) return;
    const timeout = window.setTimeout(() => setLocationError(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [locationError]);
  const [locating, setLocating] = useState(false);
  const locale = props.locale ?? "en";
  const messages = messagesFor(locale);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void loadLeaflet().then((L) => {
      if (disposed || !container.current) return;
      const map = L.map(container.current, {
        zoomControl: false, attributionControl: true, zoomSnap: 0, zoomDelta: 0.5, scrollWheelZoom: false,
        minZoom: 4, maxZoom: 18, maxBounds: EUROPE_CAMERA_BOUNDS.map(([lng, lat]) => [lat, lng]),
      });
      mapRef.current = map; apiRef.current = L;
      map.attributionControl.setPrefix(false);
      const initial = latest.current;
      const focus = initial.initialFocus;
      if (initial.destination && initial.destinationSeq) {
        fitBox(map, initial.destination, initial, false);
        handled.current.destination = initial.destinationSeq;
        handled.current.initialFocus = true;
      } else {
        const [lng, lat] = initial.fallbackCenter ?? [15.5, 49.75];
        focusPoint(map, focus?.lat ?? lat, focus?.lng ?? lng, initial);
        handled.current.initialFocus = Boolean(focus);
      }
      addLightBasemap(L, map);
      map.createPane("city-labels").style.zIndex = "450";
      const labels = L.layerGroup().addTo(map), markers = L.layerGroup().addTo(map);
      let cities: City[] = [], expanded = "";
      let userMarker: Marker | undefined;
      let watchId: number | undefined;
      let gpsCentered = false;
      let rendered: { marker: Marker; ids: string[]; active: boolean }[] = [];
      const applyHighlight = () => {
        const id = latest.current.hoveredId;
        for (const item of rendered) {
          const active = Boolean(id && item.ids.includes(id));
          if (active === item.active) continue;
          item.active = active;
          item.marker.getElement()?.classList.toggle("fast-marker-highlighted", active);
          item.marker.setZIndexOffset(active ? 2000 : item.ids.includes(latest.current.selectedId ?? "") ? 1000 : 0);
        }
      };
      highlight.current = applyHighlight;
      const draw = () => {
        markers.clearLayers(); labels.clearLayers(); rendered = [];
        const bounds = map.getBounds();
        const occupied: [number, number, number, number][] = [];
        // Group by actual distance, including across cell boundaries, so touch targets never overlap.
        const groups: { x: number; y: number; events: EventListItem[]; point: [number, number] }[] = [];
        for (const e of latest.current.events) {
          if (e.location?.lat == null || e.location.lng == null) continue;
          const lat = Number(e.location.lat), lng = Number(e.location.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || !bounds.contains([lat, lng])) continue;
          const p = map.latLngToContainerPoint([lat, lng]);
          const group = groups.find((g) => Math.abs(g.x - p.x) < 48 && Math.abs(g.y - p.y) < 48);
          if (group) group.events.push(e);
          else groups.push({ x: p.x, y: p.y, events: [e], point: [lat, lng] });
        }
        for (const { events, point, x, y } of groups) {
          const bucket = events.map((e) => e.id).join(":");
          const chosen = events.find((e) => e.id === latest.current.selectedId) ?? events[0];
          occupied.push([x - 26, y - 26, x + 26, y + 26]);
          if (expanded === bucket && events.length > 1) {
            const radius = Math.max(56, events.length * 48 / (2 * Math.PI));
            events.forEach((e, i) => {
              const angle = i / events.length * Math.PI * 2 - Math.PI / 2;
              const p = map.containerPointToLatLng([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
              const marker = addMarker(L, markers, e, [p.lat, p.lng], 1, latest.current, () => latest.current.onSelect(e.id));
              rendered.push({ marker, ids: [e.id], active: false });
            });
          } else {
            const marker = addMarker(L, markers, chosen, point, events.length, latest.current, () => {
              if (events.length > 1) {
                const action = clusterAction(events.map((e) => ({ lat: Number(e.location!.lat), lng: Number(e.location!.lng) })), map.getZoom());
                if (action.type === "expand") { expanded = bucket; draw(); }
                else {
                  userMoved.current = true; reason.current = "user";
                  fitBox(map, action.bounds, latest.current, true, action.maxZoom);
                }
              } else latest.current.onSelect(chosen.id);
            });
            rendered.push({ marker, ids: events.map((e) => e.id), active: false });
          }
        }
        applyHighlight();
        drawCityLabels(L, map, labels, cities, occupied);
      };
      redraw.current = draw;
      let lastReport = "";
      const report = () => {
        const size = map.getSize();
        if (size.x <= 0 || size.y <= 0) return;
        const camera = cameraBounds(map), p = paddingFor(latest.current);
        let visible = camera;
        if (size.x - p.left - p.right >= 160 && size.y - p.top - p.bottom >= 160) {
          const sw = map.containerPointToLatLng([p.left, size.y - p.bottom]), ne = map.containerPointToLatLng([size.x - p.right, p.top]);
          visible = { west: sw.lng, south: sw.lat, east: ne.lng, north: ne.lat };
        }
        const signature = [reason.current, ...Object.values(visible).map((n) => n.toFixed(5)), ...Object.values(camera).map((n) => n.toFixed(5))].join(":");
        const why = reason.current; reason.current = "sync";
        if (signature === lastReport) return;
        lastReport = signature;
        latest.current.onBoundsChange(visible, why, camera);
      };
      reportRef.current = report;
      const settled = () => { expanded = ""; draw(); report(); };
      const gesture = () => { userMoved.current = true; reason.current = "user"; };
      map.on("moveend", settled).on("click", () => { expanded = ""; draw(); latest.current.onBackgroundClick?.(); }).on("dragstart", gesture);
      const el = container.current;
      el.addEventListener("wheel", gesture, { passive: true });
      const detachWheel = attachSmoothWheelZoom(map as WheelMap, el);
      el.addEventListener("keydown", gesture);
      const applyLocation = (pos: GeolocationPosition, explicit: boolean) => {
        if (disposed) return;
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        if (!isInEuropeMap(lat, lng)) return;
        setLocationError("");
        userMarker?.remove();
        const dot = document.createElement("div"); dot.className = "fast-user-location";
        userMarker = L.marker([lat, lng], { interactive: false, keyboard: false,
          icon: L.divIcon({ html: dot, className: "", iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map);
        latest.current.onUserLocation?.({ lat, lng });
        if (explicit || (!gpsCentered && !userMoved.current && !latest.current.skipInitialLocate && !handled.current.initialFocus)) {
          gpsCentered = true; reason.current = explicit ? "locate" : "gps";
          focusPoint(map, lat, lng, latest.current, explicit); report();
        }
      };
      locateRef.current = () => {
        if (!navigator.geolocation) { setLocationError(latest.current.locationDeniedLabel ?? messagesFor(latest.current.locale ?? "en").locationDenied); return; }
        setLocating(true); setLocationError("");
        navigator.geolocation.getCurrentPosition((pos) => applyLocation(pos, true), () => {
          if (disposed) return;
          setLocating(false); setLocationError(latest.current.locationDeniedLabel ?? messagesFor(latest.current.locale ?? "en").locationDenied);
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
      };
      // Restore an already granted location without prompting first-time visitors.
      if (navigator.permissions && navigator.geolocation) {
        void navigator.permissions.query({ name: "geolocation" }).then((status) => {
          if (!disposed && status.state === "granted") {
            watchId = navigator.geolocation.watchPosition((pos) => applyLocation(pos, false), () => {}, { enableHighAccuracy: false, maximumAge: 60000 });
          }
        }).catch(() => {});
      }
      draw(); report(); setEpoch((n) => n + 1);
      void loadCities().then((data) => { if (!disposed) { cities = data; draw(); } }).catch(() => {});
      const observer = new ResizeObserver(([entry]) => {
        // A sheet or responsive transition can temporarily hide the container.
        // Preserve the camera rather than publishing a zero-area URL/fetch.
        if (!entry || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return;
        map.invalidateSize({ pan: false }); report();
      });
      observer.observe(el);
      cleanup = () => {
        detachWheel(); observer.disconnect(); el.removeEventListener("wheel", gesture); el.removeEventListener("keydown", gesture);
        if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
        map.remove(); mapRef.current = null; radiusLayer.current = null; apiRef.current = null; highlight.current = () => {}; redraw.current = () => {}; reportRef.current = () => {}; locateRef.current = () => {};
      };
    }).catch(() => { if (!disposed) setError(errorLabels[latest.current.locale ?? "en"] ?? errorLabels.en); });
    return () => { disposed = true; cleanup?.(); };
  }, []);

  useEffect(() => { redraw.current(); }, [props.events, props.selectedId]);
  useEffect(() => { highlight.current(); }, [props.hoveredId]);
  useEffect(() => {
    const map = mapRef.current, L = apiRef.current, area = props.radiusArea;
    if (!map || !L) return;
    if (!area) { radiusLayer.current?.remove(); radiusLayer.current = null; return; }
    if (!radiusLayer.current) {
      radiusLayer.current = L.circle([area.lat, area.lng], { radius: area.km * 1000, color: "#c81d25", weight: 1.5, dashArray: "5 5", fillColor: "#c81d25", fillOpacity: 0.05, interactive: false }).addTo(map);
    } else radiusLayer.current.setLatLng([area.lat, area.lng]).setRadius(area.km * 1000);
  }, [props.radiusArea, epoch]);
  useEffect(() => {
    const map = mapRef.current, e = props.events.find((e) => e.id === props.selectedId);
    if (selectionPan.current.id !== props.selectedId || selectionPan.current.epoch !== epoch) {
      selectionPan.current = { id: props.selectedId, epoch, done: false };
    }
    // Fetching a new viewport must not pull the camera back to an old selection.
    if (!map || selectionPan.current.done || e?.location?.lat == null || e.location.lng == null) return;
    selectionPan.current.done = true;
    map.panInside([Number(e.location.lat), Number(e.location.lng)], fitOptions(latest.current));
  }, [props.selectedId, props.events, epoch]);
  useEffect(() => { reportRef.current(); }, [props.padding]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.initialFocus || handled.current.initialFocus) return;
    handled.current.initialFocus = true; reason.current = "gps";
    focusPoint(map, props.initialFocus.lat, props.initialFocus.lng, latest.current); reportRef.current();
  }, [props.initialFocus, epoch]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.fitSeq || props.fitSeq === handled.current.fit) return;
    const coords = props.events.flatMap((e) => e.location?.lat != null && e.location.lng != null && Number.isFinite(Number(e.location.lat)) && Number.isFinite(Number(e.location.lng)) ? [[Number(e.location.lat), Number(e.location.lng)]] : []);
    if (!coords.length) return;
    handled.current.fit = props.fitSeq;
    const lats = coords.map((c) => c[0]), lngs = coords.map((c) => c[1]);
    fitBox(map, { west: Math.min(...lngs), east: Math.max(...lngs), south: Math.min(...lats), north: Math.max(...lats) }, latest.current, true, coords.length === 1 ? 9 : 8);
  }, [props.fitSeq, props.events, epoch]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.destination || !props.destinationSeq || props.destinationSeq === handled.current.destination) return;
    handled.current.destination = props.destinationSeq; handled.current.initialFocus = true; userMoved.current = true;
    fitBox(map, props.destination, latest.current);
  }, [props.destination, props.destinationSeq, epoch]);
  useEffect(() => {
    if (!epoch || !props.locateSeq || props.locateSeq === handled.current.locate) return;
    handled.current.locate = props.locateSeq; locateRef.current();
  }, [props.locateSeq, epoch]);
  const zoom = zoomLabels[locale] ?? zoomLabels.en;
  return <div className="fast-map light-race-map">
    <div ref={container} className="absolute inset-0 h-full w-full" />
    <div className="fast-map-controls">
      <button type="button" aria-label={props.myLocationLabel ?? messages.myLocation} disabled={locating} aria-busy={locating} onClick={() => locateRef.current()}><LocateFixed size={19} /></button>
      <div className="fast-map-zoom"><button type="button" aria-label={zoom[0]} onClick={() => { reason.current = "user"; userMoved.current = true; mapRef.current?.zoomIn(); }}><Plus size={19} /></button><button type="button" aria-label={zoom[1]} onClick={() => { reason.current = "user"; userMoved.current = true; mapRef.current?.zoomOut(); }}><Minus size={19} /></button></div>
    </div>
    {(error || locationError) && <div className="absolute left-3 top-16 z-[600] flex max-w-[calc(100%_-_1.5rem)] md:max-w-sm items-start gap-3 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm" role="status">
      <span>{error || locationError}</span>
      <button type="button" aria-label={messages.close} className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-md hover:bg-muted" onClick={() => { setError(""); setLocationError(""); }}><X size={16} /></button>
    </div>}
  </div>;
}
function addMarker(L: LeafletApi, layer: LayerGroup, e: EventListItem, point: [number, number], count: number, props: RaceMapProps, onClick: () => void) {
  const messages = messagesFor(props.locale ?? "en");
  const label = count > 1 ? `${count} ${messages.racesCount} · ${e.location?.municipality ?? e.name}` : e.name;
  const tooltip = document.createElement("div"); tooltip.textContent = label;
  const marker = L.marker(point, { title: label, alt: label, keyboard: true, riseOnHover: true, bubblingMouseEvents: false,
    zIndexOffset: e.id === props.selectedId ? 1000 : 0,
    icon: L.divIcon({ html: pin(e, count, e.id === props.selectedId), className: "fast-marker", iconSize: [40, 40], iconAnchor: [20, 20] }),
  }).addTo(layer).on("click", onClick).bindTooltip(tooltip, { direction: "top", offset: [0, -16], opacity: 1 });
  const el = marker.getElement();
  if (el) {
    el.setAttribute("role", "button"); el.setAttribute("aria-label", label);
    if (count > 1) el.setAttribute("aria-expanded", "false");
    el.addEventListener("keydown", (event) => { if (event.key === " ") { event.preventDefault(); onClick(); } });
  }
  return marker;
}

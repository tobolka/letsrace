"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  LngLatBounds,
  type Map,
  type StyleSpecification,
  type PaddingOptions,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { format, parseISO } from "date-fns";
import type { EventListItem } from "@/lib/events";
import { EUROPE_CAMERA_BOUNDS, isInEuropeMap } from "@/lib/geo/europe";
import { disciplineColor } from "@/lib/map-visuals";
import { DISCIPLINE_LABELS, type Discipline } from "@/lib/taxonomy";

export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type Props = {
  events: EventListItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onBoundsChange: (b: MapBounds) => void;
  searchThisAreaLabel: string;
  showSearchArea: boolean;
  onSearchArea: (b: MapBounds) => void;
  myLocationLabel?: string;
  locationDeniedLabel?: string;
  /** Keep markers clear of side panels / bottom sheet */
  padding?: PaddingOptions;
  /** Increment to fit the camera to current `events`. */
  fitSeq?: number;
  /** Fly to this bbox (place / vacation search). */
  destination?: MapBounds | null;
  /** Increment to apply `destination`. */
  destinationSeq?: number;
  /** Cold-start camera until GPS (locale market). */
  fallbackCenter?: [number, number];
  /** Open on this point instead of GPS (shared race deep-link). */
  initialFocus?: { lng: number; lat: number } | null;
  /** Don't steal the camera with geolocation (used with `initialFocus`). */
  skipInitialLocate?: boolean;
};

const RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap © CARTO",
      maxzoom: 20,
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

let lastPinTipAt = 0;

function pinTipContent(event: EventListItem) {
  const root = document.createElement("div");
  const name = document.createElement("p");
  name.textContent = event.name;
  name.style.cssText =
    "margin:0;font-size:13px;font-weight:600;line-height:1.3;color:#1c1917;letter-spacing:-0.01em";

  const meta = document.createElement("p");
  const date = format(parseISO(event.startDate), "d MMM yyyy");
  const discs = event.disciplines
    .map((d) => DISCIPLINE_LABELS[d as Discipline] || d)
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
  meta.textContent = discs ? `${date} · ${discs}` : date;
  meta.style.cssText =
    "margin:3px 0 0;font-size:11px;line-height:1.35;color:#78716c;font-variant-numeric:tabular-nums";

  root.append(name, meta);
  return root;
}

function makePinElement(event: EventListItem, selected: boolean) {
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.className = "startline-map-pin";
  wrap.setAttribute("aria-label", event.name);
  wrap.dataset.eventId = event.id;
  wrap.dataset.level = event.level || "local";
  wrap.dataset.discipline = event.disciplines?.[0] || "other";

  wrap.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "width:32px",
    "height:32px",
    "padding:0",
    "margin:0",
    "border:0",
    "background:transparent",
    "cursor:pointer",
    "appearance:none",
    "-webkit-appearance:none",
    "touch-action:manipulation",
  ].join(";");

  const dot = document.createElement("span");
  const size = selected ? 20 : 16;
  const color = disciplineColor(event.disciplines);
  dot.setAttribute("aria-hidden", "true");
  dot.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    "border-radius:9999px",
    `background:${color}`,
    "border:2px solid #fff",
    "box-shadow:0 1px 3px rgba(0,0,0,.32)",
    selected ? "transform:scale(1.25)" : "",
    "transition:transform 120ms ease",
    "pointer-events:none",
    "flex:0 0 auto",
  ].join(";");
  wrap.appendChild(dot);

  return wrap;
}

function makeUserLocationElement() {
  const wrap = document.createElement("div");
  wrap.className = "startline-user-location";
  wrap.setAttribute("aria-label", "Your location");
  wrap.style.cssText = [
    "width:18px",
    "height:18px",
    "pointer-events:none",
    "z-index:5",
  ].join(";");

  const pulse = document.createElement("span");
  pulse.style.cssText = [
    "position:absolute",
    "inset:-14px",
    "border-radius:9999px",
    "background:rgba(26,115,232,.25)",
    "animation:startline-loc-pulse 2.2s ease-out infinite",
  ].join(";");

  const ring = document.createElement("span");
  ring.style.cssText = [
    "position:absolute",
    "inset:-4px",
    "border-radius:9999px",
    "border:2px solid rgba(26,115,232,.45)",
    "background:transparent",
  ].join(";");

  const dot = document.createElement("span");
  dot.style.cssText = [
    "position:absolute",
    "inset:0",
    "border-radius:9999px",
    "background:#1a73e8",
    "border:2.5px solid #fff",
    "box-shadow:0 1px 8px rgba(0,0,0,.4)",
  ].join(";");

  wrap.appendChild(pulse);
  wrap.appendChild(ring);
  wrap.appendChild(dot);
  return wrap;
}

function upsertUserMarker(
  map: Map,
  markerRef: { current: Marker | null },
  pos: { lng: number; lat: number },
) {
  if (!markerRef.current) {
    markerRef.current = new Marker({
      element: makeUserLocationElement(),
      anchor: "center",
      className: "startline-user-marker",
    })
      .setLngLat([pos.lng, pos.lat])
      .addTo(map);
  } else {
    markerRef.current.setLngLat([pos.lng, pos.lat]).addTo(map);
  }
  // Keep the blue dot above race pins
  const el = markerRef.current.getElement();
  el.style.zIndex = "5";
}

const GEO_OPTS_FAST: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 60_000,
  timeout: 12_000,
};
const GEO_OPTS_PRECISE: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 10_000,
  timeout: 20_000,
};

const DEFAULT_PADDING: PaddingOptions = { top: 72, bottom: 56, left: 56, right: 56 };
/** Default map view: user location with ~200 km radius. */
const DEFAULT_RADIUS_KM = 200;
const CZECHIA_CENTER: [number, number] = [15.5, 49.75];

function boundsAround(lng: number, lat: number, radiusKm: number): LngLatBounds {
  const dLat = radiusKm / 111;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = radiusKm / (111 * Math.max(cos, 0.2));
  return new LngLatBounds([lng - dLng, lat - dLat], [lng + dLng, lat + dLat]);
}

function fitRadius(
  map: Map,
  lng: number,
  lat: number,
  radiusKm: number,
  padding: PaddingOptions,
  duration = 0,
) {
  map.fitBounds(boundsAround(lng, lat, radiusKm), {
    padding,
    duration,
    maxZoom: 9,
  });
}

function visibleBounds(map: Map, padding: PaddingOptions): MapBounds {
  const canvas = map.getCanvas();
  const left = typeof padding.left === "number" ? padding.left : 0;
  const right = typeof padding.right === "number" ? padding.right : 0;
  const top = typeof padding.top === "number" ? padding.top : 0;
  const bottom = typeof padding.bottom === "number" ? padding.bottom : 0;
  const sw = map.unproject([left, canvas.height - bottom]);
  const ne = map.unproject([canvas.width - right, top]);
  return {
    west: Math.min(sw.lng, ne.lng),
    south: Math.min(sw.lat, ne.lat),
    east: Math.max(sw.lng, ne.lng),
    north: Math.max(sw.lat, ne.lat),
  };
}

export function RaceMap({
  events,
  selectedId,
  onSelect,
  onBoundsChange,
  searchThisAreaLabel,
  showSearchArea,
  onSearchArea,
  myLocationLabel = "My location",
  locationDeniedLabel = "Location permission denied",
  padding = DEFAULT_PADDING,
  fitSeq = 0,
  destination = null,
  destinationSeq = 0,
  fallbackCenter = CZECHIA_CENTER,
  initialFocus = null,
  skipInitialLocate = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);
  const hoverPopupRef = useRef<Popup | null>(null);
  const hoverTimerRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const locateBtnRef = useRef<HTMLButtonElement | null>(null);
  const initialViewDoneRef = useRef(false);
  const userMovedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const paddingRef = useRef(padding);
  const initialFocusRef = useRef(initialFocus);
  const skipInitialLocateRef = useRef(skipInitialLocate);
  const fallbackCenterRef = useRef(fallbackCenter);
  const fitSeqRef = useRef(0);
  const destSeqRef = useRef(0);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [userPos, setUserPos] = useState<{ lng: number; lat: number; accuracy?: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  onSelectRef.current = onSelect;
  onBoundsChangeRef.current = onBoundsChange;
  paddingRef.current = padding;
  initialFocusRef.current = initialFocus;
  skipInitialLocateRef.current = skipInitialLocate;
  fallbackCenterRef.current = fallbackCenter;

  const goToMyLocationRef = useRef<() => void>(() => {});

  function emitBounds(map: Map) {
    onBoundsChangeRef.current(visibleBounds(map, paddingRef.current));
  }

  function applyInitialView(map: Map, lng: number, lat: number, duration = 0) {
    if (skipInitialLocateRef.current) return;
    if (initialViewDoneRef.current || userMovedRef.current) return;
    fitRadius(map, lng, lat, DEFAULT_RADIUS_KM, paddingRef.current, duration);
    initialViewDoneRef.current = true;
    // Let the camera settle, then sync list filters to this area
    window.setTimeout(() => emitBounds(map), duration + 50);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.getElementById("startline-loc-pulse-style")) {
      const style = document.createElement("style");
      style.id = "startline-loc-pulse-style";
      style.textContent = `
        @keyframes startline-loc-pulse {
          0% { transform: scale(0.55); opacity: 0.85; }
          70% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .startline-user-location span:first-child { animation: none !important; opacity: 0.35; }
        }
        .maplibregl-ctrl-bottom-right {
          display: flex;
          flex-direction: column-reverse;
          align-items: flex-end;
          gap: 8px;
          margin: 0 10px 10px 0 !important;
        }
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl {
          margin: 0 !important;
        }
        .maplibregl-marker.startline-user-marker {
          z-index: 5 !important;
          overflow: visible !important;
        }
        .maplibregl-marker:has(.startline-map-pin:hover) {
          z-index: 20 !important;
        }
        .startline-pin-tip {
          pointer-events: none;
          z-index: 30 !important;
        }
        .startline-pin-tip .maplibregl-popup-content {
          padding: 8px 10px;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(28,25,23,.06), 0 10px 24px rgba(28,25,23,.14);
          border: 1px solid rgba(28,25,23,.08);
          overflow: visible;
          font-family: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
        }
        .startline-pin-tip.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
          border-top-color: #fff;
          margin-top: -1px;
          z-index: 2;
          filter: drop-shadow(0 1px 0 rgba(28,25,23,.08));
        }
        .startline-pin-tip.maplibregl-popup-anchor-top .maplibregl-popup-tip {
          border-bottom-color: #fff;
          margin-bottom: -1px;
          z-index: 2;
          filter: drop-shadow(0 -1px 0 rgba(28,25,23,.08));
        }
        @media (prefers-reduced-motion: reduce) {
          .startline-map-pin span { transition: none !important; }
        }
      `;
      document.head.appendChild(style);
    }

    const map = new MapLibreMap({
      container: el,
      style: RASTER_STYLE,
      center: fallbackCenterRef.current,
      zoom: 7,
      maxBounds: EUROPE_CAMERA_BOUNDS,
      renderWorldCopies: false,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    initialViewDoneRef.current = false;
    (window as unknown as { __startlineMap?: Map }).__startlineMap = map;

    // Zoom + locate stacked in the same MapLibre corner (no overlap)
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    const locateCtrl = {
      onAdd() {
        const container = document.createElement("div");
        container.className = "maplibregl-ctrl maplibregl-ctrl-group";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "startline-locate-ctrl";
        btn.setAttribute("aria-label", myLocationLabel);
        btn.title = myLocationLabel;
        btn.style.cssText =
          "display:flex;align-items:center;justify-content:center;width:29px;height:29px;cursor:pointer;background:#fff;border:0;padding:0;";
        btn.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
        locateBtnRef.current = btn;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          goToMyLocationRef.current();
        });
        container.appendChild(btn);
        return container;
      },
      onRemove() {
        locateBtnRef.current = null;
      },
    };
    map.addControl(locateCtrl, "bottom-right");
    setMapEpoch((n) => n + 1);

    // Fallback view: locale market ~200 km until GPS arrives (or a shared race focus)
    map.once("load", () => {
      const focus = initialFocusRef.current;
      const home = fallbackCenterRef.current;
      if (focus) {
        fitRadius(map, focus.lng, focus.lat, DEFAULT_RADIUS_KM, paddingRef.current, 0);
        initialViewDoneRef.current = true;
        window.setTimeout(() => emitBounds(map), 80);
        return;
      }
      if (skipInitialLocateRef.current) {
        fitRadius(map, home[0], home[1], DEFAULT_RADIUS_KM, paddingRef.current, 0);
        return;
      }
      if (!initialViewDoneRef.current) {
        fitRadius(map, home[0], home[1], DEFAULT_RADIUS_KM, paddingRef.current, 0);
        // Don't lock initialViewDone yet — GPS can still refine once
        window.setTimeout(() => emitBounds(map), 80);
      }
    });

    map.on("dragstart", () => {
      userMovedRef.current = true;
    });
    map.on("zoomstart", (e) => {
      if (e.originalEvent) userMovedRef.current = true;
    });
    map.on("moveend", () => {
      if (!userMovedRef.current) return;
      emitBounds(map);
    });

    const resize = () => map.resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const t1 = window.setTimeout(resize, 50);
    const t2 = window.setTimeout(resize, 400);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      window.clearTimeout(hoverTimerRef.current);
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapEpoch === 0) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    window.clearTimeout(hoverTimerRef.current);
    hoverPopupRef.current?.remove();

    if (!hoverPopupRef.current) {
      hoverPopupRef.current = new Popup({
        closeButton: false,
        closeOnClick: false,
        closeOnMove: false,
        offset: 18,
        className: "startline-pin-tip",
        maxWidth: "260px",
        anchor: "bottom",
      });
    }
    const popup = hoverPopupRef.current;

    const withCoords = events.filter(
      (e) =>
        e.location?.lat != null &&
        e.location?.lng != null &&
        Number.isFinite(Number(e.location.lat)) &&
        Number.isFinite(Number(e.location.lng)),
    );

    for (const event of withCoords) {
      const selected = event.id === selectedId;
      const pin = makePinElement(event, selected);
      const lngLat: [number, number] = [Number(event.location!.lng), Number(event.location!.lat)];

      pin.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        window.clearTimeout(hoverTimerRef.current);
        popup.remove();
        onSelectRef.current(event.id);
      });
      pin.addEventListener("mouseenter", () => {
        window.clearTimeout(hoverTimerRef.current);
        const delay = Date.now() - lastPinTipAt < 500 ? 0 : 280;
        hoverTimerRef.current = window.setTimeout(() => {
          popup.setLngLat(lngLat).setDOMContent(pinTipContent(event)).addTo(map);
          lastPinTipAt = Date.now();
        }, delay);
      });
      pin.addEventListener("mouseleave", () => {
        window.clearTimeout(hoverTimerRef.current);
        popup.remove();
      });

      markersRef.current.push(
        new Marker({ element: pin, anchor: "center" }).setLngLat(lngLat).addTo(map),
      );
    }

    (window as unknown as { __startlineMarkerCount?: number }).__startlineMarkerCount =
      markersRef.current.length;

    if (userPos) {
      upsertUserMarker(map, userMarkerRef, userPos);
    }

    requestAnimationFrame(() => map.resize());
  }, [events, selectedId, mapEpoch, userPos]);

  const prevSelectedIdRef = useRef(selectedId);
  useEffect(() => {
    const map = mapRef.current;
    const selectedChanged = selectedId !== prevSelectedIdRef.current;
    prevSelectedIdRef.current = selectedId;
    if (!map || !selectedId || !selectedChanged) return;
    const ev = events.find((e) => e.id === selectedId);
    if (ev?.location?.lat == null || ev.location.lng == null) return;
    map.easeTo({
      center: [Number(ev.location.lng), Number(ev.location.lat)],
      zoom: Math.max(map.getZoom(), 9),
      padding,
      duration: 550,
    });
  }, [selectedId, events, padding]);

  // Shared-race deep link: focus arrived after map load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapEpoch === 0 || !initialFocus) return;
    if (initialViewDoneRef.current) return;
    fitRadius(map, initialFocus.lng, initialFocus.lat, DEFAULT_RADIUS_KM, paddingRef.current, 0);
    initialViewDoneRef.current = true;
    window.setTimeout(() => emitBounds(map), 80);
  }, [initialFocus, mapEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapEpoch === 0 || !fitSeq || fitSeq === fitSeqRef.current) return;
    fitSeqRef.current = fitSeq;
    const coords = events.filter(
      (e) =>
        e.location?.lat != null &&
        e.location?.lng != null &&
        Number.isFinite(Number(e.location.lat)) &&
        Number.isFinite(Number(e.location.lng)),
    );
    if (coords.length === 0) return;
    const b = new LngLatBounds();
    for (const e of coords) {
      b.extend([Number(e.location!.lng), Number(e.location!.lat)]);
    }
    map.fitBounds(b, {
      padding: paddingRef.current,
      maxZoom: coords.length === 1 ? 9 : 8,
      duration: 600,
    });
  }, [fitSeq, events, mapEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapEpoch === 0 || !destinationSeq || destinationSeq === destSeqRef.current) return;
    if (!destination) return;
    destSeqRef.current = destinationSeq;
    userMovedRef.current = true;
    initialViewDoneRef.current = true;
    const b = new LngLatBounds(
      [destination.west, destination.south],
      [destination.east, destination.north],
    );
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(b, {
      padding: paddingRef.current,
      maxZoom: 11,
      duration: reduce ? 0 : 700,
    });
  }, [destination, destinationSeq, mapEpoch]);

  // Keep user location marker in sync + initial camera on first GPS fix
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapEpoch === 0 || !userPos) return;

    upsertUserMarker(map, userMarkerRef, userPos);
    applyInitialView(map, userPos.lng, userPos.lat, 650);

    const btn = locateBtnRef.current;
    if (btn) btn.style.color = "#1a73e8";
  }, [userPos, mapEpoch]);

  // Resolve location: fast network position first, then optional precise watch
  useEffect(() => {
    if (mapEpoch === 0 || !navigator.geolocation) return;

    let cancelled = false;
    let watchId: number | null = null;

    const onFix = (pos: GeolocationPosition) => {
      if (cancelled) return;
      const lng = pos.coords.longitude;
      const lat = pos.coords.latitude;
      if (!isInEuropeMap(lat, lng)) {
        setLocating(false);
        return;
      }
      setUserPos({
        lng,
        lat,
        accuracy: pos.coords.accuracy,
      });
      setLocError(null);
      setLocating(false);
    };

    const onFail = (err: GeolocationPositionError) => {
      if (cancelled) return;
      setLocating(false);
      if (!initialViewDoneRef.current) {
        initialViewDoneRef.current = true;
      }
      // Only surface hard denials — timeouts stay on the locale fallback quietly
      if (err.code === err.PERMISSION_DENIED) {
        setLocError(locationDeniedLabel);
      }
    };

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onFix(pos);
        // Keep updating in the background (wifi/cell is enough)
        watchId = navigator.geolocation.watchPosition(onFix, () => undefined, GEO_OPTS_FAST);
        watchIdRef.current = watchId;
      },
      (err) => {
        // Retry once with high accuracy (phones)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            onFix(pos);
            watchId = navigator.geolocation.watchPosition(onFix, () => undefined, GEO_OPTS_PRECISE);
            watchIdRef.current = watchId;
          },
          onFail,
          GEO_OPTS_PRECISE,
        );
        if (err.code === err.PERMISSION_DENIED) onFail(err);
      },
      GEO_OPTS_FAST,
    );

    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [mapEpoch, locationDeniedLabel]);

  function goToMyLocation() {
    if (!navigator.geolocation) {
      setLocError(locationDeniedLabel);
      return;
    }
    setLocating(true);
    setLocError(null);

    const apply = (pos: GeolocationPosition) => {
      const lng = pos.coords.longitude;
      const lat = pos.coords.latitude;
      setLocating(false);
      if (!isInEuropeMap(lat, lng)) return;
      setUserPos({ lng, lat, accuracy: pos.coords.accuracy });
      const map = mapRef.current;
      if (!map) return;
      userMovedRef.current = true;
      upsertUserMarker(map, userMarkerRef, { lng, lat });
      fitRadius(map, lng, lat, DEFAULT_RADIUS_KM, paddingRef.current, 700);
      window.setTimeout(() => emitBounds(map), 750);
    };

    navigator.geolocation.getCurrentPosition(
      apply,
      () => {
        navigator.geolocation.getCurrentPosition(
          apply,
          () => {
            setLocating(false);
            setLocError(locationDeniedLabel);
          },
          GEO_OPTS_PRECISE,
        );
      },
      GEO_OPTS_FAST,
    );
  }

  goToMyLocationRef.current = goToMyLocation;

  useEffect(() => {
    const btn = locateBtnRef.current;
    if (!btn) return;
    btn.style.opacity = locating ? "0.55" : "1";
    btn.style.color = userPos ? "#0284c7" : "#334155";
    btn.disabled = locating;
  }, [locating, userPos, mapEpoch]);

  const leftPad = typeof padding.left === "number" ? padding.left : 56;

  return (
    <div className="relative h-full w-full bg-stone-200">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {showSearchArea && (
        <button
          type="button"
          onClick={() => {
            const map = mapRef.current;
            if (!map) return;
            onSearchArea(visibleBounds(map, paddingRef.current));
          }}
          className="absolute top-16 z-10 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-md ring-1 ring-stone-200 hover:bg-stone-50 md:top-4"
          style={{ left: `calc(${leftPad}px + (100% - ${leftPad}px) / 2)` }}
        >
          {searchThisAreaLabel}
        </button>
      )}

      {locError ? (
        <p
          className="absolute bottom-24 right-2.5 z-10 max-w-[11rem] rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] text-stone-600 shadow ring-1 ring-stone-200 md:bottom-20"
          role="status"
          aria-live="polite"
        >
          {locError}
        </p>
      ) : null}
    </div>
  );
}

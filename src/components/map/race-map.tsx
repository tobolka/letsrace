"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  LngLatBounds,
  type Map,
  type StyleSpecification,
  type PaddingOptions,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EventListItem } from "@/lib/events";
import { levelColor } from "@/lib/map-visuals";

type Props = {
  events: EventListItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onBoundsChange: (b: {
    west: number;
    south: number;
    east: number;
    north: number;
  }) => void;
  searchThisAreaLabel: string;
  showSearchArea: boolean;
  onSearchArea: () => void;
  myLocationLabel?: string;
  locationDeniedLabel?: string;
  /** Keep markers clear of side panels / bottom sheet */
  padding?: PaddingOptions;
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

function makePinElement(event: EventListItem, selected: boolean) {
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.className = "startline-map-pin";
  wrap.setAttribute("aria-label", event.name);
  wrap.dataset.eventId = event.id;
  wrap.dataset.level = event.level || "local";

  const size = selected ? 14 : 10;
  const color = levelColor(event.level);

  wrap.style.cssText = [
    "display:block",
    `width:${size}px`,
    `height:${size}px`,
    "padding:0",
    "margin:0",
    "border-radius:9999px",
    `background:${color}`,
    "border:1.5px solid #fff",
    "box-shadow:0 1px 2px rgba(0,0,0,.28)",
    "cursor:pointer",
    "appearance:none",
    "-webkit-appearance:none",
    "transition:transform 120ms ease",
    selected ? "transform:scale(1.35)" : "transform:none",
  ].join(";");

  return wrap;
}

function makeUserLocationElement() {
  const wrap = document.createElement("div");
  wrap.className = "startline-user-location";
  wrap.setAttribute("aria-label", "Your location");
  wrap.style.cssText = [
    "position:relative",
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
const FALLBACK_CENTER: [number, number] = [15.5, 49.75]; // Czechia

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
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const locateBtnRef = useRef<HTMLButtonElement | null>(null);
  const initialViewDoneRef = useRef(false);
  const userMovedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const paddingRef = useRef(padding);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [userPos, setUserPos] = useState<{ lng: number; lat: number; accuracy?: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  onSelectRef.current = onSelect;
  onBoundsChangeRef.current = onBoundsChange;
  paddingRef.current = padding;

  const goToMyLocationRef = useRef<() => void>(() => {});

  function emitBounds(map: Map) {
    const b = map.getBounds();
    onBoundsChangeRef.current({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    });
  }

  function applyInitialView(map: Map, lng: number, lat: number, duration = 0) {
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
      `;
      document.head.appendChild(style);
    }

    const map = new MapLibreMap({
      container: el,
      style: RASTER_STYLE,
      center: FALLBACK_CENTER,
      zoom: 7,
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

    // Fallback view: Czechia ~200 km until GPS arrives
    map.once("load", () => {
      if (!initialViewDoneRef.current) {
        fitRadius(map, FALLBACK_CENTER[0], FALLBACK_CENTER[1], DEFAULT_RADIUS_KM, paddingRef.current, 0);
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
    const t1 = window.setTimeout(resize, 50);
    const t2 = window.setTimeout(resize, 400);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", resize);
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
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
      pin.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onSelectRef.current(event.id);
      });

      const marker = new Marker({ element: pin, anchor: "center" })
        .setLngLat([Number(event.location!.lng), Number(event.location!.lat)])
        .addTo(map);

      markersRef.current.push(marker);
    }

    (window as unknown as { __startlineMarkerCount?: number }).__startlineMarkerCount =
      markersRef.current.length;

    // Race pin rebuild must not leave the user dot behind / under
    if (userPos) {
      upsertUserMarker(map, userMarkerRef, userPos);
    }

    requestAnimationFrame(() => map.resize());
  }, [events, selectedId, mapEpoch, userPos]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const ev = events.find((e) => e.id === selectedId);
    if (ev?.location?.lat == null || ev.location.lng == null) return;
    map.easeTo({
      center: [Number(ev.location.lng), Number(ev.location.lat)],
      zoom: Math.max(map.getZoom(), 9),
      padding,
      duration: 550,
    });
  }, [selectedId, events, padding]);

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
      setUserPos({
        lng: pos.coords.longitude,
        lat: pos.coords.latitude,
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
      // Only surface hard denials — timeouts fall back to Czechia quietly
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
      setUserPos({ lng, lat, accuracy: pos.coords.accuracy });
      setLocating(false);
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
          onClick={onSearchArea}
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

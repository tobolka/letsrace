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
import { LocateFixed, Loader2 } from "lucide-react";
import type { EventListItem } from "@/lib/events";

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

function pinColor(audience: string) {
  if (audience === "kids") return "#ea580c";
  if (audience === "adults") return "#1e293b";
  return "#475569";
}

function makePinElement(event: EventListItem, selected: boolean) {
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.className = "startline-map-pin";
  wrap.setAttribute("aria-label", event.name);
  wrap.dataset.eventId = event.id;
  const size = selected ? 28 : 20;
  wrap.style.cssText = [
    "display:block",
    `width:${size}px`,
    `height:${size}px`,
    "padding:0",
    "margin:0",
    "border-radius:9999px",
    `background:${pinColor(event.audience)}`,
    "border:3px solid #fff",
    "box-shadow:0 2px 10px rgba(0,0,0,.5)",
    "cursor:pointer",
    "appearance:none",
    "-webkit-appearance:none",
  ].join(";");
  return wrap;
}

function makeUserLocationElement() {
  const wrap = document.createElement("div");
  wrap.className = "startline-user-location";
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText = [
    "position:relative",
    "width:22px",
    "height:22px",
    "pointer-events:none",
  ].join(";");

  const pulse = document.createElement("span");
  pulse.style.cssText = [
    "position:absolute",
    "inset:-10px",
    "border-radius:9999px",
    "background:rgba(26,115,232,.28)",
    "animation:startline-loc-pulse 2.2s ease-out infinite",
  ].join(";");

  const dot = document.createElement("span");
  dot.style.cssText = [
    "position:absolute",
    "inset:0",
    "border-radius:9999px",
    "background:#1a73e8",
    "border:3px solid #fff",
    "box-shadow:0 1px 6px rgba(0,0,0,.35)",
  ].join(";");

  wrap.appendChild(pulse);
  wrap.appendChild(dot);
  return wrap;
}

const DEFAULT_PADDING: PaddingOptions = { top: 72, bottom: 56, left: 56, right: 56 };

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
  const fittedRef = useRef(false);
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
      `;
      document.head.appendChild(style);
    }

    const map = new MapLibreMap({
      container: el,
      style: RASTER_STYLE,
      center: [15.5, 49.75],
      zoom: 6.4,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    fittedRef.current = false;
    (window as unknown as { __startlineMap?: Map }).__startlineMap = map;
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    setMapEpoch((n) => n + 1);

    map.on("dragstart", () => {
      userMovedRef.current = true;
    });
    map.on("zoomstart", (e) => {
      if (e.originalEvent) userMovedRef.current = true;
    });
    map.on("moveend", () => {
      if (!userMovedRef.current) return;
      const b = map.getBounds();
      onBoundsChangeRef.current({
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      });
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

    if (!fittedRef.current && withCoords.length > 0) {
      const bounds = new LngLatBounds();
      withCoords.forEach((e) =>
        bounds.extend([Number(e.location!.lng), Number(e.location!.lat)]),
      );
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: paddingRef.current,
          maxZoom: 8,
          duration: 0,
        });
        fittedRef.current = true;
      }
    }

    requestAnimationFrame(() => map.resize());
  }, [events, selectedId, mapEpoch]);

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

  // Keep user location marker in sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapEpoch === 0 || !userPos) return;

    if (!userMarkerRef.current) {
      userMarkerRef.current = new Marker({
        element: makeUserLocationElement(),
        anchor: "center",
      })
        .setLngLat([userPos.lng, userPos.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userPos.lng, userPos.lat]);
    }
  }, [userPos, mapEpoch]);

  // Auto-request location once map is ready (shows blue dot; no forced fly)
  useEffect(() => {
    if (mapEpoch === 0 || !navigator.geolocation) return;
    if (watchIdRef.current != null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
          accuracy: pos.coords.accuracy,
        });
        setLocError(null);
        setLocating(false);
      },
      () => {
        // Silent on auto-start — error shown only after explicit button tap
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );

    return () => {
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

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        setUserPos({ lng, lat, accuracy: pos.coords.accuracy });
        setLocating(false);
        const map = mapRef.current;
        if (!map) return;
        map.easeTo({
          center: [lng, lat],
          zoom: Math.max(map.getZoom(), 12),
          padding: paddingRef.current,
          duration: 700,
        });
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocError(locationDeniedLabel);
        } else {
          setLocError(locationDeniedLabel);
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
  }

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

      <div className="absolute bottom-28 right-2.5 z-10 flex flex-col items-end gap-2 md:bottom-24">
        {locError ? (
          <p
            className="max-w-[11rem] rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] text-stone-600 shadow ring-1 ring-stone-200"
            role="status"
            aria-live="polite"
          >
            {locError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={goToMyLocation}
          aria-label={myLocationLabel}
          title={myLocationLabel}
          className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-stone-800 shadow-md ring-1 ring-stone-200 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          {locating ? (
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" aria-hidden />
          ) : (
            <LocateFixed
              className={`h-5 w-5 ${userPos ? "text-sky-600" : "text-stone-700"}`}
              aria-hidden
            />
          )}
        </button>
      </div>
    </div>
  );
}

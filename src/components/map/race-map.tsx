"use client";

import { useEffect, useRef, useState } from "react";
import type { Map, Marker, PaddingOptions, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { format, parseISO } from "date-fns";
import type { EventListItem } from "@/lib/events";
import { EUROPE_CAMERA_BOUNDS, isInEuropeMap } from "@/lib/geo/europe";
import { loadMapLibre, type MapLibreModule } from "@/lib/maplibre";
import { disciplineColor, disciplineColorDark } from "@/lib/map-visuals";
import { DISCIPLINE_LABELS, type Discipline } from "@/lib/taxonomy";
import { dateFnsLocale } from "@/lib/i18n/dates";

let maplibre: MapLibreModule;

export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** A rendered race pin, kept so selection can re-style it in place. */
type PinEntry = {
  id: string;
  event: EventListItem;
  el: HTMLElement;
  marker: Marker;
};

/** Why the camera settled — parent auto-searches only on user/gps/locate. */
export type BoundsChangeReason = "sync" | "user" | "gps" | "locate";

type Props = {
  events: EventListItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  /** Map canvas tap (not a pin) — used to collapse the mobile sheet. */
  onBackgroundClick?: () => void;
  onBoundsChange: (b: MapBounds, reason: BoundsChangeReason) => void;
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
  /** GPS fix for sorting the race list by distance. */
  onUserLocation?: (pos: { lat: number; lng: number }) => void;
  /** UI locale — dates in pin tooltips follow it. */
  locale?: string;
};

const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();
const MAP_STYLE = cartoKey
  ? `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=${encodeURIComponent(cartoKey)}`
  : "https://tiles.openfreemap.org/styles/liberty";

function hideMarineNames(map: Map) {
  for (const id of ["watername_ocean", "watername_sea"]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
  }
  // Carto's lake-line layer matches every named water LineString, including seas.
  if (map.getLayer("watername_lake_line")) {
    map.setFilter("watername_lake_line", [
      "all",
      ["has", "name"],
      ["==", "$type", "LineString"],
      ["==", "class", "lake"],
    ]);
  }
}

let lastPinTipAt = 0;

function pinTipContent(event: EventListItem, locale: string) {
  const root = document.createElement("div");
  const name = document.createElement("p");
  name.textContent = event.name;
  name.style.cssText =
    "margin:0;font-size:13px;font-weight:600;line-height:1.3;color:#1c1917;letter-spacing:-0.01em";

  const meta = document.createElement("p");
  const date = format(parseISO(event.startDate), "d MMM yyyy", {
    locale: dateFnsLocale(locale),
  });
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

function pinDotCss(event: EventListItem, selected: boolean) {
  const color = disciplineColor(event.disciplines);
  const colorDark = disciplineColorDark(event.disciplines);
  return selected
    ? [
        "width:16px",
        "height:16px",
        "border-radius:9999px",
        `background:${colorDark}`,
        "border:2.5px solid #fff",
        `box-shadow:0 0 0 3px ${color}, 0 0 0 5px rgba(255,255,255,.92), 0 2px 10px ${color}`,
        "pointer-events:none",
        "flex:0 0 auto",
      ].join(";")
    : [
        "width:16px",
        "height:16px",
        "border-radius:9999px",
        `background:${color}`,
        "border:2px solid #fff",
        "box-shadow:0 1px 3px rgba(0,0,0,.32)",
        "pointer-events:none",
        "flex:0 0 auto",
      ].join(";");
}

/** Re-style an existing pin without recreating it. */
function applyPinSelected(wrap: HTMLElement, event: EventListItem, selected: boolean) {
  if (selected) wrap.dataset.selected = "true";
  else delete wrap.dataset.selected;
  const dot = wrap.firstElementChild as HTMLElement | null;
  if (dot) dot.style.cssText = pinDotCss(event, selected);
}

function makePinElement(event: EventListItem, selected: boolean) {
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.className = "letsrace-map-pin";
  wrap.setAttribute("aria-label", event.name);
  wrap.dataset.eventId = event.id;
  wrap.dataset.level = event.level || "local";
  wrap.dataset.discipline = event.disciplines?.[0] || "other";

  wrap.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:center",
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
      ? "width:44px;height:44px"
      : "width:32px;height:32px",
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
  dot.setAttribute("aria-hidden", "true");
  wrap.appendChild(dot);
  applyPinSelected(wrap, event, selected);

  return wrap;
}

function makeUserLocationElement() {
  const wrap = document.createElement("div");
  wrap.className = "letsrace-user-location";
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
    "background:rgba(23,23,23,.22)",
    "animation:letsrace-loc-pulse 2.2s ease-out infinite",
  ].join(";");

  const ring = document.createElement("span");
  ring.style.cssText = [
    "position:absolute",
    "inset:-4px",
    "border-radius:9999px",
    "border:2px solid rgba(23,23,23,.45)",
    "background:transparent",
  ].join(";");

  const dot = document.createElement("span");
  dot.style.cssText = [
    "position:absolute",
    "inset:0",
    "border-radius:9999px",
    "background:#171717",
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
    markerRef.current = new maplibre.Marker({
      element: makeUserLocationElement(),
      anchor: "center",
      className: "letsrace-user-marker",
    })
      .setLngLat([pos.lng, pos.lat])
      .addTo(map);
  } else {
    markerRef.current.setLngLat([pos.lng, pos.lat]).addTo(map);
  }
  // Keep the user dot above race pins
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

const LOCATE_ARROW_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.72 3.05a1.2 1.2 0 0 1 1.23 1.54L16.4 21.48a1.15 1.15 0 0 1-2.18.1l-3.22-7.9-7.9-3.22A1.15 1.15 0 0 1 3.2 8.28L19.4 2.82c.42-.14.88-.04 1.32.23Z"/></svg>';
const ZOOM_IN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ZOOM_OUT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';

function appleCtrlButton(opts: {
  className: string;
  label: string;
  html: string;
  onClick: () => void;
}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = opts.className;
  btn.setAttribute("aria-label", opts.label);
  btn.title = opts.label;
  btn.innerHTML = opts.html;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    opts.onClick();
  });
  return btn;
}

const DEFAULT_PADDING: PaddingOptions = { top: 72, bottom: 56, left: 56, right: 56 };
/** Default map view: user location with ~200 km radius. */
const DEFAULT_RADIUS_KM = 200;
const CZECHIA_CENTER: [number, number] = [15.5, 49.75];

function boundsAround(lng: number, lat: number, radiusKm: number) {
  const dLat = radiusKm / 111;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = radiusKm / (111 * Math.max(cos, 0.2));
  return new maplibre.LngLatBounds([lng - dLng, lat - dLat], [lng + dLng, lat + dLat]);
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
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  const left = typeof padding.left === "number" ? padding.left : 0;
  const right = typeof padding.right === "number" ? padding.right : 0;
  const top = typeof padding.top === "number" ? padding.top : 0;
  const bottom = typeof padding.bottom === "number" ? padding.bottom : 0;
  // Side panels can eat the inner rectangle on a narrow window — never
  // search a collapsed sliver or the map stays empty after tiles appear.
  if (width - left - right < 160 || height - top - bottom < 160) {
    const b = map.getBounds();
    return {
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    };
  }
  const sw = map.unproject([left, height - bottom]);
  const ne = map.unproject([width - right, top]);
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
  onBackgroundClick,
  onBoundsChange,
  myLocationLabel = "My location",
  locationDeniedLabel = "Location permission denied",
  padding = DEFAULT_PADDING,
  fitSeq = 0,
  destination = null,
  destinationSeq = 0,
  fallbackCenter = CZECHIA_CENTER,
  initialFocus = null,
  skipInitialLocate = false,
  onUserLocation,
  locale = "en",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<PinEntry[]>([]);
  const selectedIdRef = useRef(selectedId);
  const userMarkerRef = useRef<Marker | null>(null);
  const hoverPopupRef = useRef<Popup | null>(null);
  const hoverTimerRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const locateBtnRef = useRef<HTMLButtonElement | null>(null);
  const initialViewDoneRef = useRef(false);
  const userMovedRef = useRef(false);
  const userGestureRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onUserLocationRef = useRef(onUserLocation);
  const paddingRef = useRef(padding);
  const initialFocusRef = useRef(initialFocus);
  const skipInitialLocateRef = useRef(skipInitialLocate);
  const fallbackCenterRef = useRef(fallbackCenter);
  const localeRef = useRef(locale);
  selectedIdRef.current = selectedId;
  const fitSeqRef = useRef(0);
  const destSeqRef = useRef(0);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [userPos, setUserPos] = useState<{ lng: number; lat: number; accuracy?: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  onSelectRef.current = onSelect;
  onBackgroundClickRef.current = onBackgroundClick;
  onBoundsChangeRef.current = onBoundsChange;
  onUserLocationRef.current = onUserLocation;
  paddingRef.current = padding;
  initialFocusRef.current = initialFocus;
  skipInitialLocateRef.current = skipInitialLocate;
  fallbackCenterRef.current = fallbackCenter;
  localeRef.current = locale;

  const goToMyLocationRef = useRef<() => void>(() => {});

  function emitBounds(map: Map, reason: BoundsChangeReason = "sync") {
    onBoundsChangeRef.current(visibleBounds(map, paddingRef.current), reason);
  }

  function emitBoundsWhenIdle(map: Map, reason: BoundsChangeReason) {
    let done = false;
    const fire = () => {
      if (done || mapRef.current !== map) return;
      done = true;
      emitBounds(map, reason);
    };
    if (map.loaded() && !map.isMoving()) {
      fire();
      return;
    }
    map.once("idle", fire);
    window.setTimeout(fire, 350);
  }

  function applyInitialView(map: Map, lng: number, lat: number, duration = 0) {
    if (skipInitialLocateRef.current) return;
    if (initialViewDoneRef.current || userMovedRef.current) return;
    fitRadius(map, lng, lat, DEFAULT_RADIUS_KM, paddingRef.current, duration);
    initialViewDoneRef.current = true;
    emitBoundsWhenIdle(map, "gps");
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let teardown: (() => void) | undefined;

    let mapCtrlStyle = document.getElementById("letsrace-loc-pulse-style") as HTMLStyleElement | null;
    if (!mapCtrlStyle) {
      mapCtrlStyle = document.createElement("style");
      mapCtrlStyle.id = "letsrace-loc-pulse-style";
      document.head.appendChild(mapCtrlStyle);
    }
    mapCtrlStyle.textContent = `
        @keyframes letsrace-loc-pulse {
          0% { transform: scale(0.55); opacity: 0.85; }
          70% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .letsrace-user-location span:first-child { animation: none !important; opacity: 0.35; }
        }
        .maplibregl-ctrl-bottom-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          margin: 0 12px 12px 0 !important;
        }
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl {
          float: none !important;
          clear: none !important;
          margin: 0 !important;
        }
        .maplibregl-ctrl-bottom-right .letsrace-locate-group { order: 1; }
        .maplibregl-ctrl-bottom-right .letsrace-zoom-ctrl { order: 2; }
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib { order: 3; }
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group,
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group:not(:empty) {
          overflow: hidden !important;
          border: 0 !important;
          border-radius: 9999px !important;
          background: rgba(255, 255, 255, 0.78) !important;
          -webkit-backdrop-filter: blur(24px) saturate(1.6);
          backdrop-filter: blur(24px) saturate(1.6);
          box-shadow:
            0 0 0 0.5px rgba(0, 0, 0, 0.08),
            0 1px 2px rgba(0, 0, 0, 0.06),
            0 10px 24px rgba(0, 0, 0, 0.12) !important;
        }
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button {
          width: 44px !important;
          height: 44px !important;
          min-width: 44px;
          min-height: 44px;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: #1d1d1f;
          display: flex !important;
          align-items: center;
          justify-content: center;
        }
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button + button {
          border-top: 0 !important;
        }
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:hover,
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:not(:disabled):hover,
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:not(:disabled):active {
          background: rgba(0, 0, 0, 0.06) !important;
        }
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:focus,
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:focus:focus-visible {
          box-shadow: none !important;
          outline: 2px solid #007aff;
          outline-offset: -2px;
        }
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:focus:first-child,
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:focus:last-child,
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button:focus:only-child {
          border-radius: 0 !important;
        }
        .letsrace-locate-ctrl,
        .letsrace-locate-ctrl[data-active="true"] {
          color: #007aff !important;
        }
        .letsrace-locate-ctrl svg,
        .letsrace-zoom-in svg,
        .letsrace-zoom-out svg {
          display: block;
          width: 18px;
          height: 18px;
        }
        @media (max-width: 767px) {
          .maplibregl-ctrl-top-right {
            display: none;
          }
          .maplibregl-ctrl-bottom-right {
            bottom: calc(var(--map-sheet-inset, 7.5rem) + 8px);
            right: 8px;
            margin: 0 !important;
          }
          .letsrace-zoom-ctrl {
            display: none !important;
          }
          .letsrace-locate-ctrl {
            width: 44px !important;
            height: 44px !important;
          }
        }
        .maplibregl-marker.letsrace-user-marker {
          z-index: 5 !important;
          overflow: visible !important;
        }
        .maplibregl-marker:has(.letsrace-map-pin:hover) {
          z-index: 20 !important;
        }
        .maplibregl-marker:has(.letsrace-map-pin[data-selected="true"]) {
          z-index: 25 !important;
        }
        .letsrace-pin-tip {
          pointer-events: none;
          z-index: 30 !important;
        }
        .letsrace-pin-tip .maplibregl-popup-content {
          padding: 8px 10px;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(28,25,23,.06), 0 10px 24px rgba(28,25,23,.14);
          border: 1px solid rgba(28,25,23,.08);
          overflow: visible;
          font-family: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
        }
        .letsrace-pin-tip.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
          border-top-color: #fff;
          margin-top: -1px;
          z-index: 2;
          filter: drop-shadow(0 1px 0 rgba(28,25,23,.08));
        }
        .letsrace-pin-tip.maplibregl-popup-anchor-top .maplibregl-popup-tip {
          border-bottom-color: #fff;
          margin-bottom: -1px;
          z-index: 2;
          filter: drop-shadow(0 -1px 0 rgba(28,25,23,.08));
        }
        @media (prefers-reduced-motion: reduce) {
          .letsrace-map-pin span { transition: none !important; }
        }
      `;

    void loadMapLibre().then((ml) => {
    if (cancelled || !containerRef.current) return;
    maplibre = ml;

    const map = new maplibre.Map({
      container: el,
      style: MAP_STYLE,
      center: fallbackCenterRef.current,
      zoom: 7,
      maxBounds: EUROPE_CAMERA_BOUNDS,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      // Voyager carries a lot of label layers and the default cross-fade
      // re-renders all of them for 300ms after every tile lands, on the main
      // thread, while the page is still trying to become interactive.
      fadeDuration: 0,
      refreshExpiredTiles: false,
      transformRequest: cartoKey
        ? (url) => {
            if (!url.includes("basemaps.cartocdn.com") || /[?&]key=/.test(url)) {
              return { url };
            }
            return {
              url: `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(cartoKey)}`,
            };
          }
        : undefined,
    });
    mapRef.current = map;
    initialViewDoneRef.current = false;
    (window as unknown as { __letsraceMap?: Map }).__letsraceMap = map;

    const locateCtrl = {
      onAdd() {
        const container = document.createElement("div");
        container.className = "maplibregl-ctrl maplibregl-ctrl-group letsrace-locate-group";
        const btn = appleCtrlButton({
          className: "letsrace-locate-ctrl",
          label: myLocationLabel,
          html: LOCATE_ARROW_SVG,
          onClick: () => goToMyLocationRef.current(),
        });
        locateBtnRef.current = btn;
        container.appendChild(btn);
        return container;
      },
      onRemove() {
        locateBtnRef.current = null;
      },
    };
    const zoomCtrl = {
      onAdd() {
        const container = document.createElement("div");
        container.className = "maplibregl-ctrl maplibregl-ctrl-group letsrace-zoom-ctrl";
        container.append(
          appleCtrlButton({
            className: "letsrace-zoom-in maplibregl-ctrl-zoom-in",
            label: "Zoom in",
            html: ZOOM_IN_SVG,
            onClick: () => map.zoomIn({ duration: 280 }),
          }),
          appleCtrlButton({
            className: "letsrace-zoom-out maplibregl-ctrl-zoom-out",
            label: "Zoom out",
            html: ZOOM_OUT_SVG,
            onClick: () => map.zoomOut({ duration: 280 }),
          }),
        );
        return container;
      },
      onRemove() {},
    };
    map.addControl(locateCtrl, "bottom-right");
    map.addControl(zoomCtrl, "bottom-right");
    setMapEpoch((n) => n + 1);

    map.on("style.load", () => hideMarineNames(map));

    map.once("load", () => {
      const focus = initialFocusRef.current;
      const home = fallbackCenterRef.current;
      if (focus) {
        fitRadius(map, focus.lng, focus.lat, DEFAULT_RADIUS_KM, paddingRef.current, 0);
        initialViewDoneRef.current = true;
        emitBoundsWhenIdle(map, "gps");
        return;
      }
      if (skipInitialLocateRef.current) {
        fitRadius(map, home[0], home[1], DEFAULT_RADIUS_KM, paddingRef.current, 0);
        emitBoundsWhenIdle(map, "gps");
        return;
      }
      if (!initialViewDoneRef.current) {
        fitRadius(map, home[0], home[1], DEFAULT_RADIUS_KM, paddingRef.current, 0);
        emitBoundsWhenIdle(map, "gps");
      }
    });

    map.on("click", (e) => {
      const target = e.originalEvent.target;
      if (target instanceof Element && target.closest(".letsrace-map-pin, .letsrace-locate-ctrl, .maplibregl-ctrl")) {
        return;
      }
      onBackgroundClickRef.current?.();
    });
    map.on("dragstart", () => {
      userMovedRef.current = true;
      userGestureRef.current = true;
    });
    map.on("zoomstart", (e) => {
      if (e.originalEvent) {
        userMovedRef.current = true;
        userGestureRef.current = true;
      }
    });
    map.on("moveend", () => {
      if (!userMovedRef.current) return;
      const fromUser = userGestureRef.current;
      userGestureRef.current = false;
      emitBounds(map, fromUser ? "user" : "sync");
    });

    let resizeSyncTimer = 0;
    const resize = () => {
      map.resize();
      window.clearTimeout(resizeSyncTimer);
      resizeSyncTimer = window.setTimeout(() => {
        if (map.loaded()) emitBounds(map, "sync");
      }, 180);
    };
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const t1 = window.setTimeout(resize, 50);
    const t2 = window.setTimeout(resize, 400);

    teardown = () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(resizeSyncTimer);
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
      markersRef.current.forEach((entry) => entry.marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    }).catch((err) => {
      console.error(err);
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapEpoch === 0) return;

    markersRef.current.forEach((entry) => entry.marker.remove());
    markersRef.current = [];
    window.clearTimeout(hoverTimerRef.current);
    hoverPopupRef.current?.remove();

    if (!hoverPopupRef.current) {
      hoverPopupRef.current = new maplibre.Popup({
        closeButton: false,
        closeOnClick: false,
        closeOnMove: false,
        offset: 18,
        className: "letsrace-pin-tip",
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
      const selected = event.id === selectedIdRef.current;
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
          popup.setLngLat(lngLat).setDOMContent(pinTipContent(event, localeRef.current)).addTo(map);
          lastPinTipAt = Date.now();
        }, delay);
      });
      pin.addEventListener("mouseleave", () => {
        window.clearTimeout(hoverTimerRef.current);
        popup.remove();
      });

      markersRef.current.push({
        id: event.id,
        event,
        el: pin,
        marker: new maplibre.Marker({ element: pin, anchor: "center" })
          .setLngLat(lngLat)
          .addTo(map),
      });
    }

    (window as unknown as { __letsraceMarkerCount?: number }).__letsraceMarkerCount =
      markersRef.current.length;

    requestAnimationFrame(() => map.resize());
    // `selectedId` is read through a ref and re-applied by the effect below, so
    // selecting a pin re-styles two elements instead of rebuilding every marker.
    // The user dot has its own effect and is not part of `markersRef`.
  }, [events, mapEpoch]);

  // Selection: re-style only the pins whose state actually changed.
  useEffect(() => {
    for (const entry of markersRef.current) {
      const next = entry.id === selectedId;
      if (next === (entry.el.dataset.selected === "true")) continue;
      applyPinSelected(entry.el, entry.event, next);
    }
  }, [selectedId]);

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
    emitBoundsWhenIdle(map, "gps");
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
    const b = new maplibre.LngLatBounds();
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
    const b = new maplibre.LngLatBounds(
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
    onUserLocationRef.current?.({ lat: userPos.lat, lng: userPos.lng });

    const btn = locateBtnRef.current;
    if (btn) btn.dataset.active = userPos ? "true" : "";
  }, [userPos, mapEpoch]);

  /**
   * Resolve location: fast network position first, then optional precise watch.
   *
   * Only for someone who has already granted it. Asking on load put a browser
   * permission prompt over the map before anyone had seen what the site was,
   * which is both rude and the thing Lighthouse flags; the locate button is
   * still there for anyone who wants it.
   */
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

    function resolve() {
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
    }

    // Without the Permissions API (older Safari) we stay put and wait to be
    // asked, rather than guessing and prompting.
    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (cancelled || status.state !== "granted") return;
          setLocating(true);
          resolve();
        })
        .catch(() => undefined);
    }

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
      emitBoundsWhenIdle(map, "locate");
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
    btn.style.opacity = locating ? "0.7" : "1";
    btn.dataset.active = userPos ? "true" : "";
    btn.disabled = locating;
  }, [locating, userPos, mapEpoch]);

  return (
    <div className="relative h-full w-full bg-stone-200">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {locError ? (
        <p
          className="absolute left-2.5 top-[max(0.75rem,env(safe-area-inset-top))] z-10 max-w-[11rem] rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] text-stone-600 shadow ring-1 ring-stone-200 md:left-auto md:right-2.5 md:top-auto md:bottom-20"
          role="status"
          aria-live="polite"
        >
          {locError}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  Marker,
  PaddingOptions,
  Popup,
  StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { format, parseISO } from "date-fns";
import type { EventListItem } from "@/lib/events";
import { EUROPE_CAMERA_BOUNDS, isInEuropeMap } from "@/lib/geo/europe";
import { loadMapLibre, type MapLibreModule } from "@/lib/maplibre";
import {
  DISCIPLINE_FAMILY_COLORS,
  DISCIPLINE_FAMILY_ICONS,
  disciplineColor,
  disciplineColorDark,
  disciplineIcon,
} from "@/lib/map-visuals";
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

/**
 * Voyager as raster rather than vector.
 *
 * The design is the same one Carto renders from — the map looks as it did. What
 * goes away is the work: a vector tile at this zoom is 125-209 KB that has to be
 * decoded and drawn through ninety-three layers with label collision on the main
 * thread, where the raster equivalent is about 30 KB the browser simply paints.
 *
 * The cost is that labels are baked in, so they no longer rotate with the map,
 * and zooming between levels is briefly soft.
 */
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png"],
      tileSize: 256,
      maxzoom: 20,
      attribution:
        '&copy; <a href="https://carto.com/attributions">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

function hideMarineNames(map: MapLibreMap) {
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

function pinTipContent(name: string, meta: string) {
  const root = document.createElement("div");
  const title = document.createElement("p");
  title.textContent = name;
  title.style.cssText =
    "margin:0;font-size:13px;font-weight:600;line-height:1.3;color:#1c1917;letter-spacing:-0.01em";

  const sub = document.createElement("p");
  sub.textContent = meta;
  sub.style.cssText =
    "margin:3px 0 0;font-size:11px;line-height:1.35;color:#78716c;font-variant-numeric:tabular-nums";

  root.append(title, sub);
  return root;
}

const RACES_SOURCE = "letsrace-races";
const SHADOW_LAYER = "letsrace-races-shadow";
const GLOW_LAYER = "letsrace-races-glow";
const PIN_LAYER = "letsrace-races-pin";
const BADGE_LAYER = "letsrace-races-badge";

/**
 * The whole pin as one image.
 *
 * The circle used to be a circle layer and the bike a symbol layer on top of
 * it, which meant every bike was drawn after every circle — so a pin behind
 * another one had its glyph floating over the front pin's face. Baked
 * together, the pins are one symbol layer, and a symbol layer draws its icons
 * in order: the pin in front simply covers the one behind, face and all.
 *
 * `PIN_RASTER` is the size it is baked at, `PIN_PX` the size it appears on the
 * map. The layer scales one to the other rather than leaning on MapLibre's
 * `pixelRatio`, so what ends up on screen is a number written down here and
 * not one inferred from it.
 */
const PIN_BOX_PX = 40;
const PIN_RASTER = PIN_BOX_PX * 3;
/** The visible disc, and the coloured part of it inside its white ring. */
const PIN_DISC_PX = 26;
const PIN_FILL_PX = 22;
/** The glyph inside, at the size it reads best without touching the ring. */
const GLYPH_PX = 12;
/** How much of its own box the glyph fills, once trimmed to its ink. */
const GLYPH_FILL = 0.92;
/**
 * The pin is baked inside a box half again its own width. The transparent
 * margin is the touch target — `queryRenderedFeatures` hits the icon's box,
 * not its ink — which is how a 26px pin answers to a finger.
 */
const OFFSET_UNITS = PIN_RASTER / PIN_BOX_PX;

/** The badge that says how many races share a point. */
const BADGE_PX = 17;
const BADGE_RASTER = BADGE_PX * 3;
const BADGE_IDS = ["2", "3", "4", "5", "6", "7", "8", "9", "more"] as const;

let familyIcons: Promise<void> | null = null;

/**
 * Bake one pin per discipline family.
 *
 * The glyph artwork is black on transparent and the pin under it is not, so
 * the shape is kept and the colour thrown away. The bikes are also not drawn
 * to the same size inside their 24px boxes — one fills it, another leaves a
 * margin — so each is measured by its own ink and scaled to a common width,
 * or a road pin would carry a visibly bigger bike than a mountain one.
 *
 * `other` gets a bare disc: a plain dot is the honest answer for a race whose
 * discipline we could not read.
 */
function loadFamilyIcons(): Promise<void> {
  familyIcons ??= Promise.all([
    ...Object.keys(DISCIPLINE_FAMILY_COLORS).map(async (family) => {
      const glyph = await loadGlyph(DISCIPLINE_FAMILY_ICONS[family]);
      const canvas = document.createElement("canvas");
      canvas.width = PIN_RASTER;
      canvas.height = PIN_RASTER;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const mid = PIN_RASTER / 2;
      const scale = PIN_RASTER / PIN_BOX_PX;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(mid, mid, (PIN_DISC_PX / 2) * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = DISCIPLINE_FAMILY_COLORS[family];
      ctx.beginPath();
      ctx.arc(mid, mid, (PIN_FILL_PX / 2) * scale, 0, Math.PI * 2);
      ctx.fill();
      if (glyph) {
        const g = GLYPH_PX * scale;
        ctx.drawImage(glyph, mid - g / 2, mid - g / 2, g, g);
      }
      pinBitmaps[family] = ctx.getImageData(0, 0, PIN_RASTER, PIN_RASTER);
    }),
    bakeCountBadges(),
  ])
    .then(() => undefined)
    .catch(() => undefined);
  return familyIcons;
}

/**
 * "2", "3" … "9+", as small dark discs to hang off the corner of a pin.
 *
 * The basemap is raster and carries no glyph server, so a `text-field` is not
 * available — the number is drawn onto a canvas instead, which is why there is
 * one image per count rather than one layer that can render any.
 */
async function bakeCountBadges(): Promise<void> {
  await document.fonts.ready;
  for (const id of BADGE_IDS) {
    const canvas = document.createElement("canvas");
    canvas.width = BADGE_RASTER;
    canvas.height = BADGE_RASTER;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const mid = BADGE_RASTER / 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(mid, mid, mid, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.arc(mid, mid, mid - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = id === "more" ? "9+" : id;
    ctx.font = `700 ${id === "more" ? 24 : 28}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(label, mid, mid + 1);
    pinBitmaps[`lr-count-${id}`] = ctx.getImageData(0, 0, BADGE_RASTER, BADGE_RASTER);
  }
}

/** One discipline glyph, trimmed to its ink, centred, and turned white. */
async function loadGlyph(href: string | undefined): Promise<HTMLCanvasElement | null> {
  if (!href) return null;
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`icon ${href}`));
    img.src = href;
  });

  const size = GLYPH_PX * 3;
  // Draw it once to find where the ink actually is.
  const probe = document.createElement("canvas");
  probe.width = size;
  probe.height = size;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  if (!pctx) return null;
  pctx.drawImage(img, 0, 0, size, size);
  const box = inkBounds(pctx.getImageData(0, 0, size, size));
  if (!box) return null;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const scale = (size * GLYPH_FILL) / Math.max(box.w, box.h);
  const dx = (size - box.w * scale) / 2 - box.x * scale;
  const dy = (size - box.h * scale) / 2 - box.y * scale;
  ctx.drawImage(img, dx, dy, size * scale, size * scale);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** The rectangle the non-transparent pixels occupy, or null if there are none. */
function inkBounds(data: ImageData): { x: number; y: number; w: number; h: number } | null {
  const { width, height } = data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data.data[(y * width + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Baked once per page, added to every map instance that needs them. */
const pinBitmaps: Record<string, ImageData> = {};

function registerFamilyIcons(map: MapLibreMap) {
  for (const [family, data] of Object.entries(pinBitmaps)) {
    if (!map.hasImage(family)) map.addImage(family, data, { pixelRatio: 1 });
  }
}

/**
 * Every race as one GeoJSON feature rather than one DOM element.
 *
 * Two hundred markers were two hundred absolutely positioned buttons, and
 * MapLibre rewrote every one of their transforms on every frame — style and
 * layout work that was most of this page's blocking time. As geometry they
 * cost the GPU a draw call and the main thread nothing.
 *
 * The tooltip's text is carried on the feature, so hovering does not have to
 * find the original event again.
 */
/** Races within about eleven metres of each other are at the same place. */
function stackKey(lng: number, lat: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * How far from the true point the fanned pins sit, so that neighbours in the
 * ring clear each other by a few pixels. Two races need barely any room; a
 * town with twenty-six needs a wide circle, and gets one.
 */
function fanRadius(n: number): number {
  const needed = (PIN_DISC_PX + 4) / (2 * Math.sin(Math.PI / n));
  return Math.min(140, Math.max(24, needed));
}

function raceFeatures(
  events: EventListItem[],
  locale: string,
  expandedKey: string | null,
): GeoJSON.FeatureCollection {
  const df = dateFnsLocale(locale);
  const groups = new Map<string, { lng: number; lat: number; items: EventListItem[] }>();

  for (const event of events) {
    const lat = Number(event.location?.lat);
    const lng = Number(event.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = stackKey(lng, lat);
    const group = groups.get(key);
    if (group) group.items.push(event);
    else groups.set(key, { lng, lat, items: [event] });
  }

  const features: GeoJSON.Feature[] = [];

  function push(
    event: EventListItem,
    lng: number,
    lat: number,
    props: { key: string; count: number; offset: [number, number] },
  ) {
    const date = format(parseISO(event.startDate), "d MMM yyyy", { locale: df });
    const discs = event.disciplines
      .map((d) => DISCIPLINE_LABELS[d as Discipline] || d)
      .filter(Boolean)
      .slice(0, 3)
      .join(" · ");

    features.push({
      type: "Feature",
      id: event.id,
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        id: event.id,
        name: event.name,
        meta: discs ? `${date} · ${discs}` : date,
        color: disciplineColor(event.disciplines),
        colorDark: disciplineColorDark(event.disciplines),
        icon: disciplineIcon(event.disciplines),
        stack: props.key,
        count: props.count,
        offset: props.offset,
      },
    });
  }

  for (const [key, { lng, lat, items }] of groups) {
    if (items.length === 1) {
      push(items[0], lng, lat, { key, count: 1, offset: [0, 0] });
      continue;
    }

    // Collapsed, one pin stands for the pile and wears the count. Expanded,
    // every race steps out onto a ring around the point it shares — offset in
    // screen space, so the fan holds its shape at any zoom.
    if (key !== expandedKey) {
      push(items[0], lng, lat, { key, count: items.length, offset: [0, 0] });
      continue;
    }

    const r = fanRadius(items.length);
    items.forEach((event, i) => {
      const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
      push(event, lng, lat, {
        key,
        count: 1,
        offset: [
          Math.cos(angle) * r * OFFSET_UNITS,
          Math.sin(angle) * r * OFFSET_UNITS,
        ],
      });
    });
  }

  return { type: "FeatureCollection", features };
}

/** Selected state lives in feature state, so selecting repaints nothing else. */
const SELECTED: ExpressionSpecification = ["boolean", ["feature-state", "selected"], false];

function coarsePointer() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
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
  map: MapLibreMap,
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

/**
 * Never open on the whole continent.
 *
 * `fitBounds` has a ceiling but no floor, so a 200 km reach fitted into what a
 * phone leaves once the sheet has taken its half — a strip about 350 by 380
 * pixels — settles at zoom 5.5. That is Hamburg to Vienna in one frame, every
 * race a dot in one blob, and it is what "find my location" did on a phone.
 */
const MIN_FIT_ZOOM = 7;

function fitRadius(
  map: MapLibreMap,
  lng: number,
  lat: number,
  radiusKm: number,
  padding: PaddingOptions,
  duration = 0,
) {
  const bounds = boundsAround(lng, lat, radiusKm);
  const camera = map.cameraForBounds(bounds, { padding, maxZoom: 9 });
  if (!camera) {
    map.fitBounds(bounds, { padding, duration, maxZoom: 9 });
    return;
  }
  map.easeTo({
    center: camera.center,
    zoom: Math.max(MIN_FIT_ZOOM, camera.zoom ?? MIN_FIT_ZOOM),
    padding,
    duration,
  });
}

function visibleBounds(map: MapLibreMap, padding: PaddingOptions): MapBounds {
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
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const styledSelectedRef = useRef<string | null>(null);
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
  /**
   * Which pile of races is currently fanned out, keyed by its shared point.
   * One at a time: two open fans over the same map would be a puzzle, not a
   * map. Held here rather than in feature state because the offsets that do
   * the fanning are a layout property, and layout properties cannot read it.
   */
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
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

  function emitBounds(map: MapLibreMap, reason: BoundsChangeReason = "sync") {
    onBoundsChangeRef.current(visibleBounds(map, paddingRef.current), reason);
  }

  function emitBoundsWhenIdle(map: MapLibreMap, reason: BoundsChangeReason) {
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

  function applyInitialView(map: MapLibreMap, lng: number, lat: number, duration = 0) {
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
      // Collision is what keeps the bikes from piling up on each other, and it
      // should be a contest between pins — not between a pin and whatever the
      // basemap wanted to write in the same spot. Confined to their own
      // source, they only ever elbow each other.
      crossSourceCollisions: false,
      attributionControl: { compact: true },
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
    (window as unknown as { __letsraceMap?: MapLibreMap }).__letsraceMap = map;

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
      if (target instanceof Element && target.closest(".letsrace-locate-ctrl, .maplibregl-ctrl")) {
        return;
      }
      // Pins are geometry now, so there is no element to look for: ask the map
      // whether the click landed on one before treating it as background.
      if (map.getLayer(PIN_LAYER) && map.queryRenderedFeatures(e.point, { layers: [PIN_LAYER] }).length) {
        return;
      }
      // Clicking the map is also how you put a fanned-out stack back together.
      setExpandedKey(null);
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

  // Pins: one GeoJSON source and four thin circle layers, drawn by the GPU.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapEpoch === 0) return;

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
    const data = raceFeatures(events, localeRef.current, expandedKey);

    function install() {
      const existing = map!.getSource(RACES_SOURCE);
      if (existing) {
        (existing as GeoJSONSource).setData(data);
        return;
      }

      map!.addSource(RACES_SOURCE, {
        type: "geojson",
        data,
        // The event id is a string, and feature state needs a feature id.
        promoteId: "id",
      });

      // A soft disc under the pin, standing in for the drop shadow the DOM
      // markers had. Circles cannot carry a box-shadow, but they can be blurred.
      map!.addLayer({
        id: SHADOW_LAYER,
        type: "circle",
        source: RACES_SOURCE,
        paint: {
          "circle-radius": 11,
          "circle-color": "rgba(28,25,23,0.35)",
          "circle-blur": 0.5,
          "circle-translate": [0, 1],
        },
      });

      // The ring the selected race wears. It sits under the pin rather than on
      // it, because the pin is one baked image and cannot change its face —
      // and a halo around the outside is what a map does for "this one"
      // anyway. Radius zero when nothing is selected, so the layer costs
      // nothing until it is needed.
      map!.addLayer({
        id: GLOW_LAYER,
        type: "circle",
        source: RACES_SOURCE,
        paint: {
          "circle-radius": ["case", SELECTED, 18, 0],
          "circle-color": ["get", "color"],
          "circle-opacity": ["case", SELECTED, 0.28, 0],
          "circle-stroke-width": ["case", SELECTED, 2, 0],
          "circle-stroke-color": ["get", "colorDark"],
        },
      });

      // The pin: disc, white ring and discipline, all in one image, so that a
      // pin in front covers the one behind instead of the two interleaving.
      // Overlap is allowed on purpose — a race is never dropped from the map
      // just because a neighbour got there first. The offset is what fans a
      // stack out; it is zero for everything else.
      map!.addLayer({
        id: PIN_LAYER,
        type: "symbol",
        source: RACES_SOURCE,
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": PIN_BOX_PX / PIN_RASTER,
          "icon-offset": ["get", "offset"],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      // How many races are hiding under this one. Only ever on a collapsed
      // stack: fanned out, each pin speaks for itself.
      map!.addLayer({
        id: BADGE_LAYER,
        type: "symbol",
        source: RACES_SOURCE,
        filter: [">", ["get", "count"], 1],
        layout: {
          "icon-image": [
            "concat",
            "lr-count-",
            ["case", [">", ["get", "count"], 9], "more", ["to-string", ["get", "count"]]],
          ],
          "icon-size": BADGE_PX / BADGE_RASTER,
          "icon-offset": [11 * (BADGE_RASTER / BADGE_PX), -11 * (BADGE_RASTER / BADGE_PX)],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      map!.on("click", PIN_LAYER, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        window.clearTimeout(hoverTimerRef.current);
        popup.remove();
        // A stack opens before it can be picked from. Anything else is a race.
        const count = Number(f.properties?.count ?? 1);
        if (count > 1) {
          setExpandedKey((f.properties?.stack as string) ?? null);
          return;
        }
        const id = f.properties?.id as string | undefined;
        if (id) onSelectRef.current(id);
      });

      map!.on("mousemove", PIN_LAYER, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map!.getCanvas().style.cursor = "pointer";
        const id = f.properties?.id as string;
        if (hoveredIdRef.current === id) return;
        hoveredIdRef.current = id;
        window.clearTimeout(hoverTimerRef.current);
        if (Number(f.properties?.count ?? 1) > 1) return;
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const name = f.properties?.name as string;
        const meta = f.properties?.meta as string;
        const delay = Date.now() - lastPinTipAt < 500 ? 0 : 280;
        hoverTimerRef.current = window.setTimeout(() => {
          popup.setLngLat(coords).setDOMContent(pinTipContent(name, meta)).addTo(map!);
          lastPinTipAt = Date.now();
        }, delay);
      });

      map!.on("mouseleave", PIN_LAYER, () => {
        hoveredIdRef.current = null;
        map!.getCanvas().style.cursor = "";
        window.clearTimeout(hoverTimerRef.current);
        popup.remove();
      });
    }

    // The icons have to exist before the symbol layer asks for them, or
    // MapLibre caches the miss and the pins come up bare. They are six small
    // same-origin files decoded once for the life of the page, so the wait is
    // a few milliseconds on the first map and nothing on every one after.
    function installWithIcons() {
      void loadFamilyIcons().then(() => {
        if (!mapRef.current) return;
        registerFamilyIcons(map!);
        install();
      });
    }

    if (map.isStyleLoaded()) installWithIcons();
    else map.once("load", installWithIcons);

    (window as unknown as { __letsraceMarkerCount?: number }).__letsraceMarkerCount =
      data.features.length;

    requestAnimationFrame(() => map.resize());
  }, [events, mapEpoch, expandedKey]);

  // Selection: two feature-state writes, not a walk over every pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(RACES_SOURCE)) return;
    const prev = styledSelectedRef.current;
    if (prev && prev !== selectedId) {
      map.setFeatureState({ source: RACES_SOURCE, id: prev }, { selected: false });
    }
    if (selectedId) {
      map.setFeatureState({ source: RACES_SOURCE, id: selectedId }, { selected: true });
    }
    styledSelectedRef.current = selectedId ?? null;
  }, [selectedId, events, mapEpoch, expandedKey]);

  /*
   * A race picked from the list can be the third of five at one point, where
   * the map only draws the first. Opening its pile is the only way the ring
   * around "this one" can land on the race you actually chose.
   */
  useEffect(() => {
    if (!selectedId) return;
    const chosen = events.find((e) => e.id === selectedId);
    const lat = Number(chosen?.location?.lat);
    const lng = Number(chosen?.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const key = stackKey(lng, lat);
    const shared = events.filter((e) => {
      const y = Number(e.location?.lat);
      const x = Number(e.location?.lng);
      return Number.isFinite(y) && Number.isFinite(x) && stackKey(x, y) === key;
    });
    if (shared.length > 1 && shared[0].id !== selectedId) setExpandedKey(key);
  }, [selectedId, events]);

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

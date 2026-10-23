import type { EventListItem } from "@/lib/events";

/** The map's own view of a box on the ground; the shell speaks only this. */
export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** Space the map keeps clear of side panels and the bottom sheet, in pixels. */
export type MapPadding = { top: number; bottom: number; left: number; right: number };

/** Why the camera settled — parent auto-searches only on user/gps/locate. */
export type BoundsChangeReason = "sync" | "user" | "gps" | "locate";

export type RaceMapProps = {
  events: EventListItem[];
  selectedId?: string | null;
  hoveredId?: string | null;
  radiusArea?: { lat: number; lng: number; km: number } | null;
  onSelect: (id: string) => void;
  /** Map canvas tap (not a pin) — used to collapse the mobile sheet. */
  onBackgroundClick?: () => void;
  onBoundsChange: (b: MapBounds, reason: BoundsChangeReason, camera: MapBounds) => void;
  myLocationLabel?: string;
  locationDeniedLabel?: string;
  /** Keep markers clear of side panels / bottom sheet */
  padding?: MapPadding;
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
  /** Bump to ask for the user's position, exactly as the locate button does. */
  locateSeq?: number;
  /** UI locale — dates in pin tooltips follow it. */
  locale?: string;
  /** A map inside a page: no wheel zoom, no touch drag, no geolocation prompt. */
  embedded?: boolean;
};

"use client";

import { preload, preconnect } from "react-dom";
import { lightTileUrl } from "./light-tile-url";
import { LightRaceMap } from "./light-race-map";
import type { RaceMapProps } from "./types";

export type { MapBounds, BoundsChangeReason } from "./types";

/** The map is the first screen, so its tiny renderer belongs in the initial
 * bundle. Preload its runtime during SSR instead of discovering it after
 * hydration, two animation frames and a second JavaScript download. */
export function RaceMapLazy(props: RaceMapProps) {
  preload("/maps/light-v1/leaflet.js", { as: "script" });
  preload("/maps/light-v1/leaflet.css", { as: "style" });
  preconnect("https://basemaps.cartocdn.com");
  // The initial phone camera uses zoom 7 around the selected race or market.
  // Warm just its two central tiles, not an entire viewport of guessed images.
  // Saved/place bounds use a different camera and deliberately skip these hints.
  if (!props.destination) {
    const [lng, lat] = props.initialFocus
      ? [props.initialFocus.lng, props.initialFocus.lat]
      : props.fallbackCenter ?? [15.5, 49.75];
    const sin = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180);
    const x = Math.floor((lng + 180) / 360 * 128);
    const y = Math.floor((1 - Math.log((1 + sin) / (1 - sin)) / (2 * Math.PI)) / 2 * 128);
    for (const row of [y, y + 1]) {
      preload(lightTileUrl(7, x, row, false), {
        as: "image", fetchPriority: "high", media: "(max-width: 767px)",
      });
    }
  }
  return <LightRaceMap {...props} />;
}

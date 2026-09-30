import type { StyleSpecification } from "maplibre-gl";

/**
 * Carto's raster Voyager basemap — the one style every map in the app draws on,
 * so the race map and the alert map look like the same place.
 */
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png"],
      tileSize: 256,
      maxzoom: 20,
      // Ours to write, so ours to get right: these are the only links on the
      // page that were taking the map away with them.
      attribution:
        '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>, ' +
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

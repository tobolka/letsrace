import { setWorkerUrl } from "maplibre-gl";

/**
 * MapLibre v6 resolves its worker as a sibling of import.meta.url.
 * Next (Turbopack and the production compiler) hashes the main bundle and
 * does not emit that sibling, so the request 404s as HTML and the raster
 * basemap never paints — markers (DOM) still show. Point at the copy in
 * /public/maplibre instead (see scripts/copy-maplibre-worker.cjs).
 */
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

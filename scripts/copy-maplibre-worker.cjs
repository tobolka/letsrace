/**
 * MapLibre v6 loads maplibre-gl-worker.mjs next to import.meta.url.
 * Next/Turbopack hashes the main bundle and does not emit that sibling, so
 * the worker request 404s as HTML and the raster basemap never paints.
 * Serve the worker + shared module from /public instead.
 */
const { copyFileSync, existsSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const src = join(root, "node_modules", "maplibre-gl", "dist");
const dest = join(root, "public", "maplibre");
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!existsSync(join(src, files[0]))) {
  console.warn("copy-maplibre-worker: maplibre-gl is not installed, skipping");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const file of files) {
  copyFileSync(join(src, file), join(dest, file));
}

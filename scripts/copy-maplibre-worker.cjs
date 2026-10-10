/**
 * MapLibre v6 loads maplibre-gl-worker.mjs next to import.meta.url.
 * Next/Turbopack hashes the main bundle and does not emit that sibling.
 * Serve the ESM pair from a versioned /public path so the browser loads them
 * natively and never mixes a main bundle with another version's worker.
 * (Since 6.13 each bundle is whole; maplibre-gl-shared.mjs ships empty.)
 */
const { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const pkg = require(join(root, "node_modules", "maplibre-gl", "package.json"));
const version = String(pkg.version);
const src = join(root, "node_modules", "maplibre-gl", "dist");
const destRoot = join(root, "public", "maplibre");
const dest = join(destRoot, version);
const files = ["maplibre-gl.mjs", "maplibre-gl-worker.mjs"];

if (!existsSync(join(src, files[0]))) {
  console.warn("copy-maplibre-worker: maplibre-gl is not installed, skipping");
  process.exit(0);
}

mkdirSync(destRoot, { recursive: true });
for (const stale of [...files, "maplibre-gl-shared.mjs", "boot.mjs"]) {
  const prev = join(destRoot, stale);
  if (existsSync(prev)) rmSync(prev);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const file of files) {
  copyFileSync(join(src, file), join(dest, file));
}

writeFileSync(
  join(dest, "boot.mjs"),
  `import * as maplibre from "./maplibre-gl.mjs";
maplibre.setWorkerUrl(new URL("./maplibre-gl-worker.mjs", import.meta.url).href);
globalThis.__letsraceMapLibre = maplibre;
`,
);

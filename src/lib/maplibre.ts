import type * as MapLibreNS from "maplibre-gl";

export type MapLibreModule = typeof MapLibreNS;

/** Must match `scripts/copy-maplibre-worker.cjs` (maplibre-gl package version). */
export const MAPLIBRE_ASSET_DIR = "/maplibre/6.6.0";

type MapLibreWindow = Window & { __startlineMapLibre?: MapLibreModule };

let pending: Promise<MapLibreModule> | null = null;

/**
 * Load MapLibre from /public so the main thread and worker share one
 * transfer registry. Importing `maplibre-gl` through Turbopack (or using
 * `import()` from a bundled module) breaks the native ESM graph.
 */
export function loadMapLibre(): Promise<MapLibreModule> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MapLibre is browser-only"));
  }
  const w = window as MapLibreWindow;
  if (w.__startlineMapLibre) return Promise.resolve(w.__startlineMapLibre);
  if (pending) return pending;

  pending = new Promise<MapLibreModule>((resolve, reject) => {
    const src = `${MAPLIBRE_ASSET_DIR}/boot.mjs`;
    const fail = (err: Error) => {
      pending = null;
      reject(err);
    };
    const script = document.createElement("script");
    script.type = "module";
    script.src = src;
    script.addEventListener("load", () => {
      const ml = w.__startlineMapLibre;
      if (ml) resolve(ml);
      else fail(new Error("MapLibre boot module did not initialize"));
    });
    script.addEventListener("error", () => fail(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });

  return pending;
}

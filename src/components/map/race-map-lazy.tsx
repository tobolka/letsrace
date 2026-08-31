"use client";

import dynamic from "next/dynamic";
import { useEffect, type ComponentProps } from "react";
import { loadMapLibre, MAPLIBRE_ASSET_DIR } from "@/lib/maplibre";

export type { MapBounds, BoundsChangeReason } from "@/components/map/race-map";

function MapWarmup() {
  return (
    <div
      className="h-full w-full bg-[#e8e4dc]"
      aria-busy="true"
      aria-label="Loading map"
      style={{
        backgroundImage:
          "linear-gradient(180deg, #dfe8d8 0%, #e8e4dc 42%, #dde6ef 100%)",
      }}
    />
  );
}

/** Kick the MapLibre ESM graph as early as this module evaluates in the browser. */
function preloadMapLibre() {
  if (typeof document === "undefined") return;
  const href = `${MAPLIBRE_ASSET_DIR}/boot.mjs`;
  if (document.querySelector(`link[rel="modulepreload"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "modulepreload";
  link.href = href;
  document.head.appendChild(link);
  void loadMapLibre().catch(() => undefined);
}

if (typeof window !== "undefined") preloadMapLibre();

/**
 * Map is the product — start it as soon as the explore shell mounts.
 * `dynamic` only keeps MapLibre out of SSR HTML / the first chrome chunk.
 */
const RaceMapInner = dynamic(
  () => import("@/components/map/race-map").then((m) => ({ default: m.RaceMap })),
  {
    ssr: false,
    loading: () => <MapWarmup />,
  },
);

export function RaceMapLazy(props: ComponentProps<typeof RaceMapInner>) {
  useEffect(() => {
    preloadMapLibre();
  }, []);

  return <RaceMapInner {...props} />;
}

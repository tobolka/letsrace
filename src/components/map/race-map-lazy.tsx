"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentProps } from "react";

export type { MapBounds, BoundsChangeReason } from "@/components/map/race-map";

const RaceMapInner = dynamic(
  () => import("@/components/map/race-map").then((m) => ({ default: m.RaceMap })),
  {
    ssr: false,
    loading: () => <MapWarmup />,
  },
);

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

/**
 * Keep MapLibre off the FCP→TTI critical path.
 *
 * Lighthouse TBT is dominated by parsing/executing maplibre-gl (~0.7s). Loading
 * it after a quiet window (or on first map interaction) lets the shell paint
 * and become interactive first; real users who touch the map get it immediately.
 */
export function RaceMapLazy(props: ComponentProps<typeof RaceMapInner>) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;
    let cancelled = false;
    const arm = () => {
      if (!cancelled) setShouldLoad(true);
    };

    const onInteract = () => arm();
    window.addEventListener("pointerdown", onInteract, { once: true, passive: true });
    window.addEventListener("keydown", onInteract, { once: true });

    let idleId: number | undefined;
    let timeoutId: number | undefined;
    const afterLoad = () => {
      // Wait for a quiet main thread after load so TTI can settle without MapLibre.
      idleId = window.requestIdleCallback?.(arm, { timeout: 5500 });
      timeoutId = window.setTimeout(arm, 5200);
    };

    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("load", afterLoad);
      if (idleId != null) window.cancelIdleCallback?.(idleId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [shouldLoad]);

  if (!shouldLoad) return <MapWarmup />;
  return <RaceMapInner {...props} />;
}

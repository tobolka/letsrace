"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentProps } from "react";

export type { MapBounds, BoundsChangeReason } from "@/components/map/race-map";

/** The same ground the route's skeleton paints, so the handover is invisible. */
function MapGround() {
  return <div aria-hidden className="h-full w-full animate-pulse bg-stone-200" />;
}

const RaceMapInner = dynamic(
  () => import("@/components/map/race-map").then((m) => ({ default: m.RaceMap })),
  {
    ssr: false,
    /**
     * This is the fallback that actually runs — a Suspense boundary further up
     * never gets the chance, because `dynamic` handles the wait itself. Bare
     * "Loading map…" text in the middle of the screen was the one part of the
     * load that announced a wait rather than showed progress.
     */
    loading: () => <MapGround />,
  },
);

/**
 * Start the map right after the first frame is on screen.
 *
 * One quiet frame is enough so the chrome can paint; anything longer is the
 * visitor staring at a pulsing stone slab. This is a map product — the map
 * is the product.
 */
function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const go = () => {
      if (!cancelled) setReady(true);
    };

    const raf = requestAnimationFrame(() => requestAnimationFrame(go));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return ready;
}

export function RaceMapLazy(props: ComponentProps<typeof RaceMapInner>) {
  const ready = useAfterFirstPaint();
  if (!ready) return <MapGround />;
  return <RaceMapInner {...props} />;
}

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
 * Hold the map back until the browser has drawn a frame.
 *
 * MapLibre is 280 kB of JavaScript and evaluating it saturated the main thread
 * for two and a half seconds. On a phone that was 78% of the LCP: the intro
 * card's image had finished downloading and then waited four and a half
 * seconds for a thread free enough to paint it.
 *
 * Nothing is saved by starting sooner — the map cannot be interacted with
 * before it is parsed either way — so the parse goes after the first paint
 * rather than in front of it. The timeout is the ceiling: on a page that never
 * goes idle the map must still arrive.
 */
function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const go = () => {
      if (!cancelled) setReady(true);
    };

    // Two frames: the first is scheduled before this paint, the second lands
    // after the browser has actually put something on screen.
    const raf = requestAnimationFrame(() => requestAnimationFrame(go));

    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle
      ? window.requestIdleCallback(go, { timeout: 1000 })
      : window.setTimeout(go, 200);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (hasIdle) window.cancelIdleCallback(idle as number);
      else window.clearTimeout(idle as number);
    };
  }, []);

  return ready;
}

export function RaceMapLazy(props: ComponentProps<typeof RaceMapInner>) {
  const ready = useAfterFirstPaint();
  if (!ready) return <MapGround />;
  return <RaceMapInner {...props} />;
}

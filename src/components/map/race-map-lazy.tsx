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
 * Hold MapLibre until the intro photograph has been able to paint.
 *
 * Listening for "any LCP" was too eager: a small text node counted, MapLibre
 * started downloading, and the real LCP image then sat unpainted behind that
 * parse. Waiting for the intro <img> (when present) plus a settled idle gap
 * keeps the megabyte of map code off the critical path.
 */
function useAfterIntroPaint(ceilingMs = 3500): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let imgReady = false;
    let idleReady = false;
    let done = false;

    const finish = () => {
      if (cancelled || done) return;
      if (!imgReady || !idleReady) return;
      done = true;
      requestAnimationFrame(() => {
        if (!cancelled) setReady(true);
      });
    };

    const markImg = () => {
      imgReady = true;
      finish();
    };
    const markIdle = () => {
      idleReady = true;
      finish();
    };

    // Returning visitors never show the card — don't wait on its hidden <img>.
    if (document.documentElement.dataset.welcomeSeen === "1") {
      markImg();
    } else {
      const img = document.querySelector<HTMLImageElement>('img[src*="intro-race"]');
      if (!img || img.complete) markImg();
      else {
        img.addEventListener("load", markImg, { once: true });
        img.addEventListener("error", markImg, { once: true });
      }
    }

    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle
      ? window.requestIdleCallback(markIdle, { timeout: 2000 })
      : window.setTimeout(markIdle, 400);

    const ceiling = window.setTimeout(() => {
      imgReady = true;
      idleReady = true;
      finish();
    }, ceilingMs);

    return () => {
      cancelled = true;
      window.clearTimeout(ceiling);
      if (hasIdle) window.cancelIdleCallback(idle as number);
      else window.clearTimeout(idle as number);
    };
  }, [ceilingMs]);

  return ready;
}

export function RaceMapLazy(props: ComponentProps<typeof RaceMapInner>) {
  const ready = useAfterIntroPaint();
  if (!ready) return <MapGround />;
  return <RaceMapInner {...props} />;
}

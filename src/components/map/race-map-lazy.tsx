"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

export type { MapBounds, BoundsChangeReason } from "@/components/map/race-map";

const RaceMapInner = dynamic(
  () => import("@/components/map/race-map").then((m) => ({ default: m.RaceMap })),
  {
    ssr: false,
    /**
     * The same ground the route's skeleton paints, so the handover between the
     * two is invisible. This is the fallback that actually runs — a Suspense
     * boundary further up never gets the chance, because `dynamic` handles the
     * wait itself. Bare "Loading map…" text in the middle of the screen was the
     * one part of the load that announced a wait rather than showed progress.
     *
     * aria-hidden: the list beside it carries the content, and a status region
     * with no readable text tells a screen reader nothing.
     */
    loading: () => (
      <div aria-hidden className="h-full w-full animate-pulse bg-stone-200" />
    ),
  },
);

export function RaceMapLazy(props: ComponentProps<typeof RaceMapInner>) {
  return <RaceMapInner {...props} />;
}

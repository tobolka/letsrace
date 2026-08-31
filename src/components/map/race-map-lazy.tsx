"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

export type { MapBounds, BoundsChangeReason } from "@/components/map/race-map";

const RaceMapInner = dynamic(
  () => import("@/components/map/race-map").then((m) => ({ default: m.RaceMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-stone-200 text-sm text-stone-500">
        Loading map…
      </div>
    ),
  },
);

export function RaceMapLazy(props: ComponentProps<typeof RaceMapInner>) {
  return <RaceMapInner {...props} />;
}

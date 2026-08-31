"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

export type { MapBounds, BoundsChangeReason } from "@/components/map/race-map";

const RaceMapInner = dynamic(
  () => import("@/components/map/race-map").then((m) => ({ default: m.RaceMap })),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-stone-100" aria-hidden />,
  },
);

export function RaceMapLazy(props: ComponentProps<typeof RaceMapInner>) {
  return <RaceMapInner {...props} />;
}

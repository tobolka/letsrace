"use client";

import { useCallback, useState } from "react";
import type { MapBounds } from "@/components/map/types";

/**
 * What the shell knows about the map's camera.
 *
 * `bounds` is the box the panel leaves free, and it is the right one to decide
 * when more races have to be fetched. `cameraBounds` is what the camera
 * actually shows, insets and all; it is the one that decides what the list
 * names — `bounds` is inset on every side, so a pin plainly visible near the
 * bottom of the map fell out of the list beside it. `flyTo` asks the map to
 * move to a box, and the map answers when the sequence number changes.
 */
export function useMapCamera() {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [cameraBounds, setCameraBounds] = useState<MapBounds | null>(null);
  const [destination, setDestination] = useState<MapBounds | null>(null);
  const [destinationSeq, setDestinationSeq] = useState(0);
  const flyTo = useCallback((box: MapBounds) => {
    setDestination(box);
    setDestinationSeq((n) => n + 1);
  }, []);
  return { bounds, setBounds, cameraBounds, setCameraBounds, destination, destinationSeq, flyTo };
}

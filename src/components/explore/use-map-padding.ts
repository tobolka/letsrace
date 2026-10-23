"use client";

import { useDeferredValue, useMemo } from "react";
import type { MapPadding } from "@/components/map/types";

/**
 * How much of the map the interface covers, as the camera should treat it.
 *
 * On a phone it is the sheet at its current height, but never so much that
 * the map is left with less than 45% of the screen: the sheet at full height
 * left a fifty-pixel strip, and easing a race into a strip that size zooms the
 * map out to the whole of Europe to make it fit. On a desktop the list panel
 * sits beside the map, not on it, so only the race card floats over the
 * camera's left edge.
 */
export function mapPaddingFor(opts: {
  isDesktop: boolean;
  hasCard: boolean;
  /** The sheet's snap: a share of the screen (0–1) or a CSS length in px. */
  snap: number | string;
  viewportH: number;
}): MapPadding {
  const { isDesktop, hasCard, snap, viewportH } = opts;
  if (!isDesktop) {
    const snapPx =
      typeof snap === "number" ? viewportH * snap : Number.parseFloat(snap) || viewportH * 0.5;
    const open = Math.round(Math.min(snapPx, viewportH * 0.55, 640));
    return { top: 16, right: 12, bottom: open + 12, left: 12 };
  }
  const detailW = hasCard ? 320 + 12 : 0;
  return { top: 16, right: 56, bottom: 56, left: detailW + 48 };
}

/**
 * The sheet's height while it is moving is not the map's business.
 *
 * Dragging the sheet set `listSnap`, which recomputed the map's padding, which
 * handed the map a new object, which re-rendered the map and the whole list —
 * every frame, while the browser was animating a full-height translate.
 * Deferring it lets React finish the sheet at the frame rate and catch the
 * map up when it settles.
 */
export function useMapPadding(opts: {
  isDesktop: boolean;
  hasCard: boolean;
  listSnap: number | string;
  detailSnap: number;
  viewportH: number;
}): MapPadding {
  const { isDesktop, hasCard, viewportH } = opts;
  const listSnap = useDeferredValue(opts.listSnap);
  const detailSnap = useDeferredValue(opts.detailSnap);
  const snap = hasCard ? detailSnap : listSnap;
  return useMemo(
    () => mapPaddingFor({ isDesktop, hasCard, snap, viewportH }),
    [isDesktop, hasCard, snap, viewportH],
  );
}

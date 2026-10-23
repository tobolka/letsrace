"use client";

import { useCallback, useEffect } from "react";
import { parseAsInteger, useQueryState } from "nuqs";
import { RADIUS_PARAM } from "@/lib/explore-params";

const RADIUS_STORAGE_KEY = "letsrace.explore.radius.v1";

/**
 * The distance filter: `?radius=` in the address, remembered on this device.
 *
 * A link that names a radius wins; a bare visit gets the one last chosen on
 * the map, the list or the calendar. Asking where the visitor is, and what to
 * do with the answer, is the caller's business.
 */
export function useRadiusParam() {
  const [radius, setRadiusParam] = useQueryState(RADIUS_PARAM, parseAsInteger);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has(RADIUS_PARAM)) return;
    try {
      const saved = Number(localStorage.getItem(RADIUS_STORAGE_KEY));
      if (saved > 0) void setRadiusParam(saved);
    } catch {
      /* storage blocked */
    }
    // Restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRadius = useCallback(
    (km: number | null) => {
      try {
        if (km == null) localStorage.removeItem(RADIUS_STORAGE_KEY);
        else localStorage.setItem(RADIUS_STORAGE_KEY, String(km));
      } catch {
        /* storage blocked */
      }
      void setRadiusParam(km);
    },
    [setRadiusParam],
  );

  return { radius, setRadius };
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLoadEffect } from "@/hooks/use-load-effect";
import {
  readExploreFilterPrefs,
  storedExploreFiltersToPatch,
  urlHasExploreFilterParams,
  writeExploreFilterPrefs,
  type ExploreFilterPatch,
} from "@/lib/explore-filter-storage";

/**
 * Filters that outlive the visit.
 *
 * A URL that names filters wins; a bare visit gets what the last one left
 * behind. `ready` turns true once that is settled, and until then nothing is
 * written back, so the defaults of a fresh page cannot overwrite what was
 * saved. `onRestored` runs after the saved filters have reached the address,
 * for a view that has data of its own to refresh for them.
 */
export function useExploreFilterPrefs(
  filters: ExploreFilterPatch,
  setFilters: (patch: ExploreFilterPatch) => Promise<unknown>,
  onRestored?: (patch: ExploreFilterPatch) => void,
): boolean {
  const [ready, setReady] = useState(false);
  const onRestoredRef = useRef(onRestored);
  useLayoutEffect(() => {
    onRestoredRef.current = onRestored;
  });

  // Restored once on mount.
  useLoadEffect(async () => {
    const stored = urlHasExploreFilterParams(window.location.search) ? null : readExploreFilterPrefs();
    if (stored) {
      const patch = storedExploreFiltersToPatch(stored);
      await setFilters(patch);
      onRestoredRef.current?.(patch);
    }
    setReady(true);
  }, []);

  const { q, categories, disciplines, levels, series, country, sort, dateFrom, dateTo } = filters;
  useEffect(() => {
    if (!ready) return;
    writeExploreFilterPrefs({ q, categories, disciplines, levels, series, country, sort, dateFrom, dateTo });
  }, [ready, q, categories, disciplines, levels, series, country, sort, dateFrom, dateTo]);

  return ready;
}

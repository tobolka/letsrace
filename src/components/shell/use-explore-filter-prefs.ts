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
  const filtersRef = useRef(filters);
  useLayoutEffect(() => {
    onRestoredRef.current = onRestored;
    filtersRef.current = filters;
  });

  // What a shared link put in the address. It is the sender's choice, not
  // this visitor's: saved, it came back on every later bare visit, and a
  // link to one race left the calendar showing a single day. Nothing is
  // written until the filters move away from it by hand.
  const linkFilters = useRef<string | null>(null);

  // Restored once on mount.
  useLoadEffect(async () => {
    const fromLink = urlHasExploreFilterParams(window.location.search);
    if (fromLink) linkFilters.current = filterKey(filtersRef.current);
    const stored = fromLink ? null : readExploreFilterPrefs();
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
    const current = { q, categories, disciplines, levels, series, country, sort, dateFrom, dateTo };
    if (linkFilters.current != null) {
      if (filterKey(current) === linkFilters.current) return;
      linkFilters.current = null;
    }
    writeExploreFilterPrefs(current);
  }, [ready, q, categories, disciplines, levels, series, country, sort, dateFrom, dateTo]);

  return ready;
}

function filterKey(f: ExploreFilterPatch): string {
  return JSON.stringify([f.q, f.categories, f.disciplines, f.levels, f.series, f.country, f.sort, f.dateFrom, f.dateTo]);
}

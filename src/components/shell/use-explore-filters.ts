"use client";

import { useEffect, useState } from "react";
import { parseAsInteger, useQueryState, useQueryStates } from "nuqs";
import type { SeriesOption } from "@/components/explore/map-filter-bar";
import { seriesOutsideCountries } from "@/components/explore/map-filter-bar";
import { thisWeekendRange, todayIso } from "@/lib/date-presets";
import { filterSearchParams, RADIUS_PARAM } from "@/lib/explore-params";
import { useUserOrigin } from "@/hooks/use-user-origin";
import {
  readExploreFilterPrefs,
  storedExploreFiltersToPatch,
  urlHasExploreFilterParams,
  writeExploreFilterPrefs,
} from "@/lib/explore-filter-storage";
import { loadSeriesList } from "@/lib/series-list";

/**
 * The filters as the list and the schedule see them.
 *
 * The map keeps its own copy of this logic because every change there also has
 * to move a camera and refetch a viewport. These two views have no camera, so
 * a filter change is just a new URL — and the data hook watches the URL. The
 * semantics are the map's, deliberately: disciplines and countries add up, a
 * cup toggles off when pressed again, and a country choice that leaves out the
 * chosen cup's country drops the cup.
 */
const RADIUS_STORAGE_KEY = "letsrace.explore.radius.v1";

export function useExploreFilters() {
  const [filters, setFilters] = useQueryStates(filterSearchParams);
  const [ready, setReady] = useState(false);
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [radius, setRadiusParam] = useQueryState(RADIUS_PARAM, parseAsInteger);
  const place = useUserOrigin();
  const { status: placeStatus, locate } = place;

  // A link that carries a distance asks for the position the one time it has to.
  useEffect(() => {
    if (radius != null && placeStatus === "idle") locate();
  }, [radius, placeStatus, locate]);

  // The distance is kept like the other filters, so the list and the
  // calendar open with the radius last chosen on either.
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

  function setRadius(km: number | null) {
    try {
      if (km == null) localStorage.removeItem(RADIUS_STORAGE_KEY);
      else localStorage.setItem(RADIUS_STORAGE_KEY, String(km));
    } catch {
      /* storage blocked */
    }
    void setRadiusParam(km);
    if (km != null && place.status !== "ready") place.locate();
  }

  /** The distance in force: a radius only means something once we know where from. */
  const near = radius != null && place.origin ? { origin: place.origin, km: radius } : null;

  // Same rule as the map: a URL that names filters wins; a bare visit gets what
  // the last visit left behind.
  useEffect(() => {
    if (urlHasExploreFilterParams(window.location.search)) {
      setReady(true);
      return;
    }
    const stored = readExploreFilterPrefs();
    if (!stored) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void setFilters(storedExploreFiltersToPatch(stored)).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeExploreFilterPrefs({
      q: filters.q,
      categories: filters.categories,
      disciplines: filters.disciplines,
      levels: filters.levels,
      series: filters.series,
      country: filters.country,
      sort: filters.sort,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
  }, [
    ready,
    filters.q,
    filters.categories,
    filters.disciplines,
    filters.levels,
    filters.series,
    filters.country,
    filters.sort,
    filters.dateFrom,
    filters.dateTo,
  ]);

  useEffect(() => {
    let alive = true;
    void loadSeriesList("")
      .then((data) => {
        if (alive) setSeriesList(data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const actions = {
    onCategory: (value: string) => void setFilters({ categories: toggleIn(filters.categories, value) }),
    onDiscipline: (value: string) => void setFilters({ disciplines: toggleIn(filters.disciplines, value) }),
    onLevel: (value: string) => void setFilters({ levels: toggleIn(filters.levels, value) }),
    onClearDisciplines: () => void setFilters({ disciplines: [] }),
    onClearLevels: () => void setFilters({ levels: [] }),
    onClearCategories: () => void setFilters({ categories: [] }),
    onSeries: (slug: string) => void setFilters({ series: filters.series === slug ? "" : slug }),
    onCountry: (code: string) => {
      const next = toggleIn(filters.country, code);
      const row = seriesList.find((s) => s.slug === filters.series);
      const dropSeries = seriesOutsideCountries(row?.countryCode, filters.series, next);
      void setFilters({ country: next, ...(dropSeries ? { series: "" } : {}) });
    },
    onClearCountries: () => void setFilters({ country: [] }),
    onPreset: (dateFrom: string, dateTo: string) => void setFilters({ dateFrom, dateTo }),
    onQ: (q: string) => {
      // A search is a find, not a filter: the date window widens to upcoming so a
      // race in October is not missing because the bar still said "this weekend".
      const widen = q.trim().length >= 2 && filters.q.trim().length < 2;
      void setFilters({ q, ...(widen ? { dateFrom: todayIso(), dateTo: "" } : {}) });
    },
    onSearchSubmit: () => undefined,
  };

  function reset() {
    const w = thisWeekendRange();
    setResetKey((n) => n + 1);
    setRadius(null);
    void setFilters({
      q: null,
      categories: [],
      disciplines: [],
      levels: [],
      series: null,
      country: [],
      dateFrom: w.from,
      dateTo: w.to,
    });
  }

  return {
    filters,
    setFilters,
    ready,
    seriesList,
    resetKey,
    actions,
    reset,
    radius,
    setRadius,
    near,
    place,
  };
}

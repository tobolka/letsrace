"use client";

import { useEffect, useState } from "react";
import { useQueryStates } from "nuqs";
import { thisWeekendRange, todayIso } from "@/lib/date-presets";
import { countryChange, toggleIn } from "@/lib/explore-filters";
import { filterSearchParams } from "@/lib/explore-params";
import { useUserOrigin } from "@/hooks/use-user-origin";
import { useExploreFilterPrefs } from "@/components/shell/use-explore-filter-prefs";
import { useRadiusParam } from "@/components/shell/use-radius-param";
import { useSeriesList } from "@/components/shell/use-series-list";

/**
 * The filters as the list and the schedule see them.
 *
 * The map keeps its own copy of this wiring because every change there also
 * has to move a camera and refetch a viewport. These two views have no camera,
 * so a filter change is just a new URL — and the data hook watches the URL. The
 * semantics are the map's, deliberately (they share `lib/explore-filters`):
 * disciplines and countries add up, a cup toggles off when pressed again, and
 * a country choice that leaves out the chosen cup's country drops the cup.
 */
export function useExploreFilters() {
  const [filters, setFilters] = useQueryStates(filterSearchParams);
  const [resetKey, setResetKey] = useState(0);
  const { radius, setRadius: storeRadius } = useRadiusParam();
  const seriesList = useSeriesList();
  const place = useUserOrigin();
  const { status: placeStatus, locate } = place;
  const ready = useExploreFilterPrefs(filters, setFilters);

  // A link that carries a distance asks for the position the one time it has to.
  useEffect(() => {
    if (radius != null && placeStatus === "idle") locate();
  }, [radius, placeStatus, locate]);

  function setRadius(km: number | null) {
    storeRadius(km);
    if (km != null && place.status !== "ready") place.locate();
  }

  /** The distance in force: a radius only means something once we know where from. */
  const near = radius != null && place.origin ? { origin: place.origin, km: radius } : null;

  const actions = {
    onCategory: (value: string) => void setFilters({ categories: toggleIn(filters.categories, value) }),
    onDiscipline: (value: string) => void setFilters({ disciplines: toggleIn(filters.disciplines, value) }),
    onLevel: (value: string) => void setFilters({ levels: toggleIn(filters.levels, value) }),
    onClearDisciplines: () => void setFilters({ disciplines: [] }),
    onClearLevels: () => void setFilters({ levels: [] }),
    onClearCategories: () => void setFilters({ categories: [] }),
    onSeries: (slug: string) => void setFilters({ series: filters.series === slug ? "" : slug }),
    onCountry: (code: string) => {
      const { country, dropSeries } = countryChange(filters, toggleIn(filters.country, code), seriesList);
      void setFilters({ country, ...(dropSeries ? { series: "" } : {}) });
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

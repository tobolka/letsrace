"use client";

import { track } from "@/lib/analytics";
import { filterSnapshot } from "@/lib/analytics-product";
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
    track("filter_apply", { filter_type: "radius", ...(km ? { radius_km: km } : {}) });
    storeRadius(km);
    if (km != null && place.status !== "ready") place.locate();
  }

  /** The distance in force: a radius only means something once we know where from. */
  const near = radius != null && place.origin ? { origin: place.origin, km: radius } : null;

  function apply(patch: Partial<typeof filters>, filterType: string) {
    track("filter_apply", { filter_type: filterType, ...filterSnapshot({ ...filters, ...patch }, radius) });
    return setFilters(patch);
  }
  const actions = {
    onCategory: (value: string) => void apply({ categories: toggleIn(filters.categories, value) }, "category"),
    onDiscipline: (value: string) => void apply({ disciplines: toggleIn(filters.disciplines, value) }, "discipline"),
    onLevel: (value: string) => void apply({ levels: toggleIn(filters.levels, value) }, "level"),
    onClearDisciplines: () => void apply({ disciplines: [] }, "discipline"),
    onClearLevels: () => void apply({ levels: [] }, "level"),
    onClearCategories: () => void apply({ categories: [] }, "category"),
    onSeries: (slug: string) => void apply({ series: filters.series === slug ? "" : slug }, "series"),
    onCountry: (code: string) => {
      const { country, dropSeries } = countryChange(filters, toggleIn(filters.country, code), seriesList);
      void apply({ country, ...(dropSeries ? { series: "" } : {}) }, "country");
    },
    onClearCountries: () => void apply({ country: [] }, "country"),
    onPreset: (dateFrom: string, dateTo: string) => void apply({ dateFrom, dateTo }, "date"),
    onQ: (q: string) => {
      // A search is a find, not a filter: the date window widens to upcoming so a
      // race in October is not missing because the bar still said "this weekend".
      const widen = q.trim().length >= 2 && filters.q.trim().length < 2;
      void setFilters({ q, ...(widen ? { dateFrom: todayIso(), dateTo: "" } : {}) });
    },
    onSearchSubmit: () => { if (filters.q.trim().length >= 2) track("search_submit", { location: "catalogue" }); },
  };

  function reset() {
    track("filter_apply", { filter_type: "reset" });
    const w = thisWeekendRange();
    setResetKey((n) => n + 1);
    storeRadius(null);
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

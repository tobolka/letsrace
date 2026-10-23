"use client";

import type { ExploreFilters } from "@/components/explore/use-map-feed";
import { thisWeekendRange } from "@/lib/date-presets";
import type { EventListItem } from "@/lib/events";
import { countryChange, toggleIn, type SeriesOption } from "@/lib/explore-filters";

type Refetch = (overrides?: Record<string, unknown>) => Promise<EventListItem[] | null>;

/**
 * Every change the map's filters can make.
 *
 * Each one does the same two things: write the new value into the address,
 * and ask the feed for the list again with that value, because the address
 * only catches up a frame later. A cup or a country is a find rather than a
 * window, so choosing one drops the viewport from the query and fits the map
 * to the answer.
 */
export function useMapFilterActions({
  filters,
  setFilters,
  refetch,
  seriesList,
  resetBar,
  clearRadius,
}: {
  filters: ExploreFilters;
  setFilters: (patch: Record<string, unknown>) => Promise<unknown>;
  refetch: Refetch;
  seriesList: SeriesOption[];
  /** The filter bar remounts, so its open menus and drafts start clean. */
  resetBar: () => void;
  clearRadius: () => void;
}) {
  function toggleCategory(value: string) {
    const next = toggleIn(filters.categories, value);
    void setFilters({ categories: next });
    refetch({ categories: next });
  }

  function toggleDiscipline(value: string) {
    const next = toggleIn(filters.disciplines, value);
    void setFilters({ disciplines: next });
    refetch({ disciplines: next });
  }

  function toggleLevel(value: string) {
    const next = toggleIn(filters.levels, value);
    void setFilters({ levels: next });
    refetch({ levels: next });
  }

  function clearDisciplines() {
    void setFilters({ disciplines: [] });
    refetch({ disciplines: [] });
  }

  function clearLevels() {
    void setFilters({ levels: [] });
    refetch({ levels: [] });
  }


  function clearCategories() {
    void setFilters({ categories: [] });
    refetch({ categories: [] });
  }

  function resetExploreFilters(opts?: { clearSearch?: boolean }) {
    clearRadius();
    const w = thisWeekendRange();
    const clearSearch = opts?.clearSearch ?? false;
    resetBar();
    void setFilters({
      ...(clearSearch ? { q: null, e: null } : {}),
      categories: [],
      disciplines: [],
      levels: [],
      series: null,
      country: [],
      dateFrom: w.from,
      dateTo: w.to,
    });
    refetch({
      ...(clearSearch ? { q: "" } : {}),
      categories: [],
      disciplines: [],
      levels: [],
      series: "",
      country: [],
      dateFrom: w.from,
      dateTo: w.to,
      skipBounds: clearSearch,
      fitMap: clearSearch,
    });
  }

  function setSeries(slug: string) {
    const next = filters.series === slug ? "" : slug;
    void setFilters({ series: next });
    refetch({ series: next, skipBounds: Boolean(next) || filters.country.length > 0, fitMap: Boolean(next) });
  }

  function applySeries(slug: string) {
    void setFilters({ series: slug });
    refetch({
      series: slug,
      skipBounds: true,
      fitMap: true,
    });
  }

  function applyCountries(next: string[]) {
    const { dropSeries } = countryChange(filters, next, seriesList);
    void setFilters({ country: next, ...(dropSeries ? { series: "" } : {}) });
    refetch({
      country: next,
      ...(dropSeries ? { series: "" } : {}),
      skipBounds: next.length > 0 || Boolean(filters.series && !dropSeries),
      fitMap: next.length > 0,
    });
  }

  function toggleCountry(code: string) {
    applyCountries(toggleIn(filters.country, code));
  }

  function clearCountries() {
    applyCountries([]);
  }

  function setDateRange(dateFrom: string, dateTo: string) {
    void setFilters({ dateFrom, dateTo });
    refetch({ dateFrom, dateTo });
  }

  return {
    toggleCategory,
    toggleDiscipline,
    toggleLevel,
    clearDisciplines,
    clearLevels,
    clearCategories,
    resetExploreFilters,
    setSeries,
    applySeries,
    toggleCountry,
    clearCountries,
    setDateRange,
  };
}

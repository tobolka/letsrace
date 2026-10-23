"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { MobileTopBar } from "@/components/explore/mobile-top-bar";
import { MapFilterBar } from "@/components/explore/map-filter-bar";
import { dateFilterLabel } from "@/components/explore/date-range";
import { ActiveFilterChips, activeFilterGroups } from "@/components/shell/active-filters";
import { DistanceFilter } from "@/components/shell/distance-filter";
import type { useExploreFilters } from "@/components/shell/use-explore-filters";
import { useIsMobile } from "@/hooks/use-mobile";
import { datePresetRanges, type DatePresetId } from "@/lib/date-presets";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor, type Messages } from "@/lib/i18n/messages";

const MobileFiltersSheet = dynamic(() =>
  import("@/components/explore/mobile-filters-sheet").then((m) => ({ default: m.MobileFiltersSheet })),
);

type FilterState = ReturnType<typeof useExploreFilters>;

/** What each quick date choice is called, for the pill and its menu. */
export function datePresetLabels(t: Messages): Record<DatePresetId, string> {
  return {
    weekend: t.thisWeekend,
    nextWeekend: t.nextWeekend,
    upcoming: t.upcoming,
    thisMonth: t.thisMonth,
    nextMonth: t.nextMonth,
    any: t.anyDate,
  };
}

/** The filter row the map wears, fed by the shared filters instead of the map's. */
export function ExploreFilterBar({
  locale,
  state,
  hideDate,
  leading,
  filtersOpen,
  onFiltersOpenChange,
  resultCount,
}: {
  locale: string;
  state: FilterState;
  hideDate?: boolean;
  /** On a phone, in place of the date: the calendar's month. */
  leading?: ReactNode;
  /** The phone's filter panel, opened from here or from a chip under the row. */
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  resultCount?: number | null;
}) {
  const { filters, seriesList, resetKey, actions, radius, setRadius, place } = state;
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileFilterRow
        locale={locale}
        state={state}
        hideDate={hideDate}
        leading={leading}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={onFiltersOpenChange}
        resultCount={resultCount}
      />
    );
  }

  return (
    <MapFilterBar
      key={resetKey}
      messages={messagesFor(locale)}
      locale={locale}
      dateFrom={filters.dateFrom}
      dateTo={filters.dateTo}
      categories={filters.categories}
      disciplines={filters.disciplines}
      levels={filters.levels}
      series={filters.series}
      country={filters.country}
      seriesList={seriesList}
      q={filters.q}
      wide
      hideDate={hideDate}
      extra={<DistanceFilter locale={locale} radius={radius} status={place.status} onRadius={setRadius} />}
      {...actions}
    />
  );
}

/**
 * The phone's filters: one row that never scrolls sideways.
 *
 * The desktop row is a strip of menus, and on a phone it had to scroll — but a
 * menu opens the moment a finger lands on it, so every swipe to reach the next
 * chip opened the one under the thumb. Here the row is the date, the filters
 * and the search, and every other filter lives in one sheet from the bottom,
 * the same one the map uses.
 */
function MobileFilterRow({
  locale,
  state,
  hideDate,
  leading,
  filtersOpen,
  onFiltersOpenChange,
  resultCount,
}: {
  locale: string;
  state: FilterState;
  hideDate?: boolean;
  leading?: ReactNode;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  resultCount?: number | null;
}) {
  const t = messagesFor(locale);
  const { filters, seriesList, actions, radius, setRadius, reset } = state;
  const [searchOpen, setSearchOpen] = useState(false);
  const [customDate, setCustomDate] = useState(false);
  const labels = datePresetLabels(t);
  const presets = datePresetRanges(filters.dateFrom, filters.dateTo);

  return (
    <>
      <MobileTopBar
        leading={leading}
        dateLabel={hideDate ? undefined : dateFilterLabel(filters.dateFrom, filters.dateTo, labels, dateFnsLocale(locale))}
        dateCustom={!presets.some((p) => p.active)}
        dateChoices={presets.map((p) => ({
          id: p.id,
          label: labels[p.id],
          active: p.active,
          apply: () => actions.onPreset(p.from, p.to),
        }))}
        customDateLabel={t.customDate}
        onCustomDate={() => {
          setCustomDate(true);
          onFiltersOpenChange(true);
        }}
        filtersLabel={t.filtersButton}
        filterCount={activeFilterGroups({ ...filters, radius })}
        onFilters={() => {
          setCustomDate(false);
          onFiltersOpenChange(true);
        }}
        searchLabel={t.search}
        searchPlaceholder={t.searchPlaceholder}
        doneLabel={t.filtersDone}
        clearLabel={t.clearFilter}
        q={filters.q}
        onQ={actions.onQ}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
      />

      {filtersOpen ? (
        <MobileFiltersSheet
          open={filtersOpen}
          onOpenChange={onFiltersOpenChange}
          messages={t}
          locale={locale}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          categories={filters.categories}
          disciplines={filters.disciplines}
          levels={filters.levels}
          series={filters.series}
          country={filters.country}
          seriesList={seriesList}
          hideDate={hideDate}
          customDate={customDate}
          radius={radius}
          radiusStatus={state.place.status}
          onRadius={setRadius}
          resultCount={resultCount}
          onPreset={actions.onPreset}
          onCategory={actions.onCategory}
          onDiscipline={actions.onDiscipline}
          onLevel={actions.onLevel}
          onClearDisciplines={actions.onClearDisciplines}
          onClearLevels={actions.onClearLevels}
          onClearCategories={actions.onClearCategories}
          onSeries={actions.onSeries}
          onCountry={actions.onCountry}
          onClearCountries={actions.onClearCountries}
          onReset={reset}
        />
      ) : null}
    </>
  );
}

/** The chips under the phone's filter row, wired to the shared filters. */
export function ExploreActiveChips({
  locale,
  state,
  onOpenFilters,
  className,
}: {
  locale: string;
  state: FilterState;
  onOpenFilters: () => void;
  className?: string;
}) {
  const { filters, seriesList, actions, radius, setRadius } = state;
  return (
    <ActiveFilterChips
      locale={locale}
      filters={{ ...filters, radius }}
      seriesList={seriesList}
      onOpenFilters={onOpenFilters}
      className={className}
      onClearDisciplines={actions.onClearDisciplines}
      onClearCategories={actions.onClearCategories}
      onClearLevels={actions.onClearLevels}
      onClearCountries={actions.onClearCountries}
      onClearSeries={() => actions.onSeries(filters.series)}
      onClearRadius={() => setRadius(null)}
      onClearQ={() => actions.onQ("")}
    />
  );
}

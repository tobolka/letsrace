"use client";

import { MapFilterBar } from "@/components/explore/map-filter-bar";
import type { useExploreFilters } from "@/components/shell/use-explore-filters";
import { messagesFor } from "@/lib/i18n/messages";

/** The filter row the map wears, fed by the shared filters instead of the map's. */
export function ExploreFilterBar({
  locale,
  state,
  hideDate,
}: {
  locale: string;
  state: ReturnType<typeof useExploreFilters>;
  hideDate?: boolean;
}) {
  const { filters, seriesList, resetKey, actions } = state;
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
      {...actions}
    />
  );
}

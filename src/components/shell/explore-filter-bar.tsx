"use client";

import { MapFilterBar } from "@/components/explore/map-filter-bar";
import { DistanceFilter } from "@/components/shell/distance-filter";
import type { useExploreFilters } from "@/components/shell/use-explore-filters";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const { filters, seriesList, resetKey, actions, radius, setRadius, place } = state;
  // A phone gets the map sheet's row — every chip in one line that scrolls —
  // rather than a desktop's wrap, which stacked three rows over the content.
  const isMobile = useIsMobile();
  const bar = (
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
      wide={!isMobile}
      allFilters={isMobile}
      hideDate={hideDate}
      extra={
        <DistanceFilter locale={locale} radius={radius} status={place.status} onRadius={setRadius} />
      }
      {...actions}
    />
  );
  return isMobile ? (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{bar}</div>
  ) : (
    bar
  );
}

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { format, parseISO } from "date-fns";
import { LocateFixed } from "lucide-react";
import { MobileTopBar } from "@/components/explore/mobile-top-bar";
import { MapFilterBar } from "@/components/explore/map-filter-bar";
import { DistanceFilter } from "@/components/shell/distance-filter";
import type { useExploreFilters } from "@/components/shell/use-explore-filters";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { thisWeekendRange } from "@/lib/date-presets";
import { RADIUS_OPTIONS } from "@/lib/explore-params";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";

const MobileFiltersSheet = dynamic(() =>
  import("@/components/explore/mobile-filters-sheet").then((m) => ({ default: m.MobileFiltersSheet })),
);
const MobileSearchSheet = dynamic(() =>
  import("@/components/explore/mobile-search-sheet").then((m) => ({ default: m.MobileSearchSheet })),
);

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
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileFilterRow locale={locale} state={state} hideDate={hideDate} />;
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
 * chip opened the one under the thumb. Here the row is two buttons and a
 * search, and every filter lives in one sheet from the bottom, the same one
 * the map uses.
 */
function MobileFilterRow({
  locale,
  state,
  hideDate,
}: {
  locale: string;
  state: ReturnType<typeof useExploreFilters>;
  hideDate?: boolean;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const { filters, seriesList, actions, radius, setRadius, reset } = state;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const weekend = thisWeekendRange();
  const isThisWeekend = filters.dateFrom === weekend.from && filters.dateTo === weekend.to;
  const dateLabel = isThisWeekend
    ? t.thisWeekend
    : filters.dateFrom && filters.dateTo
      ? `${format(parseISO(filters.dateFrom), "d MMM", { locale: df })} – ${format(parseISO(filters.dateTo), "d MMM", { locale: df })}`
      : filters.dateFrom
        ? format(parseISO(filters.dateFrom), "d MMM", { locale: df })
        : t.anyDate;
  const count =
    (filters.disciplines.length ? 1 : 0) +
    (filters.categories.length ? 1 : 0) +
    (filters.levels.length ? 1 : 0) +
    (filters.country.length ? 1 : 0) +
    (filters.series ? 1 : 0) +
    (radius != null ? 1 : 0);


  // The very row the map uses — the same pills, the same "Filter" with its
  // count, the same search — so every screen reads alike.
  return (
    <div>
      <MobileTopBar
        className="px-0 pb-0"
        hideWeekend={hideDate}
        weekendLabel={dateLabel}
        weekendActive={isThisWeekend}
        onWeekend={() => {
          if (isThisWeekend) {
            setFiltersOpen(true);
            return;
          }
          actions.onPreset(weekend.from, weekend.to);
        }}
        filtersLabel={t.addFilter}
        filterCount={count}
        onFilters={() => setFiltersOpen(true)}
        searchLabel={t.search}
        searchActive={Boolean(filters.q.trim())}
        onSearch={() => setSearchOpen(true)}
      />

      {filtersOpen ? (
        <MobileFiltersSheet
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
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
          extra={
            <section className="flex flex-col gap-2.5">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <LocateFixed className="size-3.5" aria-hidden />
                {t.distanceFilter}
              </h3>
              <div className="flex flex-wrap gap-2">
                {[null, ...RADIUS_OPTIONS].map((km) => {
                  const active = radius === km;
                  return (
                    <Button
                      key={km ?? "any"}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      className="h-11 shrink-0 rounded-full px-3.5 text-sm"
                      aria-pressed={active}
                      onClick={() => setRadius(km)}
                    >
                      {km == null ? t.distanceAny : t.distanceWithin.replace("{km}", String(km))}
                    </Button>
                  );
                })}
              </div>
              {radius != null && state.place.status === "denied" ? (
                <p className="text-xs text-muted-foreground">{t.distanceDenied}</p>
              ) : null}
            </section>
          }
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
      {searchOpen ? (
        <MobileSearchSheet
          open={searchOpen}
          onOpenChange={setSearchOpen}
          messages={t}
          q={filters.q}
          onQ={actions.onQ}
          onSubmit={() => setSearchOpen(false)}
        />
      ) : null}
    </div>
  );
}

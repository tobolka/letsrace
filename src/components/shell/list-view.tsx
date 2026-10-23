"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventCard } from "@/components/explore/event-rows";
import { ColumnPicker } from "@/components/shell/column-picker";
import { RaceTable, sortTableEvents, type ListSort } from "@/components/shell/race-table";
import { ListSkeleton } from "@/components/explore/list-skeleton";
import { ExploreActiveChips, ExploreFilterBar } from "@/components/shell/explore-filter-bar";
import { ListMetaRow } from "@/components/shell/active-filters";
import { useLinkedRace, useRaceParam } from "@/components/shell/use-race-param";
import { RacePreview } from "@/components/shell/race-preview";
import { SectionHeader } from "@/components/shell/section-header";
import { useExploreFilters } from "@/components/shell/use-explore-filters";
import { useRaceFeed } from "@/components/shell/use-race-feed";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { eventDistanceKm, sortEvents, type EventSort } from "@/lib/geo/distance";
import { messagesFor } from "@/lib/i18n/messages";
import { listViewState } from "@/lib/list-view-state";
import { DEFAULT_LAYOUT, readLayout, writeLayout, type ColumnLayout, type ListColumn } from "@/lib/list-columns";

/**
 * Every race that matches, on a page of its own.
 *
 * The map's panel is a strip beside a picture; this is the same list given the
 * whole screen, which is what looking around a season needs — more columns, no
 * camera deciding what counts as "here", and the filters that were set on the
 * map still set.
 */
export function ListView({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const state = useExploreFilters();
  const { filters, setFilters, ready, reset, near, place } = state;
  const feed = useRaceFeed(filters, ready, near);
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const race = useRaceParam();
  const origin = place.origin;

  const sort: EventSort = filters.sort === "distance" && origin ? "distance" : "date";
  const [tableSort, setTableSort] = useState<ListSort | null>(null);
  const activeSort: ListSort = tableSort ?? { column: sort, direction: "asc" };
  const rows = useMemo(() => sortTableEvents(sortEvents(feed.events, "date", origin), { column: tableSort?.column ?? sort, direction: tableSort?.direction ?? "asc" }, locale, origin), [feed.events, sort, tableSort, locale, origin]);
  const selected = useLinkedRace(race.slug, feed.events);
  const selectedId = selected?.id ?? null;
  const bySlug = useMemo(() => new Map(feed.events.map((e) => [e.id, e.slug])), [feed.events]);
  const openRace = useCallback(
    (id: string) => {
      const slug = bySlug.get(id);
      if (slug) race.open(slug);
    },
    [bySlug, race],
  );
  const view = listViewState({ settled: feed.settled, count: rows.length });

  const [layout, setLayoutState] = useState<ColumnLayout>(DEFAULT_LAYOUT);
  // Read after mount: the server renders the default and local storage only
  // exists here.
  useEffect(() => setLayoutState(readLayout()), []);
  function setLayout(next: ColumnLayout | null) {
    setLayoutState(next ?? DEFAULT_LAYOUT);
    writeLayout(next);
  }
  const columns = layout.order.filter((c) => !layout.hidden.includes(c));
  const labels: Record<ListColumn, string> = {
    date: t.colDate,
    name: t.colName,
    place: t.colPlace,
    country: t.colCountry,
    discipline: t.colDiscipline,
    level: t.colLevel,
    categories: t.colCategories,
    series: t.colSeries,
    distance: t.colDistance,
  };
  const isDefault = JSON.stringify(layout) === JSON.stringify(DEFAULT_LAYOUT);

  function setSort(next: EventSort) {
    setTableSort(null);
    void setFilters({ sort: next === "distance" ? "distance" : null });
    // Choosing distance is what asks for the position, as it is on the map.
    if (next === "distance" && !origin) place.locate();
  }

  function sortColumn(column: ListColumn) {
    setTableSort({ column, direction: activeSort.column === column && activeSort.direction === "asc" ? "desc" : "asc" });
    if (column === "date" || column === "distance") {
      void setFilters({ sort: column === "distance" ? "distance" : null });
    }
    if (column === "distance" && !origin) place.locate();
  }

  return (
    <div className="absolute inset-0 flex">
      <section className="flex min-w-0 flex-1 flex-col">
        <SectionHeader title={t.navList} brandHref={`/${locale}`}>
          <ExploreFilterBar
            locale={locale}
            state={state}
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            resultCount={feed.settled ? rows.length : null}
          />
        </SectionHeader>

        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-4 max-md:hidden">
          <span
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums"
            aria-live="polite"
            aria-busy={feed.loading}
          >
            {feed.settled ? `${rows.length} ${t.racesCount}` : <span aria-hidden className="h-3 w-20 animate-pulse rounded bg-muted" />}
            <span className="inline-flex size-4 items-center justify-center" aria-hidden={!feed.loading}>
              {feed.loading ? <Spinner className="size-3.5" /> : null}
            </span>
          </span>
          <div className="flex items-center gap-1">
          {isMobile ? null : (
            <ColumnPicker
              layout={layout}
              labels={labels}
              title={t.listColumns}
              resetLabel={t.listColumnsReset}
              isDefault={isDefault}
              onChange={setLayout}
              onReset={() => setLayout(null)}
            />
          )}
          <ToggleGroup
            type="single"
            variant="outline"
            size="xs"
            value={activeSort.column === "date" || activeSort.column === "distance" ? activeSort.column : ""}
            onValueChange={(value) => {
              if (value === "date" || value === "distance") setSort(value);
            }}
            aria-label={t.sortBy}
          >
            <ToggleGroupItem value="date" className="data-[state=on]:bg-foreground data-[state=on]:text-background">
              {t.date}
            </ToggleGroupItem>
            <ToggleGroupItem value="distance" className="data-[state=on]:bg-foreground data-[state=on]:text-background">
              {t.sortDistance}
            </ToggleGroupItem>
          </ToggleGroup>
          </div>
        </div>

        <div id="race-list" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none [&>[data-slot=table-container]]:overflow-x-visible">
          {/* On a phone the count and the order head the list and scroll away
              with it; only the filter row above stays. */}
          {isMobile ? (
            <div className="border-b border-border/50">
              <ExploreActiveChips locale={locale} state={state} onOpenFilters={() => setFiltersOpen(true)} className="pb-0" />
              <ListMetaRow
                locale={locale}
                count={feed.settled ? rows.length : null}
                loading={feed.loading}
                sort={activeSort.column === "distance" ? "distance" : "date"}
                onSort={setSort}
              />
            </div>
          ) : null}
          {view === "empty" ? (
            <Empty className="border-0 p-8">
              <EmptyHeader>
                <EmptyTitle>{t.noResults}</EmptyTitle>
                <EmptyDescription>{t.weekendNearYou}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button type="button" variant="outline" size="sm" onClick={reset}>
                  {t.clearFilters}
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              {view === "skeleton" ? (
                <ItemGroup>
                  <ListSkeleton rows={10} />
                </ItemGroup>
              ) : null}
              {view === "rows" && isMobile ? (
                <ItemGroup className="pb-[env(safe-area-inset-bottom)]">
                  {rows.map((event) => (
                    <div role="listitem" key={event.id} className="border-b border-border/50 last:border-b-0">
                      <EventCard
                        event={event}
                        locale={locale}
                        distanceKm={eventDistanceKm(event, origin)}
                        active={event.id === selectedId}
                        onSelect={openRace}
                        wrapName
                      />
                    </div>
                  ))}
                </ItemGroup>
              ) : null}
              {view === "rows" && !isMobile ? (
                <RaceTable
                  events={rows}
                  columns={columns}
                  labels={labels}
                  locale={locale}
                  origin={origin}
                  selectedId={selectedId}
                  onSelect={openRace}
                  sort={activeSort}
                  onSort={sortColumn}
                />
              ) : null}
            </>
          )}
        </div>
      </section>

      <RacePreview
        event={selected}
        locale={locale}
        onClose={race.close}
        onSelectSeries={(slug) => {
          race.drop();
          void setFilters({ series: slug });
        }}
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { EventCard, EventRowWide } from "@/components/explore/event-rows";
import { ListSkeleton } from "@/components/explore/list-skeleton";
import { ExploreFilterBar } from "@/components/shell/explore-filter-bar";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const origin = place.origin;

  const sort: EventSort = filters.sort === "distance" && origin ? "distance" : "date";
  const rows = useMemo(() => sortEvents(feed.events, sort, origin), [feed.events, sort, origin]);
  const selected = useMemo(
    () => feed.events.find((e) => e.id === selectedId) ?? null,
    [feed.events, selectedId],
  );
  const view = listViewState({ settled: feed.settled, count: rows.length });

  function setSort(next: EventSort) {
    void setFilters({ sort: next === "distance" ? "distance" : null });
    // Choosing distance is what asks for the position, as it is on the map.
    if (next === "distance" && !origin) place.locate();
  }

  return (
    <div className="absolute inset-0 flex">
      <section className="flex min-w-0 flex-1 flex-col">
        <SectionHeader title={t.navList}>
          <ExploreFilterBar locale={locale} state={state} />
        </SectionHeader>

        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 md:px-6">
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
          <ToggleGroup
            type="single"
            variant="outline"
            size="xs"
            value={sort}
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

        <div id="race-list" tabIndex={-1} className="@container min-h-0 flex-1 overflow-y-auto outline-none">
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
            <ItemGroup>
              {view === "skeleton" ? <ListSkeleton rows={10} /> : null}
              {view === "rows"
                ? rows.map((event) => (
                    <div role="listitem" key={event.id} className="border-b border-border/50 last:border-b-0">
                      {isMobile ? (
                        <EventCard
                          event={event}
                          locale={locale}
                          distanceKm={eventDistanceKm(event, origin)}
                          active={event.id === selectedId}
                          onSelect={setSelectedId}
                        />
                      ) : (
                        <EventRowWide
                          event={event}
                          locale={locale}
                          distanceKm={eventDistanceKm(event, origin)}
                          active={event.id === selectedId}
                          onSelect={setSelectedId}
                        />
                      )}
                    </div>
                  ))
                : null}
            </ItemGroup>
          )}
        </div>
      </section>

      <RacePreview
        event={selected}
        locale={locale}
        onClose={() => setSelectedId(null)}
        onSelectSeries={(slug) => {
          setSelectedId(null);
          void setFilters({ series: slug });
        }}
      />
    </div>
  );
}

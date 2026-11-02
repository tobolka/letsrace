"use client";

import { Suspense, type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { RaceMapLazy as RaceMap } from "@/components/map/race-map-lazy";
import { MapFilterBar } from "@/components/explore/map-filter-bar";
import { WelcomeCard } from "@/components/explore/welcome-card";
import { Button } from "@/components/ui/button";
import { COMPACT } from "@/components/explore/mobile-sheets";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventListItem } from "@/lib/events";
import type { Messages } from "@/lib/i18n/messages";
import { coldStartCenter } from "@/lib/coverage";
import {
  distanceKm,
  type EventSort,
} from "@/lib/geo/distance";
import Link from "next/link";
import { datePresetRanges } from "@/lib/date-presets";
import { exploreSearchParams } from "@/lib/explore-params";
import { useMapCamera } from "@/components/explore/use-map-camera";
import { useMapFilterActions } from "@/components/explore/use-map-filter-actions";
import { useMapFeed } from "@/components/explore/use-map-feed";
import { useMapViewport } from "@/components/explore/use-map-viewport";
import { loadEventDetailPanel } from "@/components/explore/event-detail-lazy";
import { ExploreDesktopPanel } from "@/components/explore/explore-desktop-panel";
import { ExplorePhoneSheets } from "@/components/explore/explore-phone-sheets";
import { usePanelResize } from "@/components/explore/panel-resize";
import { DistanceFilter } from "@/components/shell/distance-filter";
import { useRaceParam } from "@/components/shell/use-race-param";
import { track } from "@/lib/analytics";
import { useResultsAnalytics } from "@/components/analytics/use-results-analytics";
import { visibleRaces } from "@/components/explore/use-map-list";
import { useMapList } from "@/components/explore/use-map-list";
import { useMapPadding } from "@/components/explore/use-map-padding";
import { useExploreFilterPrefs } from "@/components/shell/use-explore-filter-prefs";
import { useRadiusParam } from "@/components/shell/use-radius-param";
import { useSeriesList } from "@/components/shell/use-series-list";
import { useIsClient } from "@/hooks/use-is-client";
import { useMediaQuery, useViewportHeight } from "@/hooks/use-viewport";
import { useUserOrigin } from "@/hooks/use-user-origin";
import { eventsWithinRadius } from "@/lib/geo/radius";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { BrandMark } from "@/components/brand-mark";
import { SITE_NAME } from "@/lib/seo";
import { listViewState } from "@/lib/list-view-state";
import { dateFilterLabel } from "@/components/explore/date-range";
import { activeFilterGroups } from "@/components/shell/active-filters";
import { datePresetLabels } from "@/components/shell/explore-filter-bar";
import { localePath } from "@/lib/localized-paths";

const SubmitRaceModal = dynamic(
  () =>
    import("@/components/explore/submit-race-modal").then((m) => ({
      default: m.SubmitRaceModal,
    })),
);
const FeedbackModal = dynamic(
  () =>
    import("@/components/explore/feedback-modal").then((m) => ({
      default: m.FeedbackModal,
    })),
);
const AuthDialog = dynamic(
  () =>
    import("@/components/account/auth-dialog").then((m) => ({
      default: m.AuthDialog,
    })),
);
const MobileFiltersSheet = dynamic(
  () =>
    import("@/components/explore/mobile-filters-sheet").then((m) => ({
      default: m.MobileFiltersSheet,
    })),
);

type Props = {
  initialEvents: EventListItem[];
  messages: Messages;
  locale: string;
};


export function ExploreShell({ initialEvents, messages, locale }: Props) {
  const [filters, setFilters] = useQueryStates(exploreSearchParams);
  const camera = useMapCamera();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { radius, setRadius: storeRadius } = useRadiusParam();
  const place = useUserOrigin();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const seriesList = useSeriesList();
  const listRef = useRef<HTMLDivElement>(null);
  const mobileListRef = useRef<HTMLDivElement>(null);
  const [userOrigin, setUserOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const distanceOrigin = userOrigin ?? place.origin;
  const radiusArea = useMemo(() => radius != null && radius > 0 && distanceOrigin
    ? { lat: distanceOrigin.lat, lng: distanceOrigin.lng, km: radius } : null,
    [radius, distanceOrigin]);
  const { events, listLoading, listSettled, listFailed, matchingIds, fitSeq, refetch, area, placed } = useMapFeed({
    initialEvents,
    filters,
    radiusArea,
    bounds: camera.bounds,
    flyTo: camera.flyTo,
  });
  const { handleBoundsChange, handleSearchChange, handleSearchSubmit, searchPending, searchError } = useMapViewport({
    filters,
    setFilters,
    radiusArea,
    refetch,
    area,
    placed,
    setBounds: camera.setBounds,
    setCameraBounds: camera.setCameraBounds,
    flyTo: camera.flyTo,
  });
  const radiusEvents = useMemo(() => eventsWithinRadius(events, radiusArea), [events, radiusArea]);
  const { status: originStatus, locate: locateOrigin } = place;
  useEffect(() => {
    if (radius != null && !distanceOrigin && originStatus === "idle") locateOrigin();
  }, [radius, distanceOrigin, originStatus, locateOrigin]);
  function setRadius(km: number | null) {
    track("filter_apply", { filter_type: "radius", ...(km ? { radius_km: km } : {}) });
    storeRadius(km);
    if (km != null) {
      selectEvent(null);
      if (!distanceOrigin) locateOrigin();
    }
  }

  const [filterBarReset, setFilterBarReset] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customDate, setCustomDate] = useState(false);
  // Loaded on first use, then kept, so closing can finish its animation.
  const [filtersMounted, setFiltersMounted] = useState(false);
  if (filtersOpen && !filtersMounted) setFiltersMounted(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [listSnap, setListSnap] = useState<number | string>(COMPACT);
  // A tapped pin opens the card at compact height. The map stays visible above
  // it, and dragging up reveals the rest.
  const [detailSnap, setDetailSnap] = useState<number>(COMPACT);

  const fallbackCenter = useMemo(() => {
    const c = coldStartCenter(locale);
    return [c.lng, c.lat] as [number, number];
  }, [locale]);

  const router = useRouter();

  // The expanded list used to be a mode of this page. It is a page of its own
  // now, so a link saved from the old mode lands there with its filters.
  useEffect(() => {
    if (filters.view !== "list") return;
    const params = new URLSearchParams(window.location.search);
    params.delete("view");
    for (const key of ["west", "south", "east", "north", "e"]) params.delete(key);
    const qs = params.toString();
    router.replace(`${localePath(locale, "list")}${qs ? `?${qs}` : ""}`);
  }, [filters.view, locale, router]);

  // Fetch the race card's code once the map is idle, so the first click opens
  // it at once instead of waiting on the network.
  useEffect(() => {
    const preload = () => void loadEventDetailPanel();
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(preload, 2000);
    return () => window.clearTimeout(id);
  }, []);

  /*
   * Opening a race adds a history entry, so the back gesture closes the card
   * rather than leaving the map; picking another race while one is open
   * replaces it. `selectEvent(null)` closes in place — for a card handing over
   * to something else, a series or a new filter — and `closeDetail` is the
   * card's own way out, stepping back over the entry it added.
   */
  const race = useRaceParam();
  function selectEvent(id: string | null) {
    setSelectedId(id);
    const slug = id ? (events.find((ev) => ev.id === id)?.slug ?? "") : "";
    if (slug) race.open(slug);
    else race.drop();
  }
  function closeDetail() {
    setSelectedId(null);
    race.close();
  }

  /*
   * `memo` on a row is worth nothing if the row is handed a new closure on
   * every render, so the two lists keep one handler each. The ref is what lets
   * them stay stable while still seeing the latest `events`.
   */
  const selectEventRef = useRef(selectEvent);
  useLayoutEffect(() => {
    selectEventRef.current = selectEvent;
  });
  const selectFromList = useCallback((id: string) => {
    selectEventRef.current(id);
  }, []);
  // The card opens at compact height whichever way a race was picked — a row in
  // the list or a pin on the map — so it never comes up covering the map.
  const selectFromSheet = useCallback((id: string) => {
    setDetailSnap(COMPACT);
    selectEventRef.current(id);
  }, [setDetailSnap]);

  // The address names the race; the card follows it.
  const named = filters.e ? events.find((ev) => ev.slug === filters.e) : undefined;
  if (named && named.id !== selectedId) setSelectedId(named.id);

  // Back took `e` away: the card goes with it, and the list is as it was.
  const lastE = useRef(filters.e);
  useEffect(() => {
    if (lastE.current && !filters.e) setSelectedId(null);
    lastE.current = filters.e;
  }, [filters.e]);

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId],
  );

  const distanceEnabled = distanceOrigin != null;
  const { listSort, visibleEvents, sortedEvents } = useMapList({
    radiusEvents,
    radiusArea,
    cameraBounds: camera.cameraBounds,
    placedQuery: placed.query,
    selectedId,
    filters,
    distanceOrigin,
    listSettled,
    listRef,
    mobileListRef,
  });

  useResultsAnalytics({
    query: filters,
    count: visibleRaces({ events: radiusEvents.filter(event => matchingIds.has(event.id)), box: camera.cameraBounds, withinRadius: Boolean(radiusArea), series: filters.series, countries: filters.country, q: filters.q, placedQuery: placed.query, selectedId: null }).length,
    ready: listSettled && !listLoading, failed: listFailed,
    scope: radiusArea ? "radius" : filters.series || filters.country.length || (filters.q && !placed.query) ? "global" : "viewport",
    scopeKey: JSON.stringify(camera.cameraBounds), radius, searchPending, searchError,
    searchMode: placed.query ? "place" : "race",
  });

  function handleUserLocation(pos: { lat: number; lng: number }) {
    place.acceptOrigin(pos);
    setUserOrigin((prev) => {
      if (!prev) return pos;
      if (distanceKm(prev, pos) < 0.3) return prev;
      return pos;
    });
  }

  const [locateSeq, setLocateSeq] = useState(0);
  /**
   * Distance is always pressable. It used to be greyed out until a position
   * existed, and the only way to get one was a different button somewhere on
   * the map — so the option read as broken. Now choosing it is what asks for
   * the position; the list sorts by date until the fix lands, then flips.
   */
  function setListSort(next: EventSort) {
    void setFilters({ sort: next });
    if (next === "distance" && !distanceEnabled) setLocateSeq((n) => n + 1);
  }

  const initialFocus = useMemo(() => {
    if (!filters.e) return null;
    const ev = events.find((e) => e.slug === filters.e);
    if (ev?.location?.lat == null || ev.location.lng == null) return null;
    const lng = Number(ev.location.lng);
    const lat = Number(ev.location.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return { lng, lat };
  }, [filters.e, events]);

  const filterActions = useMapFilterActions({
    filters,
    setFilters,
    refetch,
    seriesList,
    resetBar: () => setFilterBarReset((n) => n + 1),
    clearRadius: () => setRadius(null),
  });
  const {
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
  } = filterActions;

  // Saved filters come back with a refetch for them; nothing here waits on `ready`.
  useExploreFilterPrefs(filters, setFilters, (patch) => {
    void refetch(patch);
    if (patch.sort === "distance") setLocateSeq((n) => n + 1);
  });

  // Desktop: side panels. Mobile: bottom sheet over a usable map.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const panel = usePanelResize();
  const viewportH = useViewportHeight(800);
  const mobileSheetReady = useIsClient();

  const mapPadding = useMapPadding({
    isDesktop,
    hasCard: Boolean(selected),
    listSnap,
    detailSnap,
    viewportH,
  });

  function renderFilterBar(opts?: { hideSearch?: boolean; allFilters?: boolean; wide?: boolean }) {
    return (
      <MapFilterBar
        key={filterBarReset}
        messages={messages}
        locale={locale}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        categories={filters.categories}
        disciplines={filters.disciplines}
        levels={filters.levels}
        series={filters.series}
        country={filters.country}
        seriesList={seriesList}
        hideSearch={opts?.hideSearch}
        allFilters={opts?.allFilters}
        wide={opts?.wide}
        onPreset={setDateRange}
        onCategory={toggleCategory}
        onDiscipline={toggleDiscipline}
        onLevel={toggleLevel}
        onClearDisciplines={clearDisciplines}
        onClearLevels={clearLevels}
        onClearCategories={clearCategories}
        onSeries={setSeries}
        onCountry={toggleCountry}
        onClearCountries={clearCountries}
        q={filters.q}
        onQ={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        menuExtra={<DistanceFilter submenu locale={locale} radius={radius} status={distanceOrigin ? "ready" : place.status} onRadius={setRadius} />}
      />
    );
  }

  const df = dateFnsLocale(locale);
  const presetLabels = datePresetLabels(messages);
  const datePresets = datePresetRanges(filters.dateFrom, filters.dateTo);
  const dateLabel = dateFilterLabel(filters.dateFrom, filters.dateTo, presetLabels, df);
  const filterCount = activeFilterGroups({ ...filters, radius: radiusArea ? radius : null });

  const listView = listViewState({ settled: listSettled, count: visibleEvents.length });


  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <a
        href="#race-list"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 max-md:hidden"
      >
        {messages.skipToList}
      </a>
      <a
        href="#race-list-mobile"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:hidden"
      >
        {messages.skipToList}
      </a>
      <h1 className="sr-only">{messages.introTitle}</h1>

      <div
        className="absolute inset-y-0 right-0 left-0 md:left-[var(--map-panel-width)]"
        style={
          {
            "--map-panel-width": `${panel.width}px`,
            "--map-sheet-inset": `${mapPadding.bottom}px`,
          } as CSSProperties
        }
      >
        <Suspense
          fallback={
            // The same ground the route's skeleton paints, so the handover
            // between the two is invisible. Bare "Loading map…" text in the
            // middle of the screen was the one part of the load that announced
            // itself, and it announced a wait rather than progress.
            <Skeleton className="h-full w-full rounded-none bg-muted" role="status">
              <span className="sr-only">{messages.mapLoading}</span>
            </Skeleton>
          }
        >
          <RaceMap
            events={radiusEvents}
            selectedId={selectedId}
            hoveredId={hoveredId}
            radiusArea={radiusArea}
            padding={mapPadding}
            fitSeq={fitSeq}
            destination={camera.destination}
            destinationSeq={camera.destinationSeq}
            fallbackCenter={fallbackCenter}
            initialFocus={initialFocus}
            skipInitialLocate={Boolean(filters.e || filters.q.trim().length >= 3)}
            onUserLocation={handleUserLocation}
            locateSeq={locateSeq}
            onSelect={selectFromSheet}
            onBackgroundClick={() => {
              // A tap on the map puts the card away and does nothing else. It
              // used to collapse the list too, so every stray tap while panning
              // yanked the list down — the list is the handle's to resize.
              if (!isDesktop && selectedId) closeDetail();
            }}
            onBoundsChange={handleBoundsChange}
            locale={locale}
            myLocationLabel={messages.myLocation}
            locationDeniedLabel={messages.locationDenied}
          />
        </Suspense>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3">
        {/*
          On a phone the sheet is the page, and the wordmark inside it spent a
          row of a small screen saying where you already are. Over the map it is
          a way home; on a desktop the panel header still carries it.
        */}
        <Button
          asChild
          size="icon"
          className="pointer-events-auto rounded-full bg-brand shadow-md hover:bg-brand/90 md:hidden"
        >
          <Link href={`/${locale}`} aria-label={SITE_NAME}>
            <BrandMark mark="lr" size="sm" tone="inverse" className="px-0" />
          </Link>
        </Button>
        {/* The account lives behind the tab bar's "More" on a phone and at
            the foot of the sidebar on a desktop — not in a corner of the map. */}
      </div>

      <ExploreDesktopPanel
        panel={panel}
        locale={locale}
        messages={messages}
        filterBar={renderFilterBar()}
        listRef={listRef}
        toolbar={{
          count: listSettled ? visibleEvents.length : null,
          pending: listLoading,
          sort: listSort,
          onSort: setListSort,
        }}
        rows={{
          view: listView,
          events: sortedEvents,
          selectedId,
          distanceOrigin,
          onSelect: selectFromList,
          onHover: setHoveredId,
          onClearFilters: () => resetExploreFilters({ clearSearch: true }),
          onMissingRace: () => setSubmitOpen(true),
        }}
        selected={selected}
        onCloseDetail={closeDetail}
        onSelectSeries={applySeries}
      />

      {/* Phone only. Mounted on a desktop, the hidden card still opened a
          dialog layer with every race, and that layer locks the page. */}
      {mobileSheetReady && !isDesktop ? (
        <ExplorePhoneSheets
          locale={locale}
          messages={messages}
          listSnap={listSnap}
          onListSnap={setListSnap}
          detailSnap={detailSnap}
          onDetailSnap={setDetailSnap}
          viewportH={viewportH}
          topBar={{
            dateLabel,
            dateCustom: !datePresets.some((p) => p.active),
            dateChoices: datePresets.map((p) => ({
              id: p.id,
              label: presetLabels[p.id],
              active: p.active,
              apply: () => setDateRange(p.from, p.to),
            })),
            onCustomDate: () => {
              setCustomDate(true);
              setFiltersOpen(true);
            },
            filterCount,
            onFilters: () => {
              setCustomDate(false);
              setFiltersOpen(true);
            },
            q: filters.q,
            onQ: handleSearchChange,
            onSearchSubmit: handleSearchSubmit,
            searchOpen,
            onSearchOpenChange: setSearchOpen,
          }}
          chips={{
            filters: { ...filters, radius: radiusArea ? radius : null },
            seriesList,
            onOpenFilters: () => {
              setCustomDate(false);
              setFiltersOpen(true);
            },
            onClearDisciplines: clearDisciplines,
            onClearCategories: clearCategories,
            onClearLevels: clearLevels,
            onClearCountries: clearCountries,
            onClearSeries: () => setSeries(filters.series),
            onClearRadius: () => setRadius(null),
            onClearQ: () => handleSearchChange(""),
          }}
          meta={{
            count: listSettled ? visibleEvents.length : null,
            loading: listLoading,
            sort: listSort,
            onSort: setListSort,
          }}
          listRef={mobileListRef}
          rows={{
            view: listView,
            events: sortedEvents,
            selectedId,
            distanceOrigin,
            onSelect: selectFromSheet,
            onHover: setHoveredId,
            onClearFilters: () => resetExploreFilters({ clearSearch: true }),
          }}
          selected={selected}
          onCloseDetail={closeDetail}
          onSelectSeries={(slug) => {
            applySeries(slug);
            selectEvent(null);
            setListSnap(COMPACT);
          }}
        />
      ) : null}

      {filtersMounted ? (
        <MobileFiltersSheet
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          messages={messages}
          locale={locale}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          categories={filters.categories}
          disciplines={filters.disciplines}
          levels={filters.levels}
          series={filters.series}
          country={filters.country}
          seriesList={seriesList}
          onPreset={setDateRange}
          onCategory={toggleCategory}
          onDiscipline={toggleDiscipline}
          onLevel={toggleLevel}
          onClearDisciplines={clearDisciplines}
          onClearLevels={clearLevels}
          onClearCategories={clearCategories}
          onSeries={setSeries}
          onCountry={toggleCountry}
          onClearCountries={clearCountries}
          onReset={() => resetExploreFilters()}
          customDate={customDate}
          radius={radius}
          radiusStatus={distanceOrigin ? "ready" : place.status}
          onRadius={setRadius}
          resultCount={listSettled ? visibleEvents.length : null}
        />
      ) : null}

      {submitOpen ? (
        <SubmitRaceModal open onClose={() => setSubmitOpen(false)} messages={messages} />
      ) : null}
      {feedbackOpen ? <FeedbackModal open onClose={() => setFeedbackOpen(false)} /> : null}
      {authOpen ? (
        <AuthDialog
          open
          onClose={() => setAuthOpen(false)}
          onSuccess={() => setAuthOpen(false)}
          locale={locale}
        />
      ) : null}
      <WelcomeCard messages={messages} onSignIn={() => setAuthOpen(true)} />
    </div>
  );
}

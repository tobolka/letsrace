"use client";

import { Suspense, type CSSProperties, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { RaceMapLazy as RaceMap } from "@/components/map/race-map-lazy";
import { MapFilterBar } from "@/components/explore/map-filter-bar";
import { WelcomeCard } from "@/components/explore/welcome-card";
import { Button } from "@/components/ui/button";
import {
  FULL,
  COMPACT,
  DETAIL_FULL,
  LIST_PEEK,
  MobileDetailSheet,
  MobileListSheet,
} from "@/components/explore/mobile-sheets";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventListItem } from "@/lib/events";
import type { Messages } from "@/lib/i18n/messages";
import { coldStartCenter } from "@/lib/coverage";
import {
  sortEvents,
  distanceKm,
  type EventSort,
} from "@/lib/geo/distance";
import Link from "next/link";
import { datePresetRanges, thisWeekendRange } from "@/lib/date-presets";
import { exploreSearchParams } from "@/lib/explore-params";
import { useMapCamera } from "@/components/explore/use-map-camera";
import { useMapFeed } from "@/components/explore/use-map-feed";
import { useMapViewport } from "@/components/explore/use-map-viewport";
import { ExploreRaceRows } from "@/components/explore/explore-race-rows";
import { ListToolbar } from "@/components/explore/list-toolbar";
import { PanelResizeHandle, usePanelResize } from "@/components/explore/panel-resize";
import { DistanceFilter } from "@/components/shell/distance-filter";
import { useRaceParam } from "@/components/shell/use-race-param";
import { useExploreFilterPrefs } from "@/components/shell/use-explore-filter-prefs";
import { useRadiusParam } from "@/components/shell/use-radius-param";
import { useSeriesList } from "@/components/shell/use-series-list";
import { useIsClient } from "@/hooks/use-is-client";
import { useMediaQuery, useViewportHeight } from "@/hooks/use-viewport";
import { useUserOrigin } from "@/hooks/use-user-origin";
import { eventsWithinRadius } from "@/lib/geo/radius";
import { countryChange, toggleIn } from "@/lib/explore-filters";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { BrandMark } from "@/components/brand-mark";
import { BrandBar } from "@/components/shell/section-header";
import { SITE_NAME } from "@/lib/seo";
import { listViewState } from "@/lib/list-view-state";
import { cn } from "@/lib/utils";
import { MobileTopBar } from "@/components/explore/mobile-top-bar";
import { dateFilterLabel } from "@/components/explore/date-range";
import { ActiveFilterChips, ListMetaRow, activeFilterGroups } from "@/components/shell/active-filters";
import { datePresetLabels } from "@/components/shell/explore-filter-bar";
import { localePath } from "@/lib/localized-paths";

const loadEventDetailPanel = () =>
  import("@/components/explore/event-detail-panel").then((m) => ({
    default: m.EventDetailPanel,
  }));
const EventDetailPanel = dynamic(loadEventDetailPanel);
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
  const { events, listLoading, listSettled, fitSeq, refetch, area, placed } = useMapFeed({
    initialEvents,
    filters,
    radiusArea,
    bounds: camera.bounds,
    flyTo: camera.flyTo,
  });
  const { handleBoundsChange, handleSearchChange, handleSearchSubmit } = useMapViewport({
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
  // Date is the default and distance is opt-in. Sorting by distance the moment
  // a location arrived reshuffled the list under whoever was reading it, and it
  // only ever made sense to someone who asked for it.
  const listSort: EventSort =
    filters.sort === "distance" && distanceEnabled ? "distance" : "date";

  /**
   * What is on screen, not what is in memory.
   *
   * The map asks for a box padded on every side so races are already loaded
   * when they scroll into frame. That padding is a buffer, not a promise —
   * leaving it in the list meant zooming in or panning changed the view and not
   * the count, and the list kept naming races you could no longer see. Clipping
   * costs no round trip, so the count answers the camera at once.
   *
   * A name search, a series or a country is a find rather than a window, and
   * those are meant to reach outside the frame.
   */
  const visibleEvents = useMemo(() => {
    const box = camera.cameraBounds;
    if (radiusArea || !box || filters.series || filters.country.length) return radiusEvents;
    if (filters.q.trim() && !placed.query) return radiusEvents;
    return radiusEvents.filter((e) => {
      // The race you opened stays in the list even when the map has carried it
      // off the edge — losing the row you are reading is worse than a row you
      // cannot see.
      if (e.id === selectedId) return true;
      const lat = Number(e.location?.lat);
      const lng = Number(e.location?.lng);
      // A race we could not place is never hidden by a box it has no point in.
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
      return lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east;
    });
  }, [radiusEvents, radiusArea, camera.cameraBounds, placed.query, selectedId, filters.series, filters.country, filters.q]);

  const sortedEvents = useMemo(
    () => sortEvents(visibleEvents, listSort, distanceOrigin),
    [visibleEvents, listSort, distanceOrigin],
  );

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

  /**
   * Keep the selected race in view in the list.
   *
   * On a phone the list is unmounted while a race card is open, so there is
   * nothing to scroll at the moment the race is picked off the map. This runs
   * again when the list comes back, on the frame after it mounts — otherwise
   * closing the card dropped you at the top of the list with no sign of the
   * race you had just been reading about.
   */
  useEffect(() => {
    if (!selectedId) return;
    const selector = `[data-event-id="${CSS.escape(selectedId)}"]`;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const raf = requestAnimationFrame(() => {
      for (const root of [listRef.current, mobileListRef.current]) {
        if (!root || root.offsetHeight === 0) continue;
        const el = root.querySelector<HTMLElement>(selector);
        if (!el) continue;
        el.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: reduce ? "auto" : "smooth",
        });
        break;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedId, listSettled]);

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
    setRadius(null);
    const w = thisWeekendRange();
    const clearSearch = opts?.clearSearch ?? false;
    setFilterBarReset((n) => n + 1);
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

  /*
   * The sheet's height while it is moving is not the map's business.
   *
   * Dragging the sheet set `listSnap`, which recomputed the map's padding,
   * which handed `RaceMap` a new object, which re-rendered the map and the
   * whole list — every frame, while the browser was animating a full-height
   * translate. Deferring it lets React finish the sheet at the frame rate and
   * catch the map up when it settles.
   */
  const deferredListSnap = useDeferredValue(listSnap);
  const deferredDetailSnap = useDeferredValue(detailSnap);

  const mapPadding = useMemo(() => {
    if (!isDesktop) {
      const snap = selected ? deferredDetailSnap : deferredListSnap;
      const snapPx =
        typeof snap === "number" ? viewportH * snap : Number.parseFloat(snap) || viewportH * 0.5;
      /*
       * Never hand the map less than 45% of the screen. The sheet at full
       * height left a fifty-pixel strip, and easing a race into a strip that
       * size zooms the map out to the whole of Europe to make it fit.
       */
      const open = Math.round(Math.min(snapPx, viewportH * 0.55, 640));
      return {
        top: 16,
        right: 12,
        bottom: open + 12,
        left: 12,
      };
    }
    // The panel sits beside the map now, not on it, so only the race card
    // floats over the camera's left edge.
    const detailW = selected ? 320 + 12 : 0;
    return {
      top: 16,
      right: 56,
      bottom: 56,
      left: detailW + 48,
    };
  }, [selected, isDesktop, viewportH, deferredListSnap, deferredDetailSnap]);

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

      <div className="pointer-events-none absolute inset-0 z-20 hidden md:block">
        <div
          className={cn(
            "absolute inset-y-0 left-0 min-w-0",
            !panel.dragging &&
              "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          )}
          style={{ width: panel.width }}
        >
        <div className="pointer-events-auto flex h-full w-full min-w-0 flex-col overflow-hidden border-r bg-card">
          <Header locale={locale} />
          <div className="relative z-30 flex min-h-12 shrink-0 items-center px-4 py-2">
            {renderFilterBar()}
          </div>
          <Separator />
          <ListToolbar
            count={listSettled ? visibleEvents.length : null}
            pending={listLoading}
            sort={listSort}
            distanceEnabled
            messages={messages}
            locale={locale}
            onSort={setListSort}
          />
          <main id="race-list" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
            <div ref={listRef} className="@container min-h-0">
            <ExploreRaceRows
              variant="panel"
              view={listView}
              locale={locale}
              events={sortedEvents}
              selectedId={selectedId}
              distanceOrigin={distanceOrigin}
              messages={messages}
              onSelect={selectFromList}
              onHover={setHoveredId}
              onClearFilters={() => resetExploreFilters({ clearSearch: true })}
              onMissingRace={() => setSubmitOpen(true)}
            />
            </div>
          </main>
        </div>
        <PanelResizeHandle resize={panel} label={messages.resizePanel} />
        </div>

        {/*
          Its own boundary: the card's code arrives on the first click, and
          without one the wait reached the page's loading screen — the whole
          map went blank for a moment before the card appeared.
        */}
        {selected && (
          <Suspense fallback={null}>
          <EventDetailPanel
            event={selected}
            locale={locale}
            onClose={closeDetail}
            onSelectSeries={applySeries}
            leftX={panel.chosen + 12}
          />
          </Suspense>
        )}
      </div>

      {/* Phone only. Mounted on a desktop, the hidden card still opened a
          dialog layer with every race, and that layer locks the page. */}
      {mobileSheetReady && !isDesktop ? (
        <>
          <MobileListSheet
            snap={listSnap}
            onSnap={setListSnap}
            viewportH={viewportH}
            title={messages.racesCount}
            handleLabel={listSnap === LIST_PEEK ? messages.sheetExpand : messages.sheetCollapse}
            mapLabel={messages.navMap}
          >
            <MobileTopBar
              className="-mt-1"
              dateLabel={dateLabel}
              dateCustom={!datePresets.some((p) => p.active)}
              dateChoices={datePresets.map((p) => ({
                id: p.id,
                label: presetLabels[p.id],
                active: p.active,
                apply: () => setDateRange(p.from, p.to),
              }))}
              customDateLabel={messages.customDate}
              onCustomDate={() => {
                setCustomDate(true);
                setFiltersOpen(true);
              }}
              filtersLabel={messages.filtersButton}
              filterCount={filterCount}
              onFilters={() => {
                setCustomDate(false);
                setFiltersOpen(true);
              }}
              searchLabel={messages.search}
              searchPlaceholder={messages.searchPlaceholder}
              doneLabel={messages.filtersDone}
              clearLabel={messages.clearFilter}
              q={filters.q}
              onQ={handleSearchChange}
              onSearchSubmit={handleSearchSubmit}
              searchOpen={searchOpen}
              onSearchOpenChange={(open) => {
                setSearchOpen(open);
                // The field is at the foot of the screen at the lower stops,
                // which is where the keyboard comes up. Raised, the sheet puts
                // it at the top and the answers right under it.
                if (open) setListSnap(FULL);
              }}
            />

            <div
              id="race-list-mobile"
              ref={mobileListRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:hidden"
            >
              <div className="border-b border-border/50">
                <ActiveFilterChips
                  locale={locale}
                  filters={{ ...filters, radius: radiusArea ? radius : null }}
                  seriesList={seriesList}
                  onOpenFilters={() => {
                    setCustomDate(false);
                    setFiltersOpen(true);
                  }}
                  className="pb-0"
                  onClearDisciplines={clearDisciplines}
                  onClearCategories={clearCategories}
                  onClearLevels={clearLevels}
                  onClearCountries={clearCountries}
                  onClearSeries={() => setSeries(filters.series)}
                  onClearRadius={() => setRadius(null)}
                  onClearQ={() => handleSearchChange("")}
                />
                <ListMetaRow
                  locale={locale}
                  count={listSettled ? visibleEvents.length : null}
                  loading={listLoading}
                  sort={listSort}
                  onSort={setListSort}
                />
              </div>
              {/* Room under the last race for the "Map" pill the full sheet
                  floats over it, so the end of the list can be read. */}
              <ExploreRaceRows
                variant="sheet"
                view={listView}
                locale={locale}
                events={sortedEvents}
                selectedId={selectedId}
                distanceOrigin={distanceOrigin}
                messages={messages}
                groupClassName={cn(listSnap === FULL && "pb-16")}
                onSelect={selectFromSheet}
                onHover={setHoveredId}
                onClearFilters={() => resetExploreFilters({ clearSearch: true })}
              />
            </div>
          </MobileListSheet>

          <MobileDetailSheet
            open={Boolean(selected)}
            snap={detailSnap}
            onSnap={setDetailSnap}
            viewportH={viewportH}
            onClose={closeDetail}
            title={selected?.name ?? ""}
            handleLabel={detailSnap === DETAIL_FULL ? messages.sheetCollapse : messages.raceExpand}
          >
            {selected ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Suspense fallback={null}>
                <EventDetailPanel
                  event={selected}
                  locale={locale}
                  embedded
                  // The preview says what a race is; one tap shows the rest,
                  // without hunting for the grab bar.
                  onExpand={detailSnap === COMPACT ? () => setDetailSnap(DETAIL_FULL) : undefined}
                  onClose={closeDetail}
                  onSelectSeries={(slug) => {
                    applySeries(slug);
                    selectEvent(null);
                    setListSnap(COMPACT);
                  }}
                />
                </Suspense>
              </div>
            ) : null}
          </MobileDetailSheet>
        </>
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

/** The panel's title bar: the logo bar every race view shares. */
function Header({ locale }: { locale: string }) {
  return <BrandBar href={`/${locale}`} />;
}

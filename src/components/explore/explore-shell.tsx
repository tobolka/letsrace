"use client";

import { useMemo, useRef, useState, useEffect, type PointerEvent } from "react";
import { useQueryStates, parseAsString, parseAsArrayOf } from "nuqs";
import { RaceMapLazy as RaceMap, type MapBounds } from "@/components/map/race-map-lazy";
import { EventDetailPanel } from "@/components/explore/event-detail-panel";
import {
  INT_COUNTRY,
  MapFilterBar,
  seriesCountryKey,
  type SeriesOption,
} from "@/components/explore/map-filter-bar";
import { SubmitRaceModal } from "@/components/explore/submit-race-modal";
import { FeedbackModal } from "@/components/explore/feedback-modal";
import { AuthDialog } from "@/components/account/auth-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import type { EventListItem } from "@/lib/events";
import { locales, type Messages } from "@/lib/i18n/messages";
import {
  DISCIPLINE_LABELS,
  RACE_LEVEL_LABELS,
  formatEventCategoryLabel,
  type Discipline,
  type RaceLevel,
} from "@/lib/taxonomy";
import { disciplineColor } from "@/lib/map-visuals";
import { coldStartCenter, foldPlaceQuery } from "@/lib/coverage";
import {
  eventDistanceKm,
  formatDistanceKm,
  sortEvents,
  distanceKm,
  type EventSort,
} from "@/lib/geo/distance";
import { expandViewport, viewportNeedsFetch } from "@/lib/geo/viewport";
import { format, parseISO } from "date-fns";
import { MoreHorizontal, Flag, Check } from "lucide-react";
import Link from "next/link";
import { thisWeekendRange } from "@/lib/date-presets";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

const WEEKEND_DEFAULT = thisWeekendRange();
const exploreSearchParams = {
  q: parseAsString.withDefault(""),
  categories: parseAsArrayOf(parseAsString).withDefault([]),
  disciplines: parseAsArrayOf(parseAsString).withDefault([]),
  levels: parseAsArrayOf(parseAsString).withDefault([]),
  series: parseAsString.withDefault(""),
  country: parseAsString.withDefault(""),
  dateFrom: parseAsString.withDefault(WEEKEND_DEFAULT.from),
  dateTo: parseAsString.withDefault(WEEKEND_DEFAULT.to),
  e: parseAsString.withDefault(""),
  sort: parseAsString.withDefault("date"),
  west: parseAsString,
  south: parseAsString,
  east: parseAsString,
  north: parseAsString,
};

function seriesListQuery(filters: {
  dateFrom: string;
  dateTo: string;
  categories: string[];
  disciplines: string[];
  levels: string[];
}) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  for (const a of filters.categories) params.append("categories", a);
  for (const d of filters.disciplines) params.append("disciplines", d);
  for (const l of filters.levels) params.append("levels", l);
  return params.toString();
}

const seriesResultCache = new Map<string, SeriesOption[]>();
const seriesInflight = new Map<string, Promise<SeriesOption[]>>();

function loadSeriesList(qs: string): Promise<SeriesOption[]> {
  const cached = seriesResultCache.get(qs);
  if (cached) return Promise.resolve(cached);
  const pending = seriesInflight.get(qs);
  if (pending) return pending;
  const p = fetch(`/api/series${qs ? `?${qs}` : ""}`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`series ${res.status}`);
      return res.json() as Promise<SeriesOption[]>;
    })
    .then((data) => {
      seriesResultCache.set(qs, data);
      return data;
    })
    .finally(() => {
      seriesInflight.delete(qs);
    });
  seriesInflight.set(qs, p);
  return p;
}

type Props = {
  initialEvents: EventListItem[];
  messages: Messages;
  locale: string;
};

export function ExploreShell({ initialEvents, messages, locale }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const initialBoundsFetchDone = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sheetDragY = useRef<number | null>(null);
  const sheetSwiped = useRef(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mobileListRef = useRef<HTMLDivElement>(null);
  const [fitSeq, setFitSeq] = useState(0);
  const [destination, setDestination] = useState<MapBounds | null>(null);
  const [destinationSeq, setDestinationSeq] = useState(0);
  const [userOrigin, setUserOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const lastPlacedQ = useRef("");
  const destFlyingRef = useRef(false);
  const placeAbortRef = useRef<AbortController | null>(null);
  const searchTimerRef = useRef(0);
  const searchGen = useRef(0);
  const eventsFetchGen = useRef(0);
  const lastAreaRef = useRef<MapBounds | null>(null);
  const areaTimerRef = useRef(0);
  const searchViewportRef = useRef<(b: MapBounds) => void>(() => {});
  const [filterBarReset, setFilterBarReset] = useState(0);

  const fallbackCenter = useMemo(() => {
    const c = coldStartCenter(locale);
    return [c.lng, c.lat] as [number, number];
  }, [locale]);

  const [filters, setFilters] = useQueryStates(exploreSearchParams);

  function selectEvent(id: string | null) {
    setSelectedId(id);
    const slug = id ? (events.find((ev) => ev.id === id)?.slug ?? "") : "";
    void setFilters({ e: slug || null });
  }

  useEffect(() => {
    if (!filters.e) return;
    const hit = events.find((ev) => ev.slug === filters.e);
    if (hit && hit.id !== selectedId) setSelectedId(hit.id);
  }, [filters.e, events, selectedId]);

  const seriesQuery = seriesListQuery(filters);
  useEffect(() => {
    let alive = true;
    void loadSeriesList(seriesQuery)
      .then((data) => {
        if (alive) setSeriesList(data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [seriesQuery]);

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId],
  );

  const distanceEnabled = userOrigin != null;
  const listSort: EventSort =
    filters.sort === "distance" && distanceEnabled ? "distance" : "date";

  const sortedEvents = useMemo(
    () => sortEvents(events, listSort, userOrigin),
    [events, listSort, userOrigin],
  );

  function handleUserLocation(pos: { lat: number; lng: number }) {
    setUserOrigin((prev) => {
      if (!prev) return pos;
      if (distanceKm(prev, pos) < 0.3) return prev;
      return pos;
    });
  }

  function setListSort(next: EventSort) {
    if (next === "distance" && !distanceEnabled) return;
    void setFilters({ sort: next === "date" ? null : "distance" });
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

  useEffect(() => {
    if (!selectedId) return;
    const selector = `[data-event-id="${CSS.escape(selectedId)}"]`;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  }, [selectedId]);

  function toggleCategory(value: string) {
    const next = filters.categories.includes(value)
      ? filters.categories.filter((a) => a !== value)
      : [...filters.categories, value];
    void setFilters({ categories: next });
    refetch({ categories: next });
  }

  function setDiscipline(value: string) {
    const next = filters.disciplines[0] === value ? [] : [value];
    void setFilters({ disciplines: next });
    refetch({ disciplines: next });
  }

  function toggleLevel(value: string) {
    const next = filters.levels.includes(value)
      ? filters.levels.filter((l) => l !== value)
      : [...filters.levels, value];
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
    const w = thisWeekendRange();
    const clearSearch = opts?.clearSearch ?? false;
    setFilterBarReset((n) => n + 1);
    void setFilters({
      ...(clearSearch ? { q: null, e: null } : {}),
      categories: [],
      disciplines: [],
      levels: [],
      series: null,
      country: null,
      dateFrom: w.from,
      dateTo: w.to,
    });
    refetch({
      ...(clearSearch ? { q: "" } : {}),
      categories: [],
      disciplines: [],
      levels: [],
      series: "",
      country: "",
      dateFrom: w.from,
      dateTo: w.to,
      skipBounds: clearSearch,
      fitMap: clearSearch,
    });
  }

  function setSeries(slug: string) {
    const next = filters.series === slug ? "" : slug;
    void setFilters({ series: next });
    refetch({ series: next, skipBounds: Boolean(next) || Boolean(filters.country), fitMap: Boolean(next) });
  }

  function applySeries(slug: string) {
    void setFilters({ series: slug });
    refetch({
      series: slug,
      skipBounds: true,
      fitMap: true,
    });
  }

  function setCountry(code: string) {
    const next = filters.country === code ? "" : code;
    const seriesRow = seriesList.find((s) => s.slug === filters.series);
    const seriesCountry = seriesCountryKey(seriesRow?.countryCode);
    const dropSeries = Boolean(next && filters.series && seriesCountry !== INT_COUNTRY && seriesCountry !== next);
    void setFilters({ country: next, ...(dropSeries ? { series: "" } : {}) });
    refetch({
      country: next,
      ...(dropSeries ? { series: "" } : {}),
      skipBounds: Boolean(next) || Boolean(filters.series && !dropSeries),
      fitMap: Boolean(next),
    });
  }

  function setDateRange(dateFrom: string, dateTo: string) {
    void setFilters({ dateFrom, dateTo });
    refetch({ dateFrom, dateTo });
  }

  function refetch(overrides: Record<string, unknown> = {}) {
    const gen = ++eventsFetchGen.current;
    setListLoading(true);
    void (async () => {
      const params = new URLSearchParams();
      const qRaw = (overrides.q as string) ?? filters.q;
      const placed = lastPlacedQ.current;
      const q =
        placed && foldPlaceQuery(qRaw) === foldPlaceQuery(placed) ? "" : qRaw;
      const categories = (overrides.categories as string[]) ?? filters.categories;
      const disciplines = (overrides.disciplines as string[]) ?? filters.disciplines;
      const levels = (overrides.levels as string[]) ?? filters.levels;
      const series = (overrides.series as string) ?? filters.series;
      const country = (overrides.country as string) ?? filters.country;
      const dateFrom = (overrides.dateFrom as string) ?? filters.dateFrom;
      const dateTo = (overrides.dateTo as string) ?? filters.dateTo;
      const skipBounds =
        overrides.skipBounds === true ||
        (Boolean(series || country) && overrides.forceBounds !== true);
      const b = skipBounds ? null : ((overrides.bounds as typeof bounds) ?? bounds);
      if (q) params.set("q", q);
      if (series) params.set("series", series);
      if (country) params.set("country", country);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      categories.forEach((a) => params.append("categories", a));
      disciplines.forEach((d) => params.append("disciplines", d));
      levels.forEach((l) => params.append("levels", l));
      // Always scope to the current map viewport when we know it — otherwise an
      // unfiltered query hits a global limit and looks emptier than a discipline filter.
      if (b) {
        params.set("west", String(b.west));
        params.set("south", String(b.south));
        params.set("east", String(b.east));
        params.set("north", String(b.north));
      }
      try {
        const res = await fetch(`/api/events?${params.toString()}`);
        const data = (await res.json()) as EventListItem[];
        if (gen !== eventsFetchGen.current) return;
        const focusSlug = filters.e;
        setEvents((prev) => {
          if (!focusSlug) return data;
          const kept =
            data.find((e) => e.slug === focusSlug) ?? prev.find((e) => e.slug === focusSlug);
          if (!kept || data.some((e) => e.id === kept.id)) return data;
          return [kept, ...data];
        });
        if (overrides.fitMap) setFitSeq((n) => n + 1);
      } finally {
        if (gen === eventsFetchGen.current) setListLoading(false);
      }
    })();
  }

  async function flyToPlace(q: string, gen: number): Promise<boolean> {
    placeAbortRef.current?.abort();
    const ac = new AbortController();
    placeAbortRef.current = ac;
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ac.signal });
      if (!res.ok) return false;
      const data = (await res.json()) as { bounds: MapBounds };
      if (!data.bounds || gen !== searchGen.current) return false;
      lastPlacedQ.current = q;
      destFlyingRef.current = true;
      window.clearTimeout(areaTimerRef.current);
      lastAreaRef.current = data.bounds;
      setBounds(data.bounds);
      setDestination(data.bounds);
      setDestinationSeq((n) => n + 1);
      void setFilters({
        west: String(data.bounds.west),
        south: String(data.bounds.south),
        east: String(data.bounds.east),
        north: String(data.bounds.north),
        country: "",
      });
      refetch({
        q: "",
        country: "",
        bounds: data.bounds,
        forceBounds: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  async function runSearch(q: string) {
    const gen = ++searchGen.current;
    const trimmed = q.trim();
    if (trimmed.length >= 3) {
      const ok = await flyToPlace(trimmed, gen);
      if (gen !== searchGen.current) return;
      if (ok) return;
    }
    if (gen !== searchGen.current) return;
    lastPlacedQ.current = "";
    refetch({ q: trimmed });
  }

  function handleSearchChange(q: string) {
    void setFilters({ q });
    window.clearTimeout(searchTimerRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      lastPlacedQ.current = "";
      searchGen.current += 1;
      placeAbortRef.current?.abort();
      refetch({ q: trimmed });
      return;
    }
    searchTimerRef.current = window.setTimeout(() => {
      void runSearch(q);
    }, 400);
  }

  function handleSearchSubmit() {
    window.clearTimeout(searchTimerRef.current);
    void runSearch(filters.q);
  }

  searchViewportRef.current = (b) => {
    if (filters.series || filters.country) return;
    if (lastAreaRef.current && !viewportNeedsFetch(lastAreaRef.current, b)) return;
    const query = expandViewport(b);
    lastAreaRef.current = query;
    void setFilters({
      west: String(query.west),
      south: String(query.south),
      east: String(query.east),
      north: String(query.north),
    });
    refetch({ bounds: query, forceBounds: true });
  };

  function scheduleSearchViewport(b: MapBounds, immediate = false) {
    window.clearTimeout(areaTimerRef.current);
    if (immediate) {
      searchViewportRef.current(b);
      return;
    }
    areaTimerRef.current = window.setTimeout(() => {
      searchViewportRef.current(b);
    }, 160);
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(searchTimerRef.current);
      window.clearTimeout(areaTimerRef.current);
      placeAbortRef.current?.abort();
    };
  }, []);

  // Desktop: side panels. Mobile: bottom sheet over a usable map.
  const [isDesktop, setIsDesktop] = useState(false);
  const [viewportH, setViewportH] = useState(800);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => {
      setIsDesktop(mq.matches);
      setViewportH(window.innerHeight);
    };
    apply();
    mq.addEventListener("change", apply);
    window.addEventListener("resize", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  const mapPadding = useMemo(() => {
    if (!isDesktop) {
      const peek = selected ? 148 : 132;
      const open = Math.round(Math.min(viewportH * 0.5, 560));
      return {
        top: 56,
        right: 48,
        bottom: (mobileOpen ? open : peek) + 12,
        left: 12,
      };
    }
    const listW = 400 + 12 + 12;
    const detailW = selected ? 320 + 12 : 0;
    return {
      top: 16,
      right: 56,
      bottom: 56,
      left: listW + detailW + 64,
    };
  }, [selected, isDesktop, mobileOpen, viewportH]);

  function renderFilterBar() {
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
        onPreset={setDateRange}
        onCategory={toggleCategory}
        onDiscipline={setDiscipline}
        onLevel={toggleLevel}
        onClearDisciplines={clearDisciplines}
        onClearLevels={clearLevels}
        onClearCategories={clearCategories}
        onSeries={setSeries}
        onCountry={setCountry}
        q={filters.q}
        onQ={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
      />
    );
  }

  function onSheetHandlePointerDown(e: PointerEvent<HTMLButtonElement>) {
    sheetSwiped.current = false;
    sheetDragY.current = e.clientY;
  }

  function onSheetHandlePointerUp(e: PointerEvent<HTMLButtonElement>) {
    if (sheetDragY.current == null) return;
    const dy = e.clientY - sheetDragY.current;
    sheetDragY.current = null;
    if (Math.abs(dy) < 24) return;
    sheetSwiped.current = true;
    setMobileOpen(dy < 0);
  }

  function onSheetHandleClick() {
    if (sheetSwiped.current) {
      sheetSwiped.current = false;
      return;
    }
    setMobileOpen((open) => !open);
  }

  const selectedPeekMeta = selected
    ? [
        format(parseISO(selected.startDate), "d MMM"),
        selected.location?.municipality || selected.location?.name,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-stone-100">
      <div className="absolute inset-0">
        <RaceMap
          events={events}
          selectedId={selectedId}
          padding={mapPadding}
          fitSeq={fitSeq}
          destination={destination}
          destinationSeq={destinationSeq}
          fallbackCenter={fallbackCenter}
          initialFocus={initialFocus}
          skipInitialLocate={Boolean(filters.e || filters.q.trim().length >= 3)}
          onUserLocation={handleUserLocation}
          onSelect={(id) => {
            selectEvent(id);
            setMobileOpen(true);
          }}
          onBoundsChange={(b, reason) => {
            setBounds(b);
            // First camera settle → load races for this viewport (padded query box)
            if (!initialBoundsFetchDone.current) {
              initialBoundsFetchDone.current = true;
              if (filters.q.trim().length >= 3) {
                void runSearch(filters.q);
                return;
              }
              if (filters.series || filters.country) {
                lastAreaRef.current = expandViewport(b);
                refetch({ skipBounds: true, fitMap: true });
              } else {
                const query = expandViewport(b);
                lastAreaRef.current = query;
                refetch({ bounds: query, forceBounds: true });
              }
              return;
            }
            if (destFlyingRef.current) {
              destFlyingRef.current = false;
              lastAreaRef.current = expandViewport(b);
              return;
            }
            if (reason === "user" || reason === "sync") {
              scheduleSearchViewport(b);
              return;
            }
            if (reason === "gps" || reason === "locate") {
              scheduleSearchViewport(b, true);
            }
          }}
          myLocationLabel={messages.myLocation}
          locationDeniedLabel={messages.locationDenied}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 hidden items-start p-3 md:flex md:gap-3">
        <Card className="pointer-events-auto flex h-full w-[400px] flex-col gap-0 overflow-hidden py-0 shadow-lg">
          <Header
            messages={messages}
            locale={locale}
            onSubmitRace={() => setSubmitOpen(true)}
            onFeedback={() => setFeedbackOpen(true)}
            onSignIn={() => setAuthOpen(true)}
          />
          <div className="relative z-30 flex min-h-12 shrink-0 items-center px-3 py-2">
            {renderFilterBar()}
          </div>
          <Separator />
          <ListToolbar
            count={events.length}
            pending={listLoading}
            sort={listSort}
            distanceEnabled={distanceEnabled}
            messages={messages}
            onSort={setListSort}
          />
          <Separator />
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
            {events.length === 0 ? (
              <Empty className="border-0 p-6 md:p-8">
                <EmptyHeader>
                  <EmptyTitle>{messages.noResults}</EmptyTitle>
                  <EmptyDescription>{messages.weekendNearYou}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => resetExploreFilters({ clearSearch: true })}
                    >
                      {messages.clearFilters}
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setSubmitOpen(true)}>
                      {messages.missingRace}
                    </Button>
                  </div>
                </EmptyContent>
              </Empty>
            ) : (
              <ItemGroup>
                {sortedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    messages={messages}
                    locale={locale}
                    distanceKm={eventDistanceKm(event, userOrigin)}
                    active={event.id === selectedId}
                    onClick={() => selectEvent(event.id)}
                  />
                ))}
              </ItemGroup>
            )}
          </div>
        </Card>

        {selected && (
          <EventDetailPanel
            event={selected}
            locale={locale}
            onClose={() => selectEvent(null)}
            onSelectSeries={applySeries}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 md:hidden">
        <Card
          className={cn(
            "pointer-events-auto flex min-h-0 flex-col gap-0 overflow-hidden overscroll-contain rounded-t-2xl rounded-b-none py-0 shadow-[0_-8px_32px_rgba(28,25,23,.12)]",
            mobileOpen ? "h-[min(50dvh,34rem)]" : "h-auto",
          )}
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            className="flex min-h-11 w-full shrink-0 touch-manipulation flex-col items-center justify-center pt-1.5"
            onClick={onSheetHandleClick}
            onPointerDown={onSheetHandlePointerDown}
            onPointerUp={onSheetHandlePointerUp}
            onPointerCancel={() => {
              sheetDragY.current = null;
            }}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? messages.sheetCollapse : messages.sheetExpand}
          >
            <span className="h-1 w-10 rounded-full bg-muted-foreground/40" />
          </button>

          {selected && !mobileOpen ? (
            <button
              type="button"
              className="flex min-h-11 w-full items-start gap-2 px-4 pb-3 text-left touch-manipulation"
              onClick={() => setMobileOpen(true)}
            >
              <span
                className="mt-2 size-2.5 shrink-0 rounded-full"
                style={{ background: disciplineColor(selected.disciplines) }}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold leading-snug">
                  {selected.name}
                </span>
                {selectedPeekMeta ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {selectedPeekMeta}
                  </span>
                ) : null}
              </span>
            </button>
          ) : (
            <Header
              messages={messages}
              locale={locale}
              onSubmitRace={() => setSubmitOpen(true)}
              onFeedback={() => setFeedbackOpen(true)}
              onSignIn={() => setAuthOpen(true)}
              compact
            />
          )}

          {mobileOpen && selected ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-1">
              <EventDetailPanel
                event={selected}
                locale={locale}
                embedded
                onClose={() => selectEvent(null)}
                onSelectSeries={applySeries}
              />
            </div>
          ) : null}

          {mobileOpen && !selected ? (
            <>
              <div className="relative z-30 flex min-h-12 shrink-0 items-center px-3 py-2">
                {renderFilterBar()}
              </div>
              <Separator />
              <ListToolbar
                count={events.length}
                pending={listLoading}
                sort={listSort}
                distanceEnabled={distanceEnabled}
                messages={messages}
                onSort={setListSort}
              />
              <Separator />
              <div ref={mobileListRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {events.length === 0 ? (
                  <Empty className="border-0 p-6">
                    <EmptyHeader>
                      <EmptyTitle>{messages.noResults}</EmptyTitle>
                      <EmptyDescription>{messages.weekendNearYou}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => resetExploreFilters({ clearSearch: true })}
                      >
                        {messages.clearFilters}
                      </Button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <ItemGroup>
                    {sortedEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        messages={messages}
                        locale={locale}
                        distanceKm={eventDistanceKm(event, userOrigin)}
                        active={event.id === selectedId}
                        onClick={() => selectEvent(event.id)}
                      />
                    ))}
                  </ItemGroup>
                )}
              </div>
            </>
          ) : null}

          {!mobileOpen && !selected ? (
            <p className="px-4 pb-2 text-xs text-muted-foreground tabular-nums">
              {events.length} {messages.racesCount}
            </p>
          ) : null}
        </Card>
      </div>

      <SubmitRaceModal open={submitOpen} onClose={() => setSubmitOpen(false)} messages={messages} />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => setAuthOpen(false)}
        locale={locale}
      />
    </div>
  );
}

function disciplineLabel(id: string): string {
  return DISCIPLINE_LABELS[id as Discipline] || id;
}

function ListToolbar({
  count,
  pending,
  sort,
  distanceEnabled,
  messages,
  onSort,
}: {
  count: number;
  pending: boolean;
  sort: EventSort;
  distanceEnabled: boolean;
  messages: Messages;
  onSort: (sort: EventSort) => void;
}) {
  const distanceItem = (
    <ToggleGroupItem
      value="distance"
      disabled={!distanceEnabled}
      className={cn(!distanceEnabled && "disabled:pointer-events-auto")}
      aria-label={
        distanceEnabled
          ? messages.sortDistance
          : `${messages.sortDistance}. ${messages.sortNeedsLocation}`
      }
    >
      {messages.sortDistance}
    </ToggleGroupItem>
  );

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2">
      <span
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums"
        aria-live="polite"
        aria-busy={pending}
      >
        {count} {messages.racesCount}
        <span className="inline-flex size-4 shrink-0 items-center justify-center" aria-hidden={!pending}>
          {pending ? <Spinner className="size-3.5" /> : null}
        </span>
      </span>
      <div className="flex items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="xs"
          value={sort}
          onValueChange={(value) => {
            if (value === "date" || value === "distance") onSort(value);
          }}
          aria-label={messages.sortBy}
        >
          <ToggleGroupItem value="date">{messages.date}</ToggleGroupItem>
          {distanceEnabled ? (
            distanceItem
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>{distanceItem}</TooltipTrigger>
              <TooltipContent>{messages.sortNeedsLocation}</TooltipContent>
            </Tooltip>
          )}
        </ToggleGroup>
      </div>
    </div>
  );
}

function Header({
  messages,
  locale,
  onSubmitRace,
  onFeedback,
  onSignIn,
  compact,
}: {
  messages: Messages;
  locale: string;
  onSubmitRace: () => void;
  onFeedback: () => void;
  onSignIn: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between border-b px-3",
        compact ? "h-11" : "h-12",
      )}
    >
      <BrandMark href={`/${locale}`} size={compact ? "sm" : "md"} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={messages.more}
            className="size-8"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {messages.language}
                  <span className="ml-auto text-xs text-muted-foreground">{locale.toUpperCase()}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {locales.map((l) => (
                      <DropdownMenuItem key={l} asChild>
                        <Link href={`/${l}`} aria-current={l === locale ? "page" : undefined}>
                          <Check aria-hidden className={l === locale ? undefined : "opacity-0"} />
                          {l.toUpperCase()}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={onSignIn}>{messages.signIn}</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/account`}>{messages.account}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/calendar`}>{messages.myCalendar}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSubmitRace}>
                <Flag />
                {messages.missingRace}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onFeedback}>Feature / feedback…</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">{messages.admin}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function EventCard({
  event,
  messages,
  locale,
  distanceKm: km,
  active,
  onClick,
}: {
  event: EventListItem;
  messages: Messages;
  locale: string;
  distanceKm?: number | null;
  active: boolean;
  onClick: () => void;
}) {
  const level =
    event.uciClass?.toUpperCase() ||
    event.classLabel ||
    RACE_LEVEL_LABELS[(event.level || "local") as RaceLevel] ||
    event.level;
  const audienceLabel = formatEventCategoryLabel(event, {
    kids: messages.kids,
    youth: messages.youth,
    adults: messages.adults,
  });
  const discLabel = event.disciplines.map((d) => disciplineLabel(d)).filter(Boolean).join(", ");
  const distanceLabel = km != null ? formatDistanceKm(km, locale) : "";
  const meta = [
    format(parseISO(event.startDate), "d MMM yyyy") +
      (event.endDate && event.endDate !== event.startDate
        ? `–${format(parseISO(event.endDate), "d MMM")}`
        : ""),
    level,
    event.series?.name,
  ]
    .filter(Boolean)
    .join(" · ");
  const place = [
    event.location?.municipality || event.location?.name || "—",
    event.location?.countryCode,
    distanceLabel,
    discLabel,
    audienceLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Item
      asChild
      size="sm"
      variant={active ? "muted" : "default"}
      className="rounded-none border-x-0 border-t-0 hover:bg-accent/50"
    >
      <button
        type="button"
        data-event-id={event.id}
        onClick={onClick}
        className="w-full min-h-11 scroll-my-2 text-left touch-manipulation"
      >
        <ItemContent>
          <ItemHeader>
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: disciplineColor(event.disciplines) }}
                aria-hidden
              />
              {meta}
            </span>
          </ItemHeader>
          <ItemTitle className="text-[15px]">{event.name}</ItemTitle>
          <ItemDescription className="line-clamp-1">{place}</ItemDescription>
        </ItemContent>
      </button>
    </Item>
  );
}

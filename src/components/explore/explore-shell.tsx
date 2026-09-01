"use client";

import { Suspense, useMemo, useRef, useState, useEffect, type CSSProperties } from "react";
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
import { MapAccountButton } from "@/components/explore/map-account-button";
import { WelcomeCard } from "@/components/explore/welcome-card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { coldStartCenter, foldPlaceQuery } from "@/lib/coverage";
import { disciplineColor } from "@/lib/map-visuals";
import {
  eventDistanceKm,
  formatDistanceKm,
  sortEvents,
  distanceKm,
  type EventSort,
} from "@/lib/geo/distance";
import { expandViewport, viewportNeedsFetch } from "@/lib/geo/viewport";

/** Rows built on load, and the step the list grows by as it is scrolled. */
const LIST_WINDOW = 40;
import { format, parseISO } from "date-fns";
import { MoreHorizontal, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { thisWeekendRange } from "@/lib/date-presets";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import { MobileTopBar } from "@/components/explore/mobile-top-bar";
import { MobileFiltersSheet } from "@/components/explore/mobile-filters-sheet";
import { MobileSearchSheet } from "@/components/explore/mobile-search-sheet";

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
  sort: parseAsString.withDefault(""),
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
  const [mobilePanel, setMobilePanel] = useState<"closed" | "list" | "detail">("list");
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
  const [mobileSheetReady, setMobileSheetReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [listSnap, setListSnap] = useState<number>(0.5);

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
    filters.sort === "date" || !distanceEnabled ? "date" : "distance";

  const sortedEvents = useMemo(
    () => sortEvents(events, listSort, userOrigin),
    [events, listSort, userOrigin],
  );

  /**
   * A viewport over central Europe routinely holds a couple of hundred races,
   * and every one of them used to be built and hydrated on load to fill a list
   * that shows about ten at a time. The window grows as the list is scrolled,
   * and always covers the selected race so that clicking a map pin can still
   * scroll its card into view.
   */
  const [visibleCount, setVisibleCount] = useState(LIST_WINDOW);
  const listEndRef = useRef<HTMLDivElement>(null);
  const mobileListEndRef = useRef<HTMLDivElement>(null);

  // A new result set starts the window over. Adjusting during render rather
  // than in an effect avoids a pass where the old window is applied to new
  // events.
  const [windowedEvents, setWindowedEvents] = useState(sortedEvents);
  if (windowedEvents !== sortedEvents) {
    setWindowedEvents(sortedEvents);
    setVisibleCount(LIST_WINDOW);
  }

  const selectedIndex = useMemo(
    () => (selectedId ? sortedEvents.findIndex((e) => e.id === selectedId) : -1),
    [selectedId, sortedEvents],
  );
  // A race picked on the map may sit past the window; widen to reach it so its
  // card exists for the scroll below.
  const effectiveCount =
    selectedIndex >= visibleCount ? selectedIndex + LIST_WINDOW : visibleCount;

  useEffect(() => {
    if (effectiveCount >= sortedEvents.length) return;
    const grow = () =>
      setVisibleCount((prev) => (prev >= sortedEvents.length ? prev : prev + LIST_WINDOW));
    // Both lists are in the DOM at all times and only one is laid out, so the
    // hidden one's sentinel would otherwise read as permanently on screen and
    // pull the whole catalogue in at once. Watch each sentinel inside its own
    // scroller, and only while that scroller has a height.
    const observers = [
      [listRef.current, listEndRef.current] as const,
      [mobileListRef.current, mobileListEndRef.current] as const,
    ]
      .filter(([root, end]) => root && end && root.offsetHeight > 0)
      .map(([root, end]) => {
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) grow();
          },
          { root, rootMargin: "600px" },
        );
        observer.observe(end!);
        return observer;
      });
    return () => observers.forEach((o) => o.disconnect());
  }, [effectiveCount, sortedEvents.length]);

  const visibleEvents = useMemo(
    () => sortedEvents.slice(0, effectiveCount),
    [sortedEvents, effectiveCount],
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
    void setFilters({ sort: next });
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
    // `effectiveCount` is a dependency because selecting a race further down
    // the list widens the window first; without it this would run against a
    // card that has not been built yet and quietly scroll nowhere.
  }, [selectedId, effectiveCount]);

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
    setMobileSheetReady(true);
    mq.addEventListener("change", apply);
    window.addEventListener("resize", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  const mapPadding = useMemo(() => {
    if (!isDesktop) {
      const peek = selected ? 220 : 112;
      const open =
        mobilePanel === "detail"
          ? Math.round(Math.min(viewportH * 0.92, 720))
          : Math.round(Math.min(viewportH * (typeof listSnap === "number" ? listSnap : 0.5), 640));
      return {
        top: 16,
        right: 12,
        bottom: (mobilePanel === "closed" ? peek : open) + 12,
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
  }, [selected, isDesktop, mobilePanel, viewportH, listSnap]);

  function renderFilterBar(opts?: { hideSearch?: boolean; allFilters?: boolean }) {
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

  const df = dateFnsLocale(locale);
  const selectedPeekMeta = selected
    ? [
        format(parseISO(selected.startDate), "d MMM", { locale: df }),
        selected.location?.municipality || selected.location?.name,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const peekSnap = selected ? "220px" : "112px";
  const midSnap = 0.5;
  const fullSnap = 0.92;
  const sheetSnap =
    mobilePanel === "closed" ? peekSnap : mobilePanel === "detail" ? fullSnap : listSnap;

  const weekend = thisWeekendRange();
  const isThisWeekend = filters.dateFrom === weekend.from && filters.dateTo === weekend.to;
  const weekendLabel = isThisWeekend
    ? messages.thisWeekend
    : filters.dateFrom && filters.dateTo
      ? `${format(parseISO(filters.dateFrom), "d MMM", { locale: df })} – ${format(parseISO(filters.dateTo), "d MMM", { locale: df })}`
      : filters.dateFrom
        ? format(parseISO(filters.dateFrom), "d MMM", { locale: df })
        : messages.date;
  const filterCount =
    (filters.disciplines.length ? 1 : 0) +
    (filters.categories.length ? 1 : 0) +
    (filters.levels.length ? 1 : 0) +
    (filters.country ? 1 : 0) +
    (filters.series ? 1 : 0) +
    (isThisWeekend ? 0 : 1);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-stone-100">
      <div
        className="absolute inset-0"
        style={{ "--map-sheet-inset": `${mapPadding.bottom}px` } as CSSProperties}
      >
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-stone-200 text-sm text-stone-500">
              Loading map…
            </div>
          }
        >
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
              setMobilePanel("closed");
            }}
            onBackgroundClick={() => {
              if (!isDesktop) setMobilePanel("closed");
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
            locale={locale}
            myLocationLabel={messages.myLocation}
            locationDeniedLabel={messages.locationDenied}
          />
        </Suspense>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-end p-3">
        <MapAccountButton
          locale={locale}
          messages={messages}
          onSignIn={() => setAuthOpen(true)}
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
                {visibleEvents.map((event) => (
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
                <div ref={listEndRef} aria-hidden />
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

      {mobileSheetReady ? (
      <Drawer
        open
        dismissible={false}
        modal={false}
        shouldScaleBackground={false}
        setBackgroundColorOnScale={false}
        noBodyStyles
        repositionInputs={false}
        snapToSequentialPoint
        snapPoints={[peekSnap, midSnap, fullSnap]}
        fadeFromIndex={2}
        activeSnapPoint={sheetSnap}
        setActiveSnapPoint={(point) => {
          if (point == null || point === peekSnap) {
            setMobilePanel("closed");
            return;
          }
          if (point === midSnap || point === fullSnap) {
            setListSnap(point);
            setMobilePanel((panel) => (panel === "detail" ? "detail" : "list"));
          }
        }}
      >
        <DrawerContent
          showOverlay={false}
          style={{ height: "100dvh", maxHeight: "100dvh" }}
          className="z-20 overflow-hidden rounded-t-2xl border-0 bg-card pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(28,25,23,.12)] data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:h-[100dvh] data-[vaul-drawer-direction=bottom]:max-h-[100dvh] md:hidden"
        >
          <DrawerHandle aria-label={mobilePanel === "closed" ? messages.sheetExpand : messages.sheetCollapse} />
          <DrawerTitle className="sr-only">{messages.racesCount}</DrawerTitle>
          <MobileTopBar
            homeHref={`/${locale}`}
            weekendLabel={weekendLabel}
            weekendActive={isThisWeekend}
            onWeekend={() => {
              if (isThisWeekend) {
                setFiltersOpen(true);
                return;
              }
              const w = thisWeekendRange();
              setDateRange(w.from, w.to);
            }}
            filtersLabel={messages.addFilter}
            filterCount={filterCount}
            onFilters={() => setFiltersOpen(true)}
            searchLabel={messages.search}
            searchActive={Boolean(filters.q.trim())}
            onSearch={() => setSearchOpen(true)}
            sort={listSort}
            sortByLabel={messages.sortBy}
            sortDateLabel={messages.sortByDate}
            sortDistanceLabel={messages.sortByDistance}
            sortDateShort={messages.date}
            sortDistanceShort={messages.sortDistance}
            sortNeedsLocationLabel={messages.sortNeedsLocation}
            distanceEnabled={distanceEnabled}
            onSort={setListSort}
            menu={
              <ExploreMenu
                messages={messages}
                locale={locale}
                onSubmitRace={() => setSubmitOpen(true)}
                onFeedback={() => setFeedbackOpen(true)}
                onSignIn={() => setAuthOpen(true)}
                compact
              />
            }
          />

          {mobilePanel === "closed" && selected ? (
            <div className="flex items-start gap-3 px-4 pb-3">
              <button
                type="button"
                className="flex min-h-11 min-w-0 flex-1 items-start gap-2 text-left touch-manipulation"
                onClick={() => setMobilePanel("detail")}
              >
                <span
                  className="mt-2 size-2.5 shrink-0 rounded-full"
                  style={{ background: disciplineColor(selected.disciplines) }}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold leading-snug">
                    {selected.name}
                  </span>
                  {selectedPeekMeta ? (
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {selectedPeekMeta}
                    </span>
                  ) : null}
                </span>
              </button>
              {selected.registrationUrl || selected.websiteUrl || selected.listingUrl ? (
                <Button asChild size="sm" className="mt-0.5 h-11 shrink-0 px-3">
                  <a
                    href={
                      selected.registrationUrl || selected.websiteUrl || selected.listingUrl || "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink data-icon="inline-start" />
                    {selected.registrationUrl ? messages.register : messages.openWebsite}
                  </a>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-0.5 h-11 shrink-0"
                  onClick={() => setMobilePanel("detail")}
                >
                  {messages.sheetExpand}
                </Button>
              )}
            </div>
          ) : null}


          {mobilePanel === "detail" && selected ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-1">
              <EventDetailPanel
                event={selected}
                locale={locale}
                embedded
                onClose={() => {
                  setListSnap(midSnap);
                  setMobilePanel("list");
                }}
                onSelectSeries={(slug) => {
                  applySeries(slug);
                  setListSnap(midSnap);
                  setMobilePanel("list");
                }}
              />
            </div>
          ) : null}

          {mobilePanel !== "detail" ? (
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
                    {visibleEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        messages={messages}
                        locale={locale}
                        distanceKm={eventDistanceKm(event, userOrigin)}
                        active={event.id === selectedId}
                        compact
                        onClick={() => {
                          selectEvent(event.id);
                          setMobilePanel("detail");
                        }}
                      />
                    ))}
                    <div ref={mobileListEndRef} aria-hidden />
                  </ItemGroup>
                )}
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
      ) : null}

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
        onDiscipline={setDiscipline}
        onLevel={toggleLevel}
        onClearDisciplines={clearDisciplines}
        onClearLevels={clearLevels}
        onClearCategories={clearCategories}
        onSeries={setSeries}
        onCountry={setCountry}
        onReset={() => resetExploreFilters()}
      />
      <MobileSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        messages={messages}
        q={filters.q}
        onQ={handleSearchChange}
        onSubmit={handleSearchSubmit}
      />

      <SubmitRaceModal open={submitOpen} onClose={() => setSubmitOpen(false)} messages={messages} />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => setAuthOpen(false)}
        locale={locale}
      />
      <WelcomeCard messages={messages} onSignIn={() => setAuthOpen(true)} />
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
      <ExploreMenu
        messages={messages}
        locale={locale}
        onSubmitRace={onSubmitRace}
        onFeedback={onFeedback}
        onSignIn={onSignIn}
        compact
      />
    </div>
  );
}

function ExploreMenu({
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon-sm" : "icon"}
          aria-label={messages.more}
          className={compact ? "size-8" : "size-11 shrink-0 rounded-full"}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} className="w-56">
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
          <DropdownMenuItem onSelect={onSubmitRace}>{messages.missingRace}</DropdownMenuItem>
          <DropdownMenuItem onSelect={onFeedback}>Feature / feedback…</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin">{messages.admin}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EventCard({
  event,
  messages,
  locale,
  distanceKm: km,
  active,
  compact,
  onClick,
}: {
  event: EventListItem;
  messages: Messages;
  locale: string;
  distanceKm?: number | null;
  active: boolean;
  compact?: boolean;
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
  const df = dateFnsLocale(locale);
  const meta = [
    format(parseISO(event.startDate), "d MMM yyyy", { locale: df }) +
      (event.endDate && event.endDate !== event.startDate
        ? `–${format(parseISO(event.endDate), "d MMM", { locale: df })}`
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

  const compactPlace = [
    format(parseISO(event.startDate), "d MMM", { locale: df }),
    event.location?.municipality || event.location?.name,
    distanceLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Item
      asChild
      size="sm"
      variant={active ? "muted" : "default"}
      className="rounded-none border-0 shadow-[inset_0_-1px_0_0_var(--border)] last:shadow-none hover:bg-accent/50"
    >
      <button
        type="button"
        data-event-id={event.id}
        onClick={onClick}
        className="w-full min-h-12 scroll-my-2 text-left touch-manipulation md:min-h-11"
      >
        <ItemContent>
          {compact ? null : (
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
          )}
          <ItemTitle className={cn("text-[15px]", compact && "flex items-center gap-1.5")}>
            {compact ? (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: disciplineColor(event.disciplines) }}
                aria-hidden
              />
            ) : null}
            {event.name}
          </ItemTitle>
          <span className="line-clamp-1 text-sm leading-normal text-muted-foreground">
            {compact ? compactPlace : place}
          </span>
        </ItemContent>
      </button>
    </Item>
  );
}

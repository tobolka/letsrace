"use client";

import { Suspense, memo, type CSSProperties, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQueryStates, parseAsString, parseAsArrayOf } from "nuqs";
import { RaceMapLazy as RaceMap, type MapBounds } from "@/components/map/race-map-lazy";
import {
  INT_COUNTRY,
  MapFilterBar,
  seriesCountryKey,
  type SeriesOption,
} from "@/components/explore/map-filter-bar";
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import type { EventListItem } from "@/lib/events";
import type { Messages } from "@/lib/i18n/messages";
import { DISCIPLINE_LABELS, type Discipline } from "@/lib/taxonomy";
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
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { thisWeekendRange } from "@/lib/date-presets";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { BrandMark } from "@/components/brand-mark";
import { SITE_NAME } from "@/lib/seo";
import { ListSkeleton } from "@/components/explore/list-skeleton";
import { listViewState } from "@/lib/list-view-state";
import { cn } from "@/lib/utils";
import { MobileTopBar } from "@/components/explore/mobile-top-bar";

const EventDetailPanel = dynamic(
  () =>
    import("@/components/explore/event-detail-panel").then((m) => ({
      default: m.EventDetailPanel,
    })),
);
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
const MobileSearchSheet = dynamic(
  () =>
    import("@/components/explore/mobile-search-sheet").then((m) => ({
      default: m.MobileSearchSheet,
    })),
);

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
  const [mobilePanel, setMobilePanel] = useState<"list" | "detail">("list");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [listLoading, setListLoading] = useState(false);
  /**
   * The rows are placeholders until the map settles on its bounds and the list
   * is fetched for them. Nothing is rendered before that: the server used to
   * send a guess, and swapping it for the real set lifted the rows by five
   * cards' worth — the whole of this page's layout shift.
   */
  const [listSettled, setListSettled] = useState(false);
  const fetchStartedRef = useRef(false);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  /**
   * What the camera actually shows, insets and all.
   *
   * `bounds` is the box the panel leaves free, and it is the right one to
   * decide when more races have to be fetched. It is the wrong one to decide
   * what the list names: it is inset on every side, so a pin plainly visible
   * near the bottom of the map fell out of the list beside it.
   */
  const [cameraBounds, setCameraBounds] = useState<MapBounds | null>(null);
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
  const [listSnap, setListSnap] = useState<number | string>(0.5);
  // A tapped pin opens the card at half height, the way Maps does it: the map
  // stays on screen above it, and dragging up is how you ask for the rest.
  const [detailSnap, setDetailSnap] = useState<number>(0.5);

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

  /*
   * `memo` on a row is worth nothing if the row is handed a new closure on
   * every render, so the two lists keep one handler each. The ref is what lets
   * them stay stable while still seeing the latest `events`.
   */
  const selectEventRef = useRef(selectEvent);
  selectEventRef.current = selectEvent;
  const selectFromList = useCallback((id: string) => {
    selectEventRef.current(id);
  }, []);
  const selectFromSheet = useCallback((id: string) => {
    selectEventRef.current(id);
    setMobilePanel("detail");
  }, []);

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
    const box = cameraBounds;
    if (!box || filters.series || filters.country) return events;
    if (filters.q.trim() && !lastPlacedQ.current) return events;
    return events.filter((e) => {
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
  }, [events, cameraBounds, selectedId, filters.series, filters.country, filters.q]);

  const sortedEvents = useMemo(
    () => sortEvents(visibleEvents, listSort, userOrigin),
    [visibleEvents, listSort, userOrigin],
  );

  useEffect(() => {
    if (listSettled) return;
    // The map is what asks for the list, so if it never reports bounds — no
    // WebGL, a blocked tile host, a thrown error — nothing would ever be
    // requested and the list would stay empty for good. Ask without bounds
    // instead, which is the whole date range: the same set the server used to
    // render. A timeout that fired while a request was already in flight would
    // show one list and then replace it, which is the shift this exists to
    // prevent, so it only acts when nothing has been asked for at all.
    const t = window.setTimeout(() => {
      if (!fetchStartedRef.current) void refetch({ skipBounds: true });
    }, 2500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listSettled]);

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
  }, [selectedId, mobilePanel, listSettled]);

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

  /**
   * Returns what was fetched, so a caller that needs to know whether the
   * search found anything can wait for it. Superseded fetches resolve to null.
   */
  function refetch(overrides: Record<string, unknown> = {}): Promise<EventListItem[] | null> {
    const gen = ++eventsFetchGen.current;
    fetchStartedRef.current = true;
    setListLoading(true);
    return (async () => {
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
      /*
       * Fetch the padded box, and remember that we did.
       *
       * A viewport fetch asks for a box grown on every side, so races load just
       * before they enter the frame, and records that box as what it holds. A
       * filter change used to ask for the bare camera box instead while leaving
       * the record alone — so after changing the date we held races for what
       * was on screen but still claimed the padded ring around it. Zoom out a
       * little and nothing refetched, because we believed we already had that
       * ground; the ring came up empty.
       */
      const explicit = overrides.bounds as typeof bounds | undefined;
      const b = skipBounds ? null : (explicit ?? (bounds ? expandViewport(bounds) : null));
      if (b) lastAreaRef.current = b;
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
        if (gen !== eventsFetchGen.current) return null;
        const focusSlug = filters.e;
        setEvents((prev) => {
          if (!focusSlug) return data;
          const kept =
            data.find((e) => e.slug === focusSlug) ?? prev.find((e) => e.slug === focusSlug);
          if (!kept || data.some((e) => e.id === kept.id)) return data;
          return [kept, ...data];
        });
        if (overrides.fitMap) setFitSeq((n) => n + 1);
        return data;
      } catch {
        return null;
      } finally {
        if (gen === eventsFetchGen.current) {
          setListLoading(false);
          setListSettled(true);
        }
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
    if (!trimmed) {
      lastPlacedQ.current = "";
      void refetch({ q: "" });
      return;
    }

    // Typed text is a race name first. Half the race names in this catalogue
    // are also places — Sudety, Vysočina, Beskydy — and geocoding those threw
    // away the query, flew the map somewhere, and reported nothing found for a
    // race that is in the catalogue. Only when no race matches is the text
    // treated as a place to go to.
    lastPlacedQ.current = "";
    // A search is a find, not a filter: the date window goes too, so a race in
    // October is not missing just because the bar still said "this weekend".
    // Clearing it rather than ignoring it keeps the chip honest about what ran.
    void setFilters({ dateFrom: "", dateTo: "" });
    const hits = await refetch({
      q: trimmed,
      dateFrom: "",
      dateTo: "",
      skipBounds: true,
      fitMap: true,
    });
    if (gen !== searchGen.current) return;
    if (hits === null || hits.length > 0) return;

    if (trimmed.length >= 3) {
      const ok = await flyToPlace(trimmed, gen);
      if (gen !== searchGen.current) return;
      if (ok) return;
    }
  }

  function handleSearchChange(q: string) {
    void setFilters({ q });
    window.clearTimeout(searchTimerRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      lastPlacedQ.current = "";
      searchGen.current += 1;
      placeAbortRef.current?.abort();
      void refetch({ q: trimmed });
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
    // A name search is a find, not a filter on the current window: let the map
    // move without quietly dropping matches that sit outside it.
    if (filters.q.trim() && !lastPlacedQ.current) return;
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
      const snap = mobilePanel === "detail" ? deferredDetailSnap : deferredListSnap;
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
    const listW = 400 + 12 + 12;
    const detailW = selected ? 320 + 12 : 0;
    return {
      top: 16,
      right: 56,
      bottom: 56,
      left: listW + detailW + 64,
    };
  }, [selected, isDesktop, mobilePanel, viewportH, deferredListSnap, deferredDetailSnap]);

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
  const minSnap = "112px";
  const midSnap = 0.5;
  const fullSnap = 0.92;
  const sheetSnap = mobilePanel === "detail" ? detailSnap : listSnap;

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

  const listView = listViewState({ settled: listSettled, count: visibleEvents.length });

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-stone-100">
      <div
        className="absolute inset-0"
        style={{ "--map-sheet-inset": `${mapPadding.bottom}px` } as CSSProperties}
      >
        <Suspense
          fallback={
            // The same ground the route's skeleton paints, so the handover
            // between the two is invisible. Bare "Loading map…" text in the
            // middle of the screen was the one part of the load that announced
            // itself, and it announced a wait rather than progress.
            <div className="h-full w-full animate-pulse bg-stone-200" role="status">
              <span className="sr-only">{messages.mapLoading}</span>
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
              setDetailSnap(midSnap);
              setMobilePanel("detail");
            }}
            onBackgroundClick={() => {
              // Tapping the map is a request to see it: collapse to the bar.
              if (!isDesktop) {
                setListSnap(minSnap);
                setMobilePanel("list");
              }
            }}
            onBoundsChange={(b, reason, camera) => {
              setBounds(b);
              // The padded box decides when to fetch; the camera box decides
              // what the list shows. If a pin is on the map it belongs in the
              // list beside it.
              setCameraBounds(camera);
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
        <span aria-hidden className="hidden md:block" />
        <MapAccountButton
          locale={locale}
          messages={messages}
          onSignIn={() => setAuthOpen(true)}
          onSubmitRace={() => setSubmitOpen(true)}
          onFeedback={() => setFeedbackOpen(true)}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 hidden items-start p-3 md:flex md:gap-3">
        <Card className="pointer-events-auto flex h-full w-[400px] flex-col gap-0 overflow-hidden py-0 shadow-lg">
          <Header locale={locale} />
          <div className="relative z-30 flex min-h-12 shrink-0 items-center px-3 py-2">
            {renderFilterBar()}
          </div>
          <Separator />
          <ListToolbar
            count={listSettled ? visibleEvents.length : null}
            pending={listLoading}
            sort={listSort}
            distanceEnabled={distanceEnabled}
            messages={messages}
            onSort={setListSort}
          />
          <Separator />
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
            {listView === "empty" ? (
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
                {listView === "skeleton" ? <ListSkeleton rows={8} /> : null}
                {listView === "rows"
                  ? sortedEvents.map((event) => (
                  <div role="listitem" key={event.id} className="border-b border-border/50 last:border-b-0">
                  <EventCard
                    event={event}
                    locale={locale}
                    distanceKm={eventDistanceKm(event, userOrigin)}
                    active={event.id === selectedId}
                    onSelect={selectFromList}
                  />
                  </div>
                    ))
                  : null}
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
        snapPoints={[minSnap, midSnap, fullSnap]}
        fadeFromIndex={2}
        activeSnapPoint={sheetSnap}
        setActiveSnapPoint={(point) => {
          if (point == null) return;
          // Dragging the sheet sets the height of whichever thing is in it.
          // Pulling a race card down puts the list back rather than stranding
          // the sheet on a race you can no longer see.
          if (mobilePanel === "detail") {
            if (point === minSnap) {
              setListSnap(minSnap);
              setMobilePanel("list");
            } else if (typeof point === "number") setDetailSnap(point);
            return;
          }
          setListSnap(point);
        }}
      >
        <DrawerContent
          showOverlay={false}
          style={{ height: "100dvh", maxHeight: "100dvh" }}
          className="z-20 overflow-hidden rounded-t-2xl border-0 bg-card pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(28,25,23,.12)] data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:h-[100dvh] data-[vaul-drawer-direction=bottom]:max-h-[100dvh] md:hidden"
        >
          <DrawerHandle aria-label={sheetSnap === minSnap ? messages.sheetExpand : messages.sheetCollapse} />
          <DrawerTitle className="sr-only">{messages.racesCount}</DrawerTitle>
          {/* A race detail is its own panel: filters belong to the list it covers. */}
          {mobilePanel !== "detail" ? (
          <MobileTopBar
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
          />
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
                {listView === "empty" ? (
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
                    {listView === "skeleton" ? <ListSkeleton rows={8} /> : null}
                    {listView === "rows" && sortedEvents.map((event) => (
                      <div role="listitem" key={event.id} className="border-b border-border/50 last:border-b-0">
                      <EventCard
                        event={event}
                        locale={locale}
                        distanceKm={eventDistanceKm(event, userOrigin)}
                        active={event.id === selectedId}
                        onSelect={selectFromSheet}
                      />
                      </div>
                    ))}
                  </ItemGroup>
                )}
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
      ) : null}

      {filtersOpen ? (
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
      ) : null}
      {searchOpen ? (
        <MobileSearchSheet
          open={searchOpen}
          onOpenChange={setSearchOpen}
          messages={messages}
          q={filters.q}
          onQ={handleSearchChange}
          onSubmit={handleSearchSubmit}
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
  count: number | null;
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
        {/* Until the map has fetched its own set there is no count, and the
            bare noun on its own — "races", with nothing in front of it — reads
            as a label whose value went missing. A placeholder says "counting"
            the way the rows below it do, and makes the spinner beside it
            redundant; that is for a refetch, when a count is already showing. */}
        {count == null ? (
          <span aria-hidden className="h-3 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <>
            {`${count} ${messages.racesCount}`}
            <span
              className="inline-flex size-4 shrink-0 items-center justify-center"
              aria-hidden={!pending}
            >
              {pending ? <Spinner className="size-3.5" /> : null}
            </span>
          </>
        )}
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

function Header({ locale, compact }: { locale: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between border-b px-3",
        compact ? "h-11" : "h-12",
      )}
    >
      <BrandMark href={`/${locale}`} size={compact ? "sm" : "md"} />
    </div>
  );
}

/**
 * One race in the list.
 *
 * Memoised because the shell re-renders for reasons that have nothing to do
 * with any race in it — the sheet moving, the map settling — and without this
 * every visible card was rebuilt each time, in the middle of an animation.
 */
const EventCard = memo(function EventCard({
  event,
  locale,
  distanceKm: km,
  active,
  onSelect,
}: {
  event: EventListItem;
  locale: string;
  distanceKm?: number | null;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const discLabel = event.disciplines.map((d) => disciplineLabel(d)).filter(Boolean).join(", ");
  const distanceLabel = km != null ? formatDistanceKm(km, locale) : "";
  const df = dateFnsLocale(locale);
  const dateLabel =
    format(parseISO(event.startDate), "d MMM", { locale: df }) +
    (event.endDate && event.endDate !== event.startDate
      ? `–${format(parseISO(event.endDate), "d MMM", { locale: df })}`
      : "");
  /*
    One line under the name, the same on a phone and on a desktop. The level is
    gone from it — almost every race is "Local", so the word was a column of
    noise — and so is who it is for: "Amateur · Masters" is true of nearly all
    of them and tells you nothing about which one to pick. The discipline is
    the fact that actually sorts one race from another.
  */
  const meta = [
    dateLabel,
    event.location?.municipality || event.location?.name || "—",
    event.location?.countryCode,
    distanceLabel,
    discLabel,
    event.series?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Item
      asChild
      size="sm"
      // The dividing line lives on the listitem wrapper now — inside it this
      // button is always the last child, so `last:` here would never not match.
      className={cn(
        "rounded-none border-0 px-4 py-2.5 hover:bg-accent/50",
        // `muted/50` over a near-white ground was a shade nobody could see. The
        // race you picked is the one thing on this list worth finding again
        // after you look away from it.
        active && "bg-stone-200/80 hover:bg-stone-200/80 dark:bg-stone-800",
      )}
    >
      <button
        type="button"
        data-event-id={event.id}
        onClick={() => onSelect(event.id)}
        className="relative w-full scroll-my-2 text-left touch-manipulation"
      >
        {/*
          The discipline used to be a coloured dot beside the date, which on a
          white list reads as an unread badge — something to clear rather than
          something to tell races apart by. The same colour runs down the edge
          of both lines instead, saying as much without asking to be dismissed.
        */}
        <span
          aria-hidden
          className="absolute inset-y-2.5 left-1.5 w-[3px] rounded-full"
          style={{ background: disciplineColor(event.disciplines) }}
        />
        {/* Without this a flex child refuses to shrink below its content, and
            `truncate` on the rows inside does nothing but overflow. */}
        <ItemContent className="min-w-0 gap-0.5">
          {/*
            One line, cut with an ellipsis. The list is rebuilt when the map
            settles on its real bounds, and cards that change height as their
            names change length drag everything below them — which was the
            whole of this page’s layout shift.
          */}
          <ItemTitle
            // ItemTitle ships `w-fit`, which sizes it to its text and defeats
            // any truncation inside it.
            className="w-full min-w-0 text-sm leading-snug"
          >
            <span className="truncate">{event.name}</span>
          </ItemTitle>
          <span className="line-clamp-1 text-xs leading-snug text-muted-foreground">{meta}</span>
        </ItemContent>
      </button>
    </Item>
  );
});

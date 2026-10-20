"use client";

import { Suspense, type CSSProperties, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { parseAsInteger, useQueryState, useQueryStates } from "nuqs";
import { RaceMapLazy as RaceMap, type MapBounds } from "@/components/map/race-map-lazy";
import {
  MapFilterBar,
  seriesOutsideCountries,
  type SeriesOption,
} from "@/components/explore/map-filter-bar";
import { MapAccountButton } from "@/components/explore/map-account-button";
import { WelcomeCard } from "@/components/explore/welcome-card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FULL,
  COMPACT,
  LIST_PEEK,
  MobileDetailSheet,
  MobileListSheet,
} from "@/components/explore/mobile-sheets";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import type { EventListItem } from "@/lib/events";
import type { Messages } from "@/lib/i18n/messages";
import { coldStartCenter, foldPlaceQuery } from "@/lib/coverage";
import {
  eventDistanceKm,
  sortEvents,
  distanceKm,
  type EventSort,
} from "@/lib/geo/distance";
import { expandViewport, viewportNeedsFetch } from "@/lib/geo/viewport";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { thisWeekendRange, todayIso } from "@/lib/date-presets";
import { exploreSearchParams, RADIUS_PARAM } from "@/lib/explore-params";
import { DistanceFilter } from "@/components/shell/distance-filter";
import { boxAround, useUserOrigin } from "@/hooks/use-user-origin";
import { eventsWithinRadius } from "@/lib/geo/radius";
import { loadSeriesList } from "@/lib/series-list";
import {
  readExploreFilterPrefs,
  storedExploreFiltersToPatch,
  urlHasExploreFilterParams,
  writeExploreFilterPrefs,
} from "@/lib/explore-filter-storage";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { BrandMark } from "@/components/brand-mark";
import { BrandBar } from "@/components/shell/section-header";
import { SITE_NAME } from "@/lib/seo";
import { ListSkeleton } from "@/components/explore/list-skeleton";
import { listViewState } from "@/lib/list-view-state";
import { cn } from "@/lib/utils";
import { MobileTopBar } from "@/components/explore/mobile-top-bar";
import { EventCard } from "@/components/explore/event-rows";
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
const MobileSearchSheet = dynamic(
  () =>
    import("@/components/explore/mobile-search-sheet").then((m) => ({
      default: m.MobileSearchSheet,
    })),
);

const MAP_PANEL_W = 400;
const MIN_PANEL_W = 340;
const MAX_PANEL_W = 560;

/**
 * How wide the panel may be dragged. The full-width list is its own page now
 * (the rail's second icon), so the panel only ever trades room with the map.
 */
function panelMaxWidth() {
  const stage = document.getElementById("shell-stage");
  const room = (stage?.clientWidth ?? window.innerWidth) - 12 - 344;
  return Math.max(MAP_PANEL_W, Math.min(MAX_PANEL_W, room));
}

type Props = {
  initialEvents: EventListItem[];
  messages: Messages;
  locale: string;
};


/**
 * Keep the object a race already had when the fetch brought back the same race.
 *
 * Most of what a viewport query returns is what it returned last time, but
 * every row came back as a brand-new object, so every card was a new prop and
 * every memo was defeated: a background refetch — the one the map fires after
 * it finds you — re-rendered the whole list, and did it while the sheet was
 * moving.
 *
 * `last_seen_at` moves whenever the watcher touches a race, so it is the
 * cheapest honest test for "this row has not changed".
 */
function reuseUnchanged(prev: EventListItem[], next: EventListItem[]): EventListItem[] {
  if (prev.length === 0) return next;
  const before = new Map(prev.map((e) => [e.id, e]));
  let changed = prev.length !== next.length;
  const out = next.map((e, i) => {
    const old = before.get(e.id);
    const same =
      old &&
      old.lastSeenAt === e.lastSeenAt &&
      old.startDate === e.startDate &&
      old.name === e.name &&
      old.status === e.status;
    if (!same) changed = true;
    else if (prev[i]?.id !== e.id) changed = true;
    return same ? old : e;
  });
  return changed ? out : prev;
}

export function ExploreShell({ initialEvents, messages, locale }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const initialBoundsFetchDone = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [radius, setRadiusParam] = useQueryState(RADIUS_PARAM, parseAsInteger);
  const place = useUserOrigin();
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
  const distanceOrigin = userOrigin ?? place.origin;
  const radiusArea = useMemo(() => radius != null && radius > 0 && distanceOrigin
    ? { lat: distanceOrigin.lat, lng: distanceOrigin.lng, km: radius } : null,
    [radius, distanceOrigin]);
  const radiusEvents = useMemo(() => eventsWithinRadius(events, radiusArea), [events, radiusArea]);
  const { status: originStatus, locate: locateOrigin } = place;
  useEffect(() => {
    if (radius != null && !distanceOrigin && originStatus === "idle") locateOrigin();
  }, [radius, distanceOrigin, originStatus, locateOrigin]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has(RADIUS_PARAM)) return;
    try {
      const saved = Number(localStorage.getItem("letsrace.explore.radius.v1"));
      if (saved > 0) void setRadiusParam(saved);
    } catch { /* storage unavailable */ }
    // Restore once, matching the list and calendar's distance preference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function setRadius(km: number | null) {
    try {
      if (km == null) localStorage.removeItem("letsrace.explore.radius.v1");
      else localStorage.setItem("letsrace.explore.radius.v1", String(km));
    } catch { /* storage unavailable */ }
    void setRadiusParam(km);
    if (km != null) {
      selectEvent(null);
      if (!distanceOrigin) locateOrigin();
    }
  }

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
  const [listSnap, setListSnap] = useState<number | string>(COMPACT);
  // A tapped pin opens the card at compact height. The map stays visible above
  // it, and dragging up reveals the rest.
  const [detailSnap, setDetailSnap] = useState<number>(COMPACT);

  const fallbackCenter = useMemo(() => {
    const c = coldStartCenter(locale);
    return [c.lng, c.lat] as [number, number];
  }, [locale]);

  const [filters, setFilters] = useQueryStates(exploreSearchParams);
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
  const [prefsReady, setPrefsReady] = useState(false);

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
  // The card opens at compact height whichever way a race was picked — a row in
  // the list or a pin on the map — so it never comes up covering the map.
  const selectFromSheet = useCallback((id: string) => {
    setDetailSnap(COMPACT);
    selectEventRef.current(id);
  }, []);

  useEffect(() => {
    if (!filters.e) return;
    const hit = events.find((ev) => ev.slug === filters.e);
    if (hit && hit.id !== selectedId) setSelectedId(hit.id);
  }, [filters.e, events, selectedId]);

  // The cup and country pickers list what exists, not what survives the other
  // filters — "kids" on a single weekend left them empty and the menu bare.
  const seriesQuery = "";
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
    const box = cameraBounds;
    if (radiusArea || !box || filters.series || filters.country.length) return radiusEvents;
    if (filters.q.trim() && !lastPlacedQ.current) return radiusEvents;
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
  }, [radiusEvents, radiusArea, cameraBounds, selectedId, filters.series, filters.country, filters.q]);

  const sortedEvents = useMemo(
    () => sortEvents(visibleEvents, listSort, distanceOrigin),
    [visibleEvents, listSort, distanceOrigin],
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
    const next = filters.categories.includes(value)
      ? filters.categories.filter((a) => a !== value)
      : [...filters.categories, value];
    void setFilters({ categories: next });
    refetch({ categories: next });
  }

  function toggleDiscipline(value: string) {
    const next = filters.disciplines.includes(value)
      ? filters.disciplines.filter((d) => d !== value)
      : [...filters.disciplines, value];
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
    const seriesRow = seriesList.find((s) => s.slug === filters.series);
    const dropSeries = seriesOutsideCountries(seriesRow?.countryCode, filters.series, next);
    void setFilters({ country: next, ...(dropSeries ? { series: "" } : {}) });
    refetch({
      country: next,
      ...(dropSeries ? { series: "" } : {}),
      skipBounds: next.length > 0 || Boolean(filters.series && !dropSeries),
      fitMap: next.length > 0,
    });
  }

  function toggleCountry(code: string) {
    applyCountries(
      filters.country.includes(code)
        ? filters.country.filter((c) => c !== code)
        : [...filters.country, code],
    );
  }

  function clearCountries() {
    applyCountries([]);
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
      const country = (overrides.country as string[]) ?? filters.country;
      const dateFrom = (overrides.dateFrom as string) ?? filters.dateFrom;
      const dateTo = (overrides.dateTo as string) ?? filters.dateTo;
      const skipBounds =
        overrides.skipBounds === true ||
        (Boolean(series || country.length) && overrides.forceBounds !== true);
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
      const near = overrides.clearRadius ? null : radiusArea;
      const b = near ? boxAround(near, near.km) : skipBounds ? null : (explicit ?? (bounds ? expandViewport(bounds) : null));
      if (b) lastAreaRef.current = b;
      if (q) params.set("q", q);
      if (series) params.set("series", series);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (!dateFrom && !dateTo) params.set("anyDate", "1");
      categories.forEach((a) => params.append("categories", a));
      disciplines.forEach((d) => params.append("disciplines", d));
      levels.forEach((l) => params.append("levels", l));
      country.forEach((c) => params.append("country", c));
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
          const next = reuseUnchanged(prev, data);
          // A series or country is a find, and a race outside it has no place
          // in the answer — a German kids' cup was sitting under Dětský MTB Cup
          // because it had been open when the filter was picked.
          if (!focusSlug || series || country.length) return next;
          const kept =
            next.find((e) => e.slug === focusSlug) ?? prev.find((e) => e.slug === focusSlug);
          if (!kept || next.some((e) => e.id === kept.id)) return next;
          return [kept, ...next];
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

  const lastRadiusQuery = useRef("");
  useEffect(() => {
    if (!radiusArea) {
      if (lastRadiusQuery.current) {
        lastRadiusQuery.current = "";
        void refetch({ clearRadius: true });
      }
      return;
    }
    const key = `${radiusArea.lat}:${radiusArea.lng}:${radiusArea.km}`;
    if (key === lastRadiusQuery.current) return;
    lastRadiusQuery.current = key;
    const area = boxAround(radiusArea, radiusArea.km);
    void refetch({ bounds: area, forceBounds: true });
    setDestination(area); setDestinationSeq((n) => n + 1);
    // Radius/center define this query; camera movement does not change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusArea]);

  useEffect(() => {
    if (prefsReady) return;
    if (urlHasExploreFilterParams(window.location.search)) {
      setPrefsReady(true);
      return;
    }
    const stored = readExploreFilterPrefs();
    if (!stored) {
      setPrefsReady(true);
      return;
    }
    const patch = storedExploreFiltersToPatch(stored);
    let cancelled = false;
    void setFilters(patch).then(() => {
      if (cancelled) return;
      void refetch(patch);
      if (patch.sort === "distance") setLocateSeq((n) => n + 1);
      setPrefsReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Restore once on mount; refetch/setFilters are stable enough for this pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsReady]);

  useEffect(() => {
    if (!prefsReady) return;
    writeExploreFilterPrefs({
      q: filters.q,
      categories: filters.categories,
      disciplines: filters.disciplines,
      levels: filters.levels,
      series: filters.series,
      country: filters.country,
      sort: filters.sort,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
  }, [
    prefsReady,
    filters.q,
    filters.categories,
    filters.disciplines,
    filters.levels,
    filters.series,
    filters.country,
    filters.sort,
    filters.dateFrom,
    filters.dateTo,
  ]);

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
        country: [],
      });
      refetch({
        q: "",
        country: [],
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
    // A search is a find, not a filter: the date window widens to upcoming, so
    // a race in October is not missing just because the bar still said "this
    // weekend". Any date stays one click away for looking back.
    const upcoming = todayIso();
    void setFilters({ dateFrom: upcoming, dateTo: "" });
    const hits = await refetch({
      q: trimmed,
      dateFrom: upcoming,
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
    if (filters.series || filters.country.length) return;
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
  // The panel's width, and the live width while its edge is being dragged.
  const [mapWidth, setMapWidth] = useState(MAP_PANEL_W);
  const [dragW, setDragW] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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

  const weekend = thisWeekendRange();
  const isThisWeekend = filters.dateFrom === weekend.from && filters.dateTo === weekend.to;
  const weekendLabel = isThisWeekend
    ? messages.thisWeekend
    : filters.dateFrom && filters.dateTo
      ? filters.dateFrom === filters.dateTo
        ? format(parseISO(filters.dateFrom), "d MMM", { locale: df })
        : `${format(parseISO(filters.dateFrom), "d MMM", { locale: df })} – ${format(parseISO(filters.dateTo), "d MMM", { locale: df })}`
      : filters.dateFrom
        ? format(parseISO(filters.dateFrom), "d MMM", { locale: df })
        : messages.date;
  const filterCount =
    (filters.disciplines.length ? 1 : 0) +
    (filters.categories.length ? 1 : 0) +
    (filters.levels.length ? 1 : 0) +
    (filters.country.length ? 1 : 0) +
    (filters.series ? 1 : 0) +
    (radiusArea ? 1 : 0) +
    (isThisWeekend ? 0 : 1);

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
            "--map-panel-width": `${dragW ?? mapWidth}px`,
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
            <div className="h-full w-full animate-pulse bg-muted" role="status">
              <span className="sr-only">{messages.mapLoading}</span>
            </div>
          }
        >
          <RaceMap
            events={radiusEvents}
            selectedId={selectedId}
            hoveredId={hoveredId}
            radiusArea={radiusArea}
            padding={mapPadding}
            fitSeq={fitSeq}
            destination={destination}
            destinationSeq={destinationSeq}
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
              if (!isDesktop && selectedId) selectEvent(null);
            }}
            onBoundsChange={(b, reason, camera) => {
              setBounds(b);
              // The padded box decides when to fetch; the camera box decides
              // what the list shows. If a pin is on the map it belongs in the
              // list beside it.
              setCameraBounds(camera);
              if (radiusArea) { initialBoundsFetchDone.current = true; return; }
              // First camera settle → load races for this viewport (padded query box)
              if (!initialBoundsFetchDone.current) {
                initialBoundsFetchDone.current = true;
                if (filters.q.trim().length >= 3) {
                  void runSearch(filters.q);
                  return;
                }
                if (filters.series || filters.country.length) {
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
        {/* A desktop keeps the account at the foot of the sidebar. */}
        <span aria-hidden className="hidden md:block" />
        <div className="md:hidden">
        <MapAccountButton
          locale={locale}
          messages={messages}
          onSignIn={() => setAuthOpen(true)}
          onSubmitRace={() => setSubmitOpen(true)}
          onFeedback={() => setFeedbackOpen(true)}
        />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 hidden md:block">
        <div
          ref={panelRef}
          className={cn(
            "absolute inset-y-0 left-0 min-w-0",
            dragW == null &&
              "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          )}
          style={{
            width:
              dragW ?? mapWidth,
          }}
        >
        <div className="pointer-events-auto flex h-full w-full min-w-0 flex-col overflow-hidden border-r bg-card">
          <Header locale={locale} />
          <div className="relative z-30 flex min-h-12 shrink-0 items-center px-3 py-2">
            {renderFilterBar()}
          </div>
          <Separator />
          <ListToolbar
            count={listSettled ? visibleEvents.length : null}
            pending={listLoading}
            sort={listSort}
            distanceEnabled
            messages={messages}
            onSort={setListSort}
          />
          <Separator />
          <main id="race-list" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
            <div ref={listRef} className="@container min-h-0">
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
                    distanceKm={eventDistanceKm(event, distanceOrigin)}
                    active={event.id === selectedId}
                    onSelect={selectFromList}
                    onHover={setHoveredId}
                  />
                  </div>
                    ))
                  : null}
              </ItemGroup>
            )}
            </div>
          </main>
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={messages.resizePanel}
          aria-controls="race-list"
          aria-valuemin={MIN_PANEL_W}
          aria-valuemax={MAX_PANEL_W}
          aria-valuenow={Math.round(dragW ?? mapWidth)}
          aria-valuetext={`${Math.round(dragW ?? mapWidth)} px`}
          tabIndex={0}
          className="pointer-events-auto absolute inset-y-0 -right-2 z-10 w-4 cursor-col-resize touch-none outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragW(panelRef.current?.getBoundingClientRect().width ?? mapWidth);
          }}
          onPointerMove={(e) => {
            if (dragW == null) return;
            const left = document.getElementById("shell-stage")?.getBoundingClientRect().left ?? 0;
            setDragW(Math.min(panelMaxWidth(), Math.max(MIN_PANEL_W, e.clientX - left)));
          }}
          onPointerUp={() => {
            if (dragW == null) return;
            setMapWidth(Math.round(dragW));
            setDragW(null);
          }}
          onPointerCancel={() => setDragW(null)}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
            e.preventDefault();
            const next = e.key === "Home" ? MIN_PANEL_W
              : e.key === "End" ? panelMaxWidth()
              : mapWidth + (e.key === "ArrowRight" ? 24 : -24);
            setMapWidth(Math.min(panelMaxWidth(), Math.max(MIN_PANEL_W, next)));
          }}
        >
        </div>
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
            onClose={() => selectEvent(null)}
            onSelectSeries={applySeries}
                        leftX={mapWidth + 12}
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
              distanceEnabled
              onSort={setListSort}
            />

            <div
              id="race-list-mobile"
              ref={mobileListRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:hidden"
            >
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
                  {listView === "rows" &&
                    sortedEvents.map((event) => (
                      <div
                        role="listitem"
                        key={event.id}
                        className="border-b border-border/50 last:border-b-0"
                      >
                        <EventCard
                          event={event}
                          locale={locale}
                          distanceKm={eventDistanceKm(event, distanceOrigin)}
                          active={event.id === selectedId}
                          onSelect={selectFromSheet}
                          onHover={setHoveredId}
                        />
                      </div>
                    ))}
                </ItemGroup>
              )}
            </div>
          </MobileListSheet>

          <MobileDetailSheet
            open={Boolean(selected)}
            snap={detailSnap}
            onSnap={setDetailSnap}
            viewportH={viewportH}
            onClose={() => selectEvent(null)}
            title={selected?.name ?? ""}
            handleLabel={detailSnap === FULL ? messages.sheetCollapse : messages.sheetExpand}
          >
            {selected ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-1">
                <Suspense fallback={null}>
                <EventDetailPanel
                  event={selected}
                  locale={locale}
                  embedded
                  onClose={() => selectEvent(null)}
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
          onDiscipline={toggleDiscipline}
          onLevel={toggleLevel}
          onClearDisciplines={clearDisciplines}
          onClearLevels={clearLevels}
          onClearCategories={clearCategories}
          onSeries={setSeries}
          onCountry={toggleCountry}
        onClearCountries={clearCountries}
          onReset={() => resetExploreFilters()}
          extra={<div className="px-4 py-3"><DistanceFilter locale={locale} radius={radius} status={distanceOrigin ? "ready" : place.status} onRadius={setRadius} /></div>}
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
  const sortItemClass =
    "transition-[transform,background-color,color,box-shadow] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground data-[state=on]:[@media(hover:hover)_and_(pointer:fine)]:hover:text-background";

  const distanceItem = (
    <ToggleGroupItem
      value="distance"
      disabled={!distanceEnabled}
      className={cn(sortItemClass, !distanceEnabled && "disabled:pointer-events-auto")}
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
          <ToggleGroupItem value="date" className={sortItemClass}>
            {messages.date}
          </ToggleGroupItem>
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

/** The panel's title bar: the logo bar every race view shares. */
function Header({ locale }: { locale: string }) {
  return <BrandBar href={`/${locale}`} />;
}

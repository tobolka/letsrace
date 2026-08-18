"use client";

import { useMemo, useRef, useState, useEffect } from "react";
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
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import type { Messages } from "@/lib/i18n/messages";
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
import { viewportChangedEnough } from "@/lib/geo/viewport";
import { format, parseISO } from "date-fns";
import { MoreHorizontal, Flag } from "lucide-react";
import Link from "next/link";
import { thisWeekendRange } from "@/lib/date-presets";
import { SITE_AUTHOR } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = {
  initialEvents: EventListItem[];
  messages: Messages;
  locale: string;
};

function eventInBounds(event: EventListItem, b: MapBounds) {
  const lat = event.location?.lat;
  const lng = event.location?.lng;
  if (lat == null || lng == null) return false;
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;
}

export function ExploreShell({ initialEvents, messages, locale }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const initialBoundsFetchDone = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(true);
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

  const weekend = thisWeekendRange();
  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(""),
    categories: parseAsArrayOf(parseAsString).withDefault([]),
    disciplines: parseAsArrayOf(parseAsString).withDefault([]),
    levels: parseAsArrayOf(parseAsString).withDefault([]),
    series: parseAsString.withDefault(""),
    country: parseAsString.withDefault(""),
    dateFrom: parseAsString.withDefault(weekend.from),
    dateTo: parseAsString.withDefault(weekend.to),
    e: parseAsString.withDefault(""),
    sort: parseAsString.withDefault("date"),
    west: parseAsString,
    south: parseAsString,
    east: parseAsString,
    north: parseAsString,
  });

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

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    filters.categories.forEach((a) => params.append("categories", a));
    filters.disciplines.forEach((d) => params.append("disciplines", d));
    filters.levels.forEach((l) => params.append("levels", l));
    const qs = params.toString();
    void fetch(`/api/series${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((data: SeriesOption[]) => setSeriesList(data))
      .catch(() => undefined);
  }, [filters.dateFrom, filters.dateTo, filters.categories, filters.disciplines, filters.levels]);

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
    if (lastAreaRef.current && !viewportChangedEnough(lastAreaRef.current, b)) return;
    lastAreaRef.current = b;
    void setFilters({
      west: String(b.west),
      south: String(b.south),
      east: String(b.east),
      north: String(b.north),
    });
    setEvents((prev) => {
      const next = prev.filter((e) => eventInBounds(e, b));
      if (!filters.e) return next;
      const kept = prev.find((e) => e.slug === filters.e);
      if (kept && !next.some((e) => e.id === kept.id)) return [kept, ...next];
      return next;
    });
    refetch({ bounds: b, forceBounds: true });
  };

  function scheduleSearchViewport(b: MapBounds, immediate = false) {
    window.clearTimeout(areaTimerRef.current);
    if (immediate) {
      searchViewportRef.current(b);
      return;
    }
    areaTimerRef.current = window.setTimeout(() => {
      searchViewportRef.current(b);
    }, 320);
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(searchTimerRef.current);
      window.clearTimeout(areaTimerRef.current);
      placeAbortRef.current?.abort();
    };
  }, []);

  // Desktop: clear list (+ detail) panels. Mobile: clear bottom sheet.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const mapPadding = useMemo(() => {
    if (!isDesktop) {
      return { top: 16, right: 16, bottom: selected && mobileOpen ? 480 : 130, left: 16 };
    }
    const listW = 400 + 12 + 12;
    const detailW = selected ? 320 + 12 : 0;
    return {
      top: 16,
      right: 56,
      bottom: 56,
      left: listW + detailW + 64,
    };
  }, [selected, isDesktop, mobileOpen]);

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
            // First camera settle → load races for this viewport
            if (!initialBoundsFetchDone.current) {
              initialBoundsFetchDone.current = true;
              lastAreaRef.current = b;
              if (filters.q.trim().length >= 3) {
                void runSearch(filters.q);
                return;
              }
              if (filters.series || filters.country) {
                refetch({ skipBounds: true, fitMap: true });
              } else {
                refetch({ bounds: b, forceBounds: true });
              }
              return;
            }
            if (destFlyingRef.current) {
              destFlyingRef.current = false;
              lastAreaRef.current = b;
              return;
            }
            if (reason === "user") {
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

      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-20 hidden items-start p-3 md:flex md:gap-3">
        <Card className="pointer-events-auto flex h-full w-[400px] flex-col gap-0 overflow-hidden py-0 shadow-lg">
          <Header
            messages={messages}
            locale={locale}
            onSubmitRace={() => setSubmitOpen(true)}
            onFeedback={() => setFeedbackOpen(true)}
            onSignIn={() => setAuthOpen(true)}
          />
          <div className="relative z-30 shrink-0 px-3 py-2.5">
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
          <p className="shrink-0 border-t px-4 py-2 text-[11px] text-muted-foreground">
            {messages.madeBy}{" "}
            <a
              href={SITE_AUTHOR.url}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {SITE_AUTHOR.name}
            </a>
            <span aria-hidden> · </span>
            <a
              href={`mailto:${SITE_AUTHOR.email}`}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {SITE_AUTHOR.email}
            </a>
          </p>
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

      <div className="absolute inset-x-0 bottom-0 z-20 md:hidden">
        <Card
          className={cn(
            "flex flex-col gap-0 overflow-hidden rounded-b-none py-0 shadow-lg transition-[max-height] duration-200 ease-out motion-reduce:transition-none",
            mobileOpen ? "max-h-[min(85dvh,40rem)]" : "max-h-14",
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            type="button"
            className="flex min-h-11 w-full shrink-0 items-center justify-center touch-manipulation"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Collapse" : "Expand"}
          >
            <span className="h-1 w-10 rounded-full bg-muted-foreground/40" />
          </button>
          {selected && mobileOpen ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
              <EventDetailPanel
                event={selected}
                locale={locale}
                embedded
                onClose={() => selectEvent(null)}
                onSelectSeries={applySeries}
              />
            </div>
          ) : (
            <>
              <div className="px-3 pb-2">
                <Header
                  messages={messages}
                  locale={locale}
                  onSubmitRace={() => setSubmitOpen(true)}
                  onFeedback={() => setFeedbackOpen(true)}
                  onSignIn={() => setAuthOpen(true)}
                  compact
                />
              </div>
              {mobileOpen && (
                <>
                  <div className="relative z-30 shrink-0 px-3 py-2">
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
                  <div ref={mobileListRef} className="max-h-[60vh] overflow-y-auto">
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
                  </div>
                </>
              )}
            </>
          )}
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
        {pending ? <Spinner /> : null}
        {count} {messages.racesCount}
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
    <CardHeader className={cn(compact ? "gap-0 px-0 py-0" : "border-b px-4 py-3")}>
      <CardTitle className="text-sm font-semibold tracking-[0.14em] uppercase">
        <Link href={`/${locale}`}>{messages.appName}</Link>
      </CardTitle>
      <CardAction>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={messages.more}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{messages.language}</DropdownMenuLabel>
              {(["en", "cs", "pl", "sk"] as const).map((l) => (
                <DropdownMenuItem key={l} asChild>
                  <Link href={`/${l}`}>{l.toUpperCase()}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={onSignIn}>Sign in</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/account`}>Account</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/calendar`}>My calendar</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSubmitRace}>
                <Flag />
                {messages.missingRace}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onFeedback}>Feature / feedback…</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{messages.madeBy}</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <a href={SITE_AUTHOR.url} target="_blank" rel="noreferrer">
                  {SITE_AUTHOR.name}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`mailto:${SITE_AUTHOR.email}`}>{SITE_AUTHOR.email}</a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">{messages.admin}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardAction>
    </CardHeader>
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
        className="w-full scroll-my-2 text-left touch-manipulation"
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

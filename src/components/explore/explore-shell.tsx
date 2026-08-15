"use client";

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import { useQueryStates, parseAsString, parseAsArrayOf } from "nuqs";
import { RaceMapLazy as RaceMap, type MapBounds } from "@/components/map/race-map-lazy";
import { EventDetailPanel } from "@/components/explore/event-detail-panel";
import { SubmitRaceModal } from "@/components/explore/submit-race-modal";
import { FeedbackModal } from "@/components/explore/feedback-modal";
import { AuthDialog } from "@/components/account/auth-dialog";
import { Button, Input } from "@/components/ui/primitives";
import type { EventListItem } from "@/lib/events";
import type { Messages } from "@/lib/i18n/messages";
import {
  AGE_CATEGORY_FILTERS,
  AGE_CATEGORY_LABELS,
  DISCIPLINE_LABELS,
  DISCIPLINE_TREE,
  RACE_LEVEL_LABELS,
  RACE_LEVELS,
  formatEventCategoryLabel,
  type Discipline,
  type RaceLevel,
} from "@/lib/taxonomy";
import { disciplineColor, familyColor } from "@/lib/map-visuals";
import { countryDisplayName, sortCountryCodes } from "@/lib/geo/europe";
import {
  addDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import {
  Search,
  MoreHorizontal,
  Flag,
  Calendar,
  SlidersHorizontal,
  ChevronDown,
  Globe,
} from "lucide-react";
import { DateRangeCalendar, isoToRange } from "@/components/explore/date-range-calendar";
import type { DateRange } from "react-day-picker";
import Link from "next/link";
import {
  nextWeekendRange,
  thisWeekendRange,
  todayIso,
} from "@/lib/date-presets";

type Props = {
  initialEvents: EventListItem[];
  messages: Messages;
  locale: string;
};

type SeriesOption = {
  slug: string;
  name: string;
  eventCount: number;
  countryCode: string | null;
  shortName?: string | null;
};

const INT_COUNTRY = "INT";

function seriesCountryKey(code: string | null | undefined) {
  const cc = (code || "").trim().toUpperCase();
  return cc.length === 2 ? cc : INT_COUNTRY;
}

function groupSeriesByCountry(
  list: SeriesOption[],
  locale: string,
  internationalLabel: string,
): { key: string; label: string; items: SeriesOption[] }[] {
  const groups = new Map<string, SeriesOption[]>();
  for (const s of list) {
    const key = seriesCountryKey(s.countryCode);
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }
  const keys = [
    ...sortCountryCodes(
      [...groups.keys()].filter((k) => k !== INT_COUNTRY),
      locale,
    ),
    ...(groups.has(INT_COUNTRY) ? [INT_COUNTRY] : []),
  ];
  return keys.map((key) => ({
    key,
    label: key === INT_COUNTRY ? internationalLabel : countryDisplayName(key, locale),
    items: (groups.get(key) ?? []).sort(
      (a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name),
    ),
  }));
}

function eventInBounds(event: EventListItem, b: MapBounds) {
  const lat = event.location?.lat;
  const lng = event.location?.lng;
  if (lat == null || lng == null) return false;
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;
}

function thisMonthRange() {
  const now = new Date();
  return {
    from: format(startOfMonth(now), "yyyy-MM-dd"),
    to: format(endOfMonth(now), "yyyy-MM-dd"),
  };
}

function nextMonthRange() {
  const next = addDays(endOfMonth(new Date()), 1);
  return {
    from: format(startOfMonth(next), "yyyy-MM-dd"),
    to: format(endOfMonth(next), "yyyy-MM-dd"),
  };
}

export function ExploreShell({ initialEvents, messages, locale }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const initialBoundsFetchDone = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(true);
  const [moved, setMoved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [pending, startTransition] = useTransition();
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mobileListRef = useRef<HTMLDivElement>(null);
  const [fitSeq, setFitSeq] = useState(0);

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
    startTransition(async () => {
      const params = new URLSearchParams();
      const q = (overrides.q as string) ?? filters.q;
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
      const res = await fetch(`/api/events?${params.toString()}`);
      const data = (await res.json()) as EventListItem[];
      setEvents(data);
      if (overrides.fitMap) setFitSeq((n) => n + 1);
    });
  }

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
    const detailW = selected ? 340 + 12 : 0;
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
        stacked
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
          onSelect={(id) => {
            selectEvent(id);
            setMobileOpen(true);
          }}
          onBoundsChange={(b) => {
            setBounds(b);
            // First camera settle → load races for this viewport
            if (!initialBoundsFetchDone.current) {
              initialBoundsFetchDone.current = true;
              if (filters.series || filters.country) {
                refetch({ skipBounds: true, fitMap: true });
              } else {
                refetch({ bounds: b, forceBounds: true });
              }
              return;
            }
            if (!filters.series && !filters.country) {
              setMoved(true);
            }
          }}
          searchThisAreaLabel={messages.searchThisArea}
          myLocationLabel={messages.myLocation}
          locationDeniedLabel={messages.locationDenied}
          showSearchArea={moved}
          onSearchArea={(b) => {
            setBounds(b);
            void setFilters({
              west: String(b.west),
              south: String(b.south),
              east: String(b.east),
              north: String(b.north),
            });
            setEvents((prev) => prev.filter((e) => eventInBounds(e, b)));
            refetch({ bounds: b, forceBounds: true });
            setMoved(false);
          }}
        />
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-20 hidden items-start p-3 md:flex md:gap-3">
        <aside className="pointer-events-auto flex h-full w-[400px] flex-col rounded-2xl bg-white/95 shadow-xl ring-1 ring-stone-200 backdrop-blur">
          <Header
            messages={messages}
            locale={locale}
            q={filters.q}
            menuOpen={menuOpen}
            onMenuOpen={setMenuOpen}
            onSubmitRace={() => setSubmitOpen(true)}
            onFeedback={() => setFeedbackOpen(true)}
            onSignIn={() => setAuthOpen(true)}
            onQ={(q) => {
              void setFilters({ q });
              refetch({ q });
            }}
          />
          <div className="relative z-30 shrink-0 border-b border-stone-100 px-3 py-2.5">
            {renderFilterBar()}
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-2 text-xs text-stone-500">
            <span>
              {events.length} {messages.racesCount}
            </span>
            {pending ? <span>…</span> : null}
          </div>
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
            {events.length === 0 ? (
              <div className="space-y-3 p-4">
                <p className="text-sm text-stone-500">{messages.noResults}</p>
                <p className="text-xs text-stone-400">{messages.weekendNearYou}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const w = thisWeekendRange();
                      void setFilters({
                        q: null,
                        categories: [],
                        disciplines: [],
                        levels: [],
                        series: null,
                        country: null,
                        dateFrom: w.from,
                        dateTo: w.to,
                        e: null,
                      });
                      refetch({
                        q: "",
                        categories: [],
                        disciplines: [],
                        levels: [],
                        series: "",
                        country: "",
                        dateFrom: w.from,
                        dateTo: w.to,
                        skipBounds: true,
                        fitMap: true,
                      });
                    }}
                  >
                    {messages.clearFilters}
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSubmitOpen(true)}>
                    Report race
                  </Button>
                </div>
              </div>
            ) : (
              events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  messages={messages}
                  active={event.id === selectedId}
                  onClick={() => selectEvent(event.id)}
                />
              ))
            )}
          </div>
        </aside>

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
        <div
          className={`flex flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-stone-200 transition-[max-height] duration-200 ease-out motion-reduce:transition-none ${
            mobileOpen ? "max-h-[min(85dvh,40rem)]" : "max-h-14"
          }`}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            type="button"
            className="flex min-h-11 w-full shrink-0 items-center justify-center touch-manipulation"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Collapse" : "Expand"}
          >
            <span className="h-1 w-10 rounded-full bg-stone-300" />
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
                  q={filters.q}
                  menuOpen={menuOpen}
                  onMenuOpen={setMenuOpen}
                  onSubmitRace={() => setSubmitOpen(true)}
                  onFeedback={() => setFeedbackOpen(true)}
                  onSignIn={() => setAuthOpen(true)}
                  onQ={(q) => {
                    void setFilters({ q });
                    refetch({ q });
                  }}
                  compact
                />
              </div>
              {mobileOpen && (
                <div ref={mobileListRef} className="max-h-[60vh] overflow-y-auto">
                  <div className="relative z-30 border-b border-stone-100 px-3 py-2">
                    {renderFilterBar()}
                  </div>
                  <div className="flex gap-2 px-4 pb-2 pt-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-stone-200"
                      onClick={() => setSubmitOpen(true)}
                    >
                      <Flag className="h-3 w-3" />
                      Report race
                    </button>
                  </div>
                  {events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      messages={messages}
                      active={event.id === selectedId}
                      onClick={() => selectEvent(event.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <SubmitRaceModal open={submitOpen} onClose={() => setSubmitOpen(false)} />
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

function mapChip(active: boolean) {
  return `inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-medium shadow-md ring-1 transition-[background-color,color,box-shadow] duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${
    active
      ? "text-stone-900 ring-stone-900"
      : "text-stone-800 ring-stone-200/90 hover:bg-stone-50"
  }`;
}

function disciplineLabel(id: string): string {
  return DISCIPLINE_LABELS[id as Discipline] || id;
}

function MapFilterBar({
  messages,
  locale,
  dateFrom,
  dateTo,
  categories,
  disciplines,
  levels,
  series,
  country,
  seriesList,
  onPreset,
  onCategory,
  onDiscipline,
  onLevel,
  onClearDisciplines,
  onClearLevels,
  onClearCategories,
  onSeries,
  onCountry,
  stacked,
}: {
  messages: Messages;
  locale: string;
  dateFrom: string;
  dateTo: string;
  categories: string[];
  disciplines: string[];
  levels: string[];
  series: string;
  country: string;
  seriesList: SeriesOption[];
  onPreset: (from: string, to: string) => void;
  onCategory: (v: string) => void;
  onDiscipline: (v: string) => void;
  onLevel: (v: string) => void;
  onClearDisciplines: () => void;
  onClearLevels: () => void;
  onClearCategories: () => void;
  onSeries: (slug: string) => void;
  onCountry: (code: string) => void;
  stacked?: boolean;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const [customPicked, setCustomPicked] = useState(false);
  const [dateDraft, setDateDraft] = useState<DateRange | undefined>();
  const [typeOpen, setTypeOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [seriesQuery, setSeriesQuery] = useState("");
  const dateRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (dateRef.current && !dateRef.current.contains(t)) setDateOpen(false);
      if (typeRef.current && !typeRef.current.contains(t)) setTypeOpen(false);
      if (categoryRef.current && !categoryRef.current.contains(t)) setCategoryOpen(false);
      if (levelRef.current && !levelRef.current.contains(t)) setLevelOpen(false);
      if (countryRef.current && !countryRef.current.contains(t)) setCountryOpen(false);
      if (moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function closeOthers(except: "date" | "type" | "category" | "level" | "country" | "series") {
    if (except !== "date") setDateOpen(false);
    if (except !== "type") setTypeOpen(false);
    if (except !== "category") setCategoryOpen(false);
    if (except !== "level") setLevelOpen(false);
    if (except !== "country") setCountryOpen(false);
    if (except !== "series") setMoreOpen(false);
  }

  const thisW = thisWeekendRange();
  const nextW = nextWeekendRange();
  const thisM = thisMonthRange();
  const nextM = nextMonthRange();
  const isThisWeekend = dateFrom === thisW.from && dateTo === thisW.to;
  const isNextWeekend = dateFrom === nextW.from && dateTo === nextW.to;
  const isThisMonth = dateFrom === thisM.from && dateTo === thisM.to;
  const isNextMonth = dateFrom === nextM.from && dateTo === nextM.to;
  const today = todayIso();
  const isUpcoming = dateFrom === today && !dateTo;
  const anyDate = !dateFrom && !dateTo;
  const dateActive = Boolean(dateFrom || dateTo);
  const isPreset =
    isThisWeekend || isNextWeekend || isThisMonth || isNextMonth || anyDate || isUpcoming;
  const isCustom = customPicked || (dateActive && !isPreset);

  useEffect(() => {
    if (!dateOpen) return;
    setCustomPicked(dateActive && !isPreset);
    setDateDraft(undefined);
  }, [dateOpen]);

  const draftFrom = dateDraft?.from ? format(dateDraft.from, "d MMM") : null;
  const draftTo = dateDraft?.to ? format(dateDraft.to, "d MMM") : null;
  const dateLabel = isCustom
    ? draftFrom && draftTo
      ? `${draftFrom} – ${draftTo}`
      : draftFrom
        ? `${draftFrom} – …`
        : dateFrom && dateTo
          ? `${format(parseISO(dateFrom), "d MMM")} – ${format(parseISO(dateTo), "d MMM")}`
          : dateFrom
            ? `${messages.from} ${format(parseISO(dateFrom), "d MMM")}`
            : messages.customDate
    : isThisWeekend
      ? messages.thisWeekend
      : isNextWeekend
        ? messages.nextWeekend
        : isThisMonth
          ? messages.thisMonth
          : isNextMonth
            ? messages.nextMonth
            : isUpcoming
              ? messages.upcoming
              : anyDate
                ? messages.anyDate
                : messages.date;

  const seriesName = seriesList.find((s) => s.slug === series)?.name;
  const countryLabel = country ? countryDisplayName(country, locale) : messages.allCountries;
  const countryCodes = sortCountryCodes(
    seriesList.map((s) => seriesCountryKey(s.countryCode)).filter((k) => k !== INT_COUNTRY),
    locale,
  );
  const visibleSeries = country
    ? seriesList.filter((s) => seriesCountryKey(s.countryCode) === country)
    : seriesList;
  const seriesGroups = groupSeriesByCountry(visibleSeries, locale, messages.international);
  const seriesQ = seriesQuery.trim().toLowerCase();
  const filteredSeriesGroups = seriesQ
    ? seriesGroups
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (s) =>
              s.name.toLowerCase().includes(seriesQ) ||
              s.slug.includes(seriesQ) ||
              (s.shortName?.toLowerCase().includes(seriesQ) ?? false),
          ),
        }))
        .filter((g) => g.items.length > 0)
    : seriesGroups;
  const showSeriesHeaders = !country && seriesGroups.length > 1;
  const selectedDisc = disciplines[0];
  const typeLabel = selectedDisc ? disciplineLabel(selectedDisc) : messages.typeFilter;
  const categoryLabel =
    categories.length === 0
      ? messages.categoryFilter
      : categories.length === 1
        ? AGE_CATEGORY_LABELS[categories[0] as keyof typeof AGE_CATEGORY_LABELS] || categories[0]
        : `${messages.categoryFilter} · ${categories.length}`;
  const levelLabel =
    levels.length === 0
      ? messages.levelFilter
      : levels.length === 1
        ? RACE_LEVEL_LABELS[levels[0] as RaceLevel] || levels[0]
        : `${messages.levelFilter} · ${levels.length}`;

  function applyPreset(from: string, to: string) {
    setCustomPicked(false);
    setDateDraft(undefined);
    onPreset(from, to);
  }

  const datePresets: { id: string; label: string; active: boolean; apply: () => void }[] = [
    {
      id: "upcoming",
      label: messages.upcoming,
      active: !isCustom && isUpcoming,
      apply: () => applyPreset(today, ""),
    },
    {
      id: "thisWeekend",
      label: messages.thisWeekend,
      active: !isCustom && isThisWeekend,
      apply: () => applyPreset(thisW.from, thisW.to),
    },
    {
      id: "nextWeekend",
      label: messages.nextWeekend,
      active: !isCustom && isNextWeekend,
      apply: () => applyPreset(nextW.from, nextW.to),
    },
    {
      id: "thisMonth",
      label: messages.thisMonth,
      active: !isCustom && isThisMonth,
      apply: () => applyPreset(thisM.from, thisM.to),
    },
    {
      id: "nextMonth",
      label: messages.nextMonth,
      active: !isCustom && isNextMonth,
      apply: () => applyPreset(nextM.from, nextM.to),
    },
    {
      id: "any",
      label: messages.anyDate,
      active: !isCustom && anyDate,
      apply: () => applyPreset("", ""),
    },
  ];

  return (
    <div
      className={`pointer-events-auto ${
        stacked
          ? "flex flex-wrap gap-1.5"
          : "flex items-start gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      }`}
    >
      <div className="relative" ref={dateRef}>
        <button
          type="button"
          className={mapChip(dateActive && !anyDate)}
          aria-expanded={dateOpen}
          aria-haspopup="dialog"
          onClick={() => {
            closeOthers("date");
            setDateOpen((v) => !v);
          }}
        >
          <Calendar className="h-4 w-4 text-stone-500" />
          {dateLabel}
          <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
        </button>
        {dateOpen && (
          <div
            className="z-40 mt-2 flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-stone-200 overscroll-contain md:absolute md:left-0 md:top-[calc(100%+8px)] md:mt-0 md:w-[min(calc(100vw-24px),36rem)] md:flex-row"
            role="dialog"
            aria-label={messages.date}
          >
            <div className="flex w-full shrink-0 flex-col p-2 md:w-44">
              <p className="px-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                {messages.date}
              </p>
              {datePresets.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={opt.active}
                  className={`flex min-h-9 w-full items-center rounded-xl px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
                    opt.active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
                  }`}
                  onClick={opt.apply}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={isCustom}
                className={`mt-0.5 flex min-h-9 w-full items-center rounded-xl px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
                  isCustom ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
                }`}
                onClick={() => setCustomPicked(true)}
              >
                {messages.customDate}
              </button>
            </div>
            <div className="hidden w-px bg-stone-100 md:block" />
            <div className="h-px bg-stone-100 md:hidden" />
            <DateRangeCalendar
              locale={locale}
              selected={dateDraft ?? isoToRange(dateFrom, dateTo)}
              onSelect={(range) => {
                if (!range?.from) return;
                setCustomPicked(true);
                setDateDraft(range);
                if (range.to) {
                  const start = range.from <= range.to ? range.from : range.to;
                  const end = range.from <= range.to ? range.to : range.from;
                  onPreset(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
                }
              }}
            />
          </div>
        )}
      </div>

      <div className="relative" ref={typeRef}>
        <button
          type="button"
          className={mapChip(Boolean(selectedDisc))}
          onClick={() => {
            closeOthers("type");
            setTypeOpen((v) => !v);
          }}
        >
          {typeLabel}
          <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
        </button>
        {typeOpen && (
          <div className="absolute left-0 top-[calc(100%+8px)] z-40 max-h-80 w-60 overflow-y-auto rounded-2xl bg-white p-2 shadow-xl ring-1 ring-stone-200">
            <p className="px-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              {messages.typeFilter}
            </p>
            {DISCIPLINE_TREE.map((opt) => {
              const on = selectedDisc === opt.id;
              return (
                <div key={opt.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                      on ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
                    }`}
                    onClick={() => {
                      onDiscipline(opt.id);
                      if (!opt.children?.length) setTypeOpen(false);
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: familyColor(opt.id) }}
                      aria-hidden
                    />
                    {opt.label}
                  </button>
                  {opt.children?.map((child) => {
                    const childOn = selectedDisc === child.id;
                    return (
                      <button
                        key={child.id}
                        type="button"
                        className={`flex w-full items-center gap-2 rounded-xl py-1.5 pl-6 pr-3 text-left text-sm ${
                          childOn
                            ? "bg-stone-900 text-white"
                            : "text-stone-600 hover:bg-stone-50"
                        }`}
                        onClick={() => {
                          onDiscipline(child.id);
                          setTypeOpen(false);
                        }}
                      >
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ background: familyColor(child.id) }}
                          aria-hidden
                        />
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {selectedDisc ? (
              <button
                type="button"
                className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-50"
                onClick={() => {
                  onClearDisciplines();
                  setTypeOpen(false);
                }}
              >
                {messages.clearFilter}
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="relative" ref={categoryRef}>
        <button
          type="button"
          className={mapChip(categories.length > 0)}
          onClick={() => {
            closeOthers("category");
            setCategoryOpen((v) => !v);
          }}
        >
          {categoryLabel}
          <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
        </button>
        {categoryOpen && (
          <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-52 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-stone-200">
            <p className="px-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              {messages.categoryFilter}
            </p>
            {AGE_CATEGORY_FILTERS.map((opt) => {
              const on = categories.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm ${
                    on ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
                  }`}
                  onClick={() => onCategory(opt.id)}
                >
                  {opt.label}
                </button>
              );
            })}
            {categories.length > 0 ? (
              <button
                type="button"
                className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-50"
                onClick={() => {
                  onClearCategories();
                  setCategoryOpen(false);
                }}
              >
                {messages.clearFilter}
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="relative" ref={levelRef}>
        <button
          type="button"
          className={mapChip(levels.length > 0)}
          onClick={() => {
            closeOthers("level");
            setLevelOpen((v) => !v);
          }}
        >
          {levelLabel}
          <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
        </button>
        {levelOpen && (
          <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-60 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-stone-200">
            <p className="px-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              {messages.levelFilter}
            </p>
            {RACE_LEVELS.map((id) => {
              const on = levels.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm ${
                    on ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
                  }`}
                  onClick={() => onLevel(id)}
                >
                  {RACE_LEVEL_LABELS[id]}
                </button>
              );
            })}
            {levels.length > 0 ? (
              <button
                type="button"
                className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-50"
                onClick={() => {
                  onClearLevels();
                  setLevelOpen(false);
                }}
              >
                {messages.clearFilter}
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="relative" ref={countryRef}>
        <button
          type="button"
          className={mapChip(Boolean(country))}
          onClick={() => {
            closeOthers("country");
            setCountryOpen((v) => !v);
          }}
        >
          <Globe className="h-4 w-4 text-stone-500" />
          {country ? countryLabel : messages.countryFilter}
          <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
        </button>
        {countryOpen && (
          <div className="absolute left-0 top-[calc(100%+8px)] z-40 max-h-80 w-64 overflow-y-auto rounded-2xl bg-white p-2 shadow-xl ring-1 ring-stone-200">
            <p className="px-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              {messages.countryFilter}
            </p>
            <button
              type="button"
              className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm ${
                !country ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
              }`}
              onClick={() => {
                if (country) onCountry(country);
                setCountryOpen(false);
              }}
            >
              {messages.allCountries}
            </button>
            {countryCodes.map((code) => {
              const on = country === code;
              return (
                <button
                  key={code}
                  type="button"
                  className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm ${
                    on ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
                  }`}
                  onClick={() => {
                    onCountry(code);
                    setCountryOpen(false);
                  }}
                >
                  {countryDisplayName(code, locale)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {visibleSeries.length > 0 && (
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            className={mapChip(Boolean(series))}
            onClick={() => {
              closeOthers("series");
              setMoreOpen((v) => !v);
              setSeriesQuery("");
            }}
          >
            <SlidersHorizontal className="h-4 w-4 text-stone-500" />
            {seriesName || messages.seriesFilter}
            <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
          </button>
          {moreOpen && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-40 max-h-80 w-72 overflow-y-auto rounded-2xl bg-white p-2 shadow-xl ring-1 ring-stone-200">
              <div className="sticky top-0 z-10 bg-white pb-1">
                <Input
                  type="search"
                  value={seriesQuery}
                  onChange={(e) => setSeriesQuery(e.target.value)}
                  placeholder={messages.searchSeries}
                  className="h-9"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              {filteredSeriesGroups.length === 0 ? (
                <p className="px-3 py-2 text-sm text-stone-500">{messages.noSeries}</p>
              ) : null}
              {filteredSeriesGroups.map((group) => (
                <div key={group.key}>
                  {showSeriesHeaders ? (
                    <p className="px-3 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                      {group.label}
                    </p>
                  ) : null}
                  {group.items.map((s) => (
                    <button
                      key={s.slug}
                      type="button"
                      className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
                        series === s.slug
                          ? "bg-stone-900 text-white"
                          : "text-stone-700 hover:bg-stone-50"
                      }`}
                      onClick={() => {
                        onSeries(s.slug);
                        setMoreOpen(false);
                      }}
                    >
                      {s.name}
                      <span className="ml-1 text-xs opacity-60">({s.eventCount})</span>
                    </button>
                  ))}
                </div>
              ))}
              {series ? (
                <button
                  type="button"
                  className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-50"
                  onClick={() => {
                    onSeries(series);
                    setMoreOpen(false);
                  }}
                >
                  {messages.clearFilter}
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Header({
  messages,
  locale,
  q,
  onQ,
  menuOpen,
  onMenuOpen,
  onSubmitRace,
  onFeedback,
  onSignIn,
  compact,
}: {
  messages: Messages;
  locale: string;
  q: string;
  onQ: (q: string) => void;
  menuOpen: boolean;
  onMenuOpen: (v: boolean) => void;
  onSubmitRace: () => void;
  onFeedback: () => void;
  onSignIn: () => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "border-b border-stone-200 p-4"}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <Link
            href={`/${locale}`}
            className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-stone-900"
          >
            {messages.appName}
          </Link>
          {!compact && (
            <p className="mt-0.5 text-xs text-stone-500">{messages.tagline}</p>
          )}
        </div>
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={messages.more}
            onClick={() => onMenuOpen(!menuOpen)}
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-40 w-48 rounded-xl bg-white py-1 shadow-lg ring-1 ring-stone-200">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                {messages.language}
              </p>
              {(["en", "cs", "pl", "sk"] as const).map((l) => (
                <Link
                  key={l}
                  href={`/${l}`}
                  className={`block min-h-11 px-3 py-2.5 text-sm leading-none md:min-h-0 md:py-2 ${
                    l === locale ? "bg-stone-100 font-medium text-stone-900" : "text-stone-600 hover:bg-stone-50"
                  }`}
                  onClick={() => onMenuOpen(false)}
                >
                  {l.toUpperCase()}
                </Link>
              ))}
              <div className="my-1 border-t border-stone-100" />
              <button
                type="button"
                className="block min-h-11 w-full px-3 py-2.5 text-left text-sm text-stone-600 hover:bg-stone-50 md:min-h-0 md:py-2"
                onClick={() => {
                  onMenuOpen(false);
                  onSignIn();
                }}
              >
                Sign in
              </button>
              <Link
                href={`/${locale}/account`}
                className="block px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
                onClick={() => onMenuOpen(false)}
              >
                Account
              </Link>
              <Link
                href={`/${locale}/calendar`}
                className="block px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
                onClick={() => onMenuOpen(false)}
              >
                My calendar
              </Link>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-stone-600 hover:bg-stone-50"
                onClick={() => {
                  onMenuOpen(false);
                  onSubmitRace();
                }}
              >
                Report a race
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-stone-600 hover:bg-stone-50"
                onClick={() => {
                  onMenuOpen(false);
                  onFeedback();
                }}
              >
                Feature / feedback…
              </button>
              <div className="my-1 border-t border-stone-100" />
              <Link
                href="/admin"
                className="block px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
                onClick={() => onMenuOpen(false)}
              >
                {messages.admin}
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder={messages.searchPlaceholder}
          className="pl-9"
        />
      </div>
    </div>
  );
}

function EventCard({
  event,
  messages,
  active,
  onClick,
}: {
  event: EventListItem;
  messages: Messages;
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
  return (
    <button
      type="button"
      data-event-id={event.id}
      onClick={onClick}
      className={`w-full scroll-my-2 border-b border-stone-100 px-4 py-3.5 text-left transition-[background-color] duration-150 ease-out hover:bg-stone-50 active:bg-stone-100/80 touch-manipulation motion-reduce:transition-none sm:py-3 ${
        active ? "bg-stone-100" : ""
      }`}
    >
      <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-stone-500">
        <span
          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
          style={{ background: disciplineColor(event.disciplines) }}
          aria-hidden
        />
        {format(parseISO(event.startDate), "d MMM yyyy")}
        {event.endDate && event.endDate !== event.startDate
          ? `–${format(parseISO(event.endDate), "d MMM")}`
          : ""}
        {level ? ` · ${level}` : ""}
        {event.series ? ` · ${event.series.name}` : ""}
      </p>
      <p className="mt-0.5 text-[15px] font-medium tracking-tight text-stone-900">{event.name}</p>
      <p className="mt-0.5 text-xs text-stone-500">
        {event.location?.municipality || event.location?.name || "—"}
        {event.location?.countryCode ? ` · ${event.location.countryCode}` : ""}
        {discLabel ? ` · ${discLabel}` : ""}
        {audienceLabel ? ` · ${audienceLabel}` : ""}
      </p>
    </button>
  );
}

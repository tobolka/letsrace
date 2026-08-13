"use client";

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import { useQueryStates, parseAsString, parseAsArrayOf, parseAsBoolean } from "nuqs";
import { RaceMap } from "@/components/map/race-map";
import { EventDetailPanel } from "@/components/explore/event-detail-panel";
import { SubmitRaceModal } from "@/components/explore/submit-race-modal";
import { FeedbackModal } from "@/components/explore/feedback-modal";
import { AuthDialog } from "@/components/account/auth-dialog";
import { Button, Input } from "@/components/ui/primitives";
import type { EventListItem } from "@/lib/events";
import type { Messages } from "@/lib/i18n/messages";
import { formatAudienceList } from "@/lib/audience";
import {
  AGE_CATEGORIES,
  AGE_CATEGORY_LABELS,
  DISCIPLINE_LABELS,
  DISCIPLINE_TREE,
  RACE_LEVEL_LABELS,
  RACE_LEVELS,
  type Discipline,
  type RaceLevel,
} from "@/lib/taxonomy";
import { levelColor } from "@/lib/map-visuals";
import {
  addDays,
  endOfMonth,
  format,
  nextSaturday,
  nextSunday,
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
} from "lucide-react";
import Link from "next/link";

type Props = {
  initialEvents: EventListItem[];
  messages: Messages;
  locale: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Sat–Sun of the current calendar weekend (including today if already weekend). */
function thisWeekendRange() {
  const now = new Date();
  const day = now.getDay();
  if (day === 6) {
    return { from: format(now, "yyyy-MM-dd"), to: format(addDays(now, 1), "yyyy-MM-dd") };
  }
  if (day === 0) {
    return { from: format(addDays(now, -1), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
  }
  const sat = nextSaturday(now);
  const sun = nextSunday(sat);
  return { from: format(sat, "yyyy-MM-dd"), to: format(sun, "yyyy-MM-dd") };
}

/** The weekend after thisWeekendRange(). */
function nextWeekendRange() {
  const thisW = thisWeekendRange();
  return {
    from: format(addDays(parseISO(thisW.from), 7), "yyyy-MM-dd"),
    to: format(addDays(parseISO(thisW.to), 7), "yyyy-MM-dd"),
  };
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
  const [seriesList, setSeriesList] = useState<{ slug: string; name: string; eventCount: number }[]>([]);
  const [pending, startTransition] = useTransition();
  const [bounds, setBounds] = useState<{
    west: number;
    south: number;
    east: number;
    north: number;
  } | null>(null);

  const [filters, setFilters] = useQueryStates({
    q: parseAsString.withDefault(""),
    categories: parseAsArrayOf(parseAsString).withDefault([]),
    disciplines: parseAsArrayOf(parseAsString).withDefault([]),
    levels: parseAsArrayOf(parseAsString).withDefault([]),
    series: parseAsString.withDefault(""),
    dateFrom: parseAsString.withDefault(todayIso()),
    dateTo: parseAsString.withDefault(""),
    updateOnMove: parseAsBoolean.withDefault(false),
    west: parseAsString,
    south: parseAsString,
    east: parseAsString,
    north: parseAsString,
  });

  useEffect(() => {
    void fetch("/api/series")
      .then((r) => r.json())
      .then((data: { slug: string; name: string; eventCount: number }[]) => setSeriesList(data))
      .catch(() => undefined);
  }, []);

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId],
  );

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
    refetch({ series: next });
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
      const dateFrom = (overrides.dateFrom as string) ?? filters.dateFrom;
      const dateTo = (overrides.dateTo as string) ?? filters.dateTo;
      const b = (overrides.bounds as typeof bounds) ?? bounds;
      if (q) params.set("q", q);
      if (series) params.set("series", series);
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
      return { top: 16, right: 16, bottom: selected && mobileOpen ? 420 : 120, left: 16 };
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
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        categories={filters.categories}
        disciplines={filters.disciplines}
        levels={filters.levels}
        series={filters.series}
        seriesList={seriesList}
        onPreset={setDateRange}
        onFrom={(dateFrom) => setDateRange(dateFrom, filters.dateTo)}
        onTo={(dateTo) => setDateRange(filters.dateFrom, dateTo)}
        onCategory={toggleCategory}
        onDiscipline={setDiscipline}
        onLevel={toggleLevel}
        onClearDisciplines={clearDisciplines}
        onClearLevels={clearLevels}
        onClearCategories={clearCategories}
        onSeries={setSeries}
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
          onSelect={(id) => {
            setSelectedId(id);
            setMobileOpen(true);
          }}
          onBoundsChange={(b) => {
            setBounds(b);
            // First camera settle → load races for this viewport
            if (!initialBoundsFetchDone.current) {
              initialBoundsFetchDone.current = true;
              refetch({ bounds: b, forceBounds: true });
              return;
            }
            if (filters.updateOnMove) {
              refetch({ bounds: b, forceBounds: true });
            } else {
              setMoved(true);
            }
          }}
          searchThisAreaLabel={messages.searchThisArea}
          myLocationLabel={messages.myLocation}
          locationDeniedLabel={messages.locationDenied}
          showSearchArea={moved && !filters.updateOnMove}
          onSearchArea={() => {
            if (!bounds) return;
            void setFilters({
              west: String(bounds.west),
              south: String(bounds.south),
              east: String(bounds.east),
              north: String(bounds.north),
            });
            refetch({ bounds, forceBounds: true });
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
          <div className="min-h-0 flex-1 overflow-y-auto">
            {events.length === 0 ? (
              <p className="p-4 text-sm text-stone-500">{messages.noResults}</p>
            ) : (
              events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  messages={messages}
                  active={event.id === selectedId}
                  onClick={() => setSelectedId(event.id)}
                />
              ))
            )}
          </div>
          <label className="flex items-center gap-2 border-t border-stone-200 px-4 py-3 text-xs text-stone-600">
            <input
              type="checkbox"
              checked={filters.updateOnMove}
              onChange={(e) => void setFilters({ updateOnMove: e.target.checked })}
            />
            {messages.updateOnMove}
          </label>
        </aside>

        {selected && (
          <EventDetailPanel
            event={selected}
            locale={locale}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 md:hidden">
        <div
          className={`rounded-t-2xl bg-white shadow-2xl ring-1 ring-stone-200 transition-[max-height] ${
            mobileOpen ? "max-h-[75vh]" : "max-h-14"
          }`}
        >
          <button
            type="button"
            className="flex w-full items-center justify-center py-2"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span className="h-1 w-10 rounded-full bg-stone-300" />
          </button>
          {selected && mobileOpen ? (
            <div className="max-h-[70vh] overflow-y-auto px-2 pb-3">
              <EventDetailPanel
                event={selected}
                locale={locale}
                onClose={() => setSelectedId(null)}
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
                <div className="max-h-[60vh] overflow-y-auto">
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
                      onClick={() => setSelectedId(event.id)}
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
  return `inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-medium shadow-md ring-1 transition ${
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
  dateFrom,
  dateTo,
  categories,
  disciplines,
  levels,
  series,
  seriesList,
  onPreset,
  onFrom,
  onTo,
  onCategory,
  onDiscipline,
  onLevel,
  onClearDisciplines,
  onClearLevels,
  onClearCategories,
  onSeries,
  stacked,
}: {
  messages: Messages;
  dateFrom: string;
  dateTo: string;
  categories: string[];
  disciplines: string[];
  levels: string[];
  series: string;
  seriesList: { slug: string; name: string; eventCount: number }[];
  onPreset: (from: string, to: string) => void;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onCategory: (v: string) => void;
  onDiscipline: (v: string) => void;
  onLevel: (v: string) => void;
  onClearDisciplines: () => void;
  onClearLevels: () => void;
  onClearCategories: () => void;
  onSeries: (slug: string) => void;
  stacked?: boolean;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (dateRef.current && !dateRef.current.contains(t)) setDateOpen(false);
      if (typeRef.current && !typeRef.current.contains(t)) setTypeOpen(false);
      if (categoryRef.current && !categoryRef.current.contains(t)) setCategoryOpen(false);
      if (levelRef.current && !levelRef.current.contains(t)) setLevelOpen(false);
      if (moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function closeOthers(except: "date" | "type" | "category" | "level" | "series") {
    if (except !== "date") setDateOpen(false);
    if (except !== "type") setTypeOpen(false);
    if (except !== "category") setCategoryOpen(false);
    if (except !== "level") setLevelOpen(false);
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
  const anyDate = !dateFrom && !dateTo;
  const dateActive = Boolean(dateFrom || dateTo);
  const isPreset = isThisWeekend || isNextWeekend || isThisMonth || isNextMonth || anyDate;
  const isCustom = dateActive && !isPreset;
  const dateLabel = isThisWeekend
    ? messages.thisWeekend
    : isNextWeekend
      ? messages.nextWeekend
      : isThisMonth
        ? messages.thisMonth
        : isNextMonth
          ? messages.nextMonth
          : anyDate
            ? messages.anyDate
            : isCustom && dateFrom && dateTo
              ? `${format(parseISO(dateFrom), "d MMM")} – ${format(parseISO(dateTo), "d MMM")}`
              : isCustom && dateFrom
                ? `${messages.from} ${format(parseISO(dateFrom), "d MMM")}`
                : messages.date;

  const seriesName = seriesList.find((s) => s.slug === series)?.name;
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

  const datePresets: { id: string; label: string; active: boolean; apply: () => void }[] = [
    {
      id: "thisWeekend",
      label: messages.thisWeekend,
      active: isThisWeekend,
      apply: () => onPreset(thisW.from, thisW.to),
    },
    {
      id: "nextWeekend",
      label: messages.nextWeekend,
      active: isNextWeekend,
      apply: () => onPreset(nextW.from, nextW.to),
    },
    {
      id: "thisMonth",
      label: messages.thisMonth,
      active: isThisMonth,
      apply: () => onPreset(thisM.from, thisM.to),
    },
    {
      id: "nextMonth",
      label: messages.nextMonth,
      active: isNextMonth,
      apply: () => onPreset(nextM.from, nextM.to),
    },
    {
      id: "any",
      label: messages.anyDate,
      active: anyDate,
      apply: () => onPreset("", ""),
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
          <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-72 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-stone-200">
            <p className="px-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              {messages.date}
            </p>
            {datePresets.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm ${
                  opt.active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
                }`}
                onClick={() => {
                  opt.apply();
                  setDateOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
            <div className="mt-1 border-t border-stone-100 px-2 pb-1 pt-2">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                {messages.customDate}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] text-stone-500">{messages.from}</span>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => onFrom(e.target.value)}
                    className="h-9"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-stone-500">{messages.to}</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => onTo(e.target.value)}
                    className="h-9"
                  />
                </label>
              </div>
            </div>
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
                    className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm ${
                      on ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
                    }`}
                    onClick={() => {
                      onDiscipline(opt.id);
                      if (!opt.children?.length) setTypeOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                  {opt.children?.map((child) => {
                    const childOn = selectedDisc === child.id;
                    return (
                      <button
                        key={child.id}
                        type="button"
                        className={`flex w-full items-center rounded-xl py-1.5 pl-6 pr-3 text-left text-sm ${
                          childOn
                            ? "bg-stone-900 text-white"
                            : "text-stone-600 hover:bg-stone-50"
                        }`}
                        onClick={() => {
                          onDiscipline(child.id);
                          setTypeOpen(false);
                        }}
                      >
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
            {AGE_CATEGORIES.map((id) => {
              const on = categories.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm ${
                    on ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
                  }`}
                  onClick={() => onCategory(id)}
                >
                  {AGE_CATEGORY_LABELS[id]}
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

      {seriesList.length > 0 && (
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            className={mapChip(Boolean(series))}
            onClick={() => {
              closeOthers("series");
              setMoreOpen((v) => !v);
            }}
          >
            <SlidersHorizontal className="h-4 w-4 text-stone-500" />
            {seriesName || "Series"}
            <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
          </button>
          {moreOpen && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-40 max-h-64 w-64 overflow-y-auto rounded-2xl bg-white p-2 shadow-xl ring-1 ring-stone-200">
              {seriesList.slice(0, 24).map((s) => (
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
                  className={`block px-3 py-2 text-sm ${
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
                className="block w-full px-3 py-2 text-left text-sm text-stone-600 hover:bg-stone-50"
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
  const audienceLabel =
    event.ageCategories?.length
      ? event.ageCategories
          .map((c) => AGE_CATEGORY_LABELS[c as keyof typeof AGE_CATEGORY_LABELS] || c)
          .join(" · ")
      : formatAudienceList(
          event.audience,
          { kids: messages.kids, youth: messages.youth, adults: messages.adults },
          event.categories,
        );
  const discLabel = event.disciplines.map((d) => disciplineLabel(d)).filter(Boolean).join(", ");
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border-b border-stone-100 px-4 py-3 text-left transition hover:bg-stone-50 ${
        active ? "bg-stone-100" : ""
      }`}
    >
      <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-stone-500">
        <span
          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
          style={{ background: levelColor(event.level) }}
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
        {` · ${audienceLabel}`}
      </p>
    </button>
  );
}

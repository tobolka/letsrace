"use client";

import { ageCategoryLabel, ageGroupHint, disciplineLabel, raceLevelLabel } from "@/lib/i18n/taxonomy";

import { useCallback, useState, type ComponentType, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  addDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import {
  Bike,
  Calendar,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  Globe,
  ListFilter,
  Search,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { isoToRange } from "@/components/explore/date-range";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  nextWeekendRange,
  thisWeekendRange,
  todayIso,
} from "@/lib/date-presets";
import { countryDisplayName, sortCountryCodes } from "@/lib/geo/europe";
import {
  INT_COUNTRY,
  seriesCountryCodes,
  seriesCountryKey,
  seriesInCountries,
  type SeriesOption,
} from "@/lib/explore-filters";
import type { Messages } from "@/lib/i18n/messages";
import { familyColor } from "@/lib/map-visuals";
import {
  AGE_CATEGORY_FILTERS,
  DISCIPLINE_TREE,
  RACE_LEVELS,
} from "@/lib/taxonomy";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { dateFnsLocale } from "@/lib/i18n/dates";

const DateRangeCalendar = dynamic(
  () =>
    import("@/components/explore/date-range-calendar").then((m) => ({
      default: m.DateRangeCalendar,
    })),
  {
    loading: () => (
      <Skeleton className="h-64 w-[280px] bg-muted/50" aria-hidden />
    ),
  },
);

type ExtraFilter = "discipline" | "category" | "level" | "country" | "series";

const EXTRA_ORDER: ExtraFilter[] = [
  "discipline",
  "category",
  "level",
  "country",
  "series",
];

const FILTER_ICONS: Record<ExtraFilter, ComponentType<{ className?: string }>> = {
  discipline: Bike,
  category: UserRound,
  level: ChartNoAxesColumnIncreasing,
  country: Globe,
  series: Trophy,
};

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

export function MapFilterBar({
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
  onClearCountries,
  q,
  onQ,
  onSearchSubmit,
  hideSearch = false,
  allFilters = false,
  wide = false,
  hideDate = false,
  extra,
  menuExtra,
}: {
  messages: Messages;
  locale: string;
  dateFrom: string;
  dateTo: string;
  categories: string[];
  disciplines: string[];
  levels: string[];
  series: string;
  country: string[];
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
  onClearCountries: () => void;
  q: string;
  onQ: (q: string) => void;
  onSearchSubmit: () => void;
  hideSearch?: boolean;
  /** Mobile chip row: pin every extra filter, not only active ones. */
  allFilters?: boolean;
  /** Full-width list mode: every filter pinned, chips wrap instead of scroll. */
  wide?: boolean;
  /** The schedule picks its dates by month, so it has no date control. */
  hideDate?: boolean;
  /** Only races whose stated categories fit; unconfirmed ones hidden. */
  /** More chips, placed after the date — the list's distance filter. */
  extra?: ReactNode;
  /** Additional filters kept inside the filter menu. */
  menuExtra?: ReactNode;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const [customPicked, setCustomPicked] = useState(false);
  const [dateDraft, setDateDraft] = useState<DateRange | undefined>();
  const focusSeriesSearch = useCallback((input: HTMLInputElement | null) => {
    if (!input) return;
    const frame = requestAnimationFrame(() => input.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  const [seriesQuery, setSeriesQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

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

  const df = dateFnsLocale(locale);
  const draftFrom = dateDraft?.from ? format(dateDraft.from, "d MMM", { locale: df }) : null;
  const draftTo = dateDraft?.to ? format(dateDraft.to, "d MMM", { locale: df }) : null;
  const dateLabel = isCustom
    ? draftFrom && draftTo
      ? `${draftFrom} – ${draftTo}`
      : draftFrom
        ? `${draftFrom} – …`
        : dateFrom && dateTo
          ? `${format(parseISO(dateFrom), "d MMM", { locale: df })} – ${format(parseISO(dateTo), "d MMM", { locale: df })}`
          : dateFrom
            ? `${messages.from} ${format(parseISO(dateFrom), "d MMM", { locale: df })}`
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
  const countryCodes = seriesCountryCodes(seriesList, locale);
  const visibleSeries = seriesInCountries(seriesList, country);
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
  const showSeriesHeaders = country.length !== 1 && seriesGroups.length > 1;

  const extraMeta: Record<ExtraFilter, { label: string; value?: string }> = {
    discipline: {
      label: messages.typeFilter,
      value:
        disciplines.length === 0
          ? undefined
          : disciplines.map((id) => disciplineLabel(id, locale)).join(", "),
    },
    category: {
      label: messages.categoryFilter,
      value:
        categories.length === 0
          ? undefined
          : categories
              .map((id) => ageCategoryLabel(id, locale))
              .join(", "),
    },
    level: {
      label: messages.levelFilter,
      value:
        levels.length === 0
          ? undefined
          : levels.map((id) => raceLevelLabel(id, locale)).join(", "),
    },
    country: {
      label: messages.countryFilter,
      value:
        country.length === 0
          ? undefined
          : country.map((code) => countryDisplayName(code, locale)).join(", "),
    },
    series: {
      label: messages.seriesFilter,
      value: seriesName || series || undefined,
    },
  };

  function hasValue(id: ExtraFilter) {
    if (id === "discipline") return disciplines.length > 0;
    if (id === "category") return categories.length > 0;
    if (id === "level") return levels.length > 0;
    if (id === "country") return country.length > 0;
    return Boolean(series);
  }

  const visible = EXTRA_ORDER.filter(hasValue);
  // Mobile: every extra filter is a chip (horizontal scroll). Nested
  // submenus behind “+ Filtr” are unusable on a phone.
  const pinAll = allFilters || hideSearch || wide;
  const shownExtras = pinAll ? EXTRA_ORDER : visible;
  const availableToAdd = pinAll
    ? []
    : EXTRA_ORDER.filter((id) => {
        if (shownExtras.includes(id)) return false;
        if (visible.includes(id)) return false;
        if (id === "series" && visibleSeries.length === 0) return false;
        if (id === "country" && countryCodes.length === 0) return false;
        return true;
      });
  const menuFilters = menuExtra
    ? EXTRA_ORDER.filter((id) => {
        if (id === "series") return visibleSeries.length > 0 || hasValue(id);
        if (id === "country") return countryCodes.length > 0 || hasValue(id);
        return true;
      })
    : availableToAdd;

  function applyPreset(from: string, to: string) {
    setCustomPicked(false);
    setDateDraft(undefined);
    onPreset(from, to);
  }

  function unpin(id: ExtraFilter) {
    if (id === "discipline" && disciplines.length) onClearDisciplines();
    if (id === "category" && categories.length) onClearCategories();
    if (id === "level" && levels.length) onClearLevels();
    if (id === "country" && country.length) onClearCountries();
    if (id === "series" && series) onSeries(series);
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

  function renderValues(id: ExtraFilter) {
    if (id === "discipline") {
      return (
        <>
          {DISCIPLINE_TREE.map((opt) => (
            <DropdownMenuGroup key={opt.id}>
              <DropdownMenuCheckboxItem
                checked={disciplines.includes(opt.id)}
                onCheckedChange={() => onDiscipline(opt.id)}
                onSelect={(e) => e.preventDefault()}
                className={itemClass}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: familyColor(opt.id) }}
                  aria-hidden
                />
                {disciplineLabel(opt.id, locale)}
              </DropdownMenuCheckboxItem>
              {opt.children?.map((child) => (
                <DropdownMenuCheckboxItem
                  key={child.id}
                  checked={disciplines.includes(child.id)}
                  onCheckedChange={() => onDiscipline(child.id)}
                  onSelect={(e) => e.preventDefault()}
                  className={cn(itemClass, "pl-12 [&>span]:left-6")}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: familyColor(child.id) }}
                    aria-hidden
                  />
                  {disciplineLabel(child.id, locale)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </>
      );
    }
    if (id === "category") {
      return (
        <>
          {AGE_CATEGORY_FILTERS.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.id}
              checked={categories.includes(opt.id)}
              onCheckedChange={() => onCategory(opt.id)}
              onSelect={(e) => e.preventDefault()}
              className={itemClass}
            >
              {ageCategoryLabel(opt.id, locale)}
              {/* Which classes the group means, in the organisers' terms. */}
              <span className="ml-auto pl-4 text-right text-xs whitespace-nowrap tabular-nums text-muted-foreground">{ageGroupHint(opt.id, locale)}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </>
      );
    }
    if (id === "level") {
      return RACE_LEVELS.map((levelId) => (
        <DropdownMenuCheckboxItem
          key={levelId}
          checked={levels.includes(levelId)}
          onCheckedChange={() => onLevel(levelId)}
          className={itemClass}
        >
          {raceLevelLabel(levelId, locale)}
        </DropdownMenuCheckboxItem>
      ));
    }
    if (id === "country") {
      return (
        <>
          <DropdownMenuCheckboxItem
            checked={country.length === 0}
            onCheckedChange={() => {
              if (country.length) onClearCountries();
            }}
            onSelect={(e) => e.preventDefault()}
            className={itemClass}
          >
            {messages.allCountries}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {countryCodes.map((code) => (
            <DropdownMenuCheckboxItem
              key={code}
              checked={country.includes(code)}
              onCheckedChange={() => onCountry(code)}
              onSelect={(e) => e.preventDefault()}
              className={itemClass}
            >
              {countryDisplayName(code, locale)}
            </DropdownMenuCheckboxItem>
          ))}
        </>
      );
    }
    return (
      <>
        <div
          className="sticky -top-1 z-10 bg-popover px-1 pb-2 pt-1"
          onKeyDown={(e) => { if (e.key !== "Escape" && e.key !== "Tab") e.stopPropagation(); }}
        >
          <Input
            type="search"
            ref={focusSeriesSearch}
            aria-label={messages.searchSeries}
            value={seriesQuery}
            onChange={(e) => setSeriesQuery(e.target.value)}
            placeholder={messages.searchSeries}
            className="h-9"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {filteredSeriesGroups.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">{messages.noSeries}</p>
        ) : null}
        {filteredSeriesGroups.map((group, index) => (
          <DropdownMenuGroup key={group.key}>
            {index > 0 && showSeriesHeaders ? <DropdownMenuSeparator /> : null}
            {showSeriesHeaders ? (
              <DropdownMenuLabel className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {group.label}
              </DropdownMenuLabel>
            ) : null}
            {group.items.map((s) => (
              <DropdownMenuItem
                key={s.slug}
                className={itemClass}
                onSelect={() => onSeries(s.slug)}
              >
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {s.eventCount}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-1.5",
        pinAll && !wide ? "w-max" : "w-full",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5",
          wide
            ? "min-w-0 flex-1 flex-wrap"
            : pinAll
            ? "flex-nowrap"
            : "min-w-0 flex-1 flex-wrap max-md:flex-nowrap max-md:overflow-x-auto",
        )}
      >
        {hideDate ? null : (
        <Popover
          open={dateOpen}
          onOpenChange={(next) => {
            setDateOpen(next);
            if (next) {
              setCustomPicked(dateActive && !isPreset);
              setDateDraft(undefined);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-pressed={dateOpen}
              className="h-8 shrink-0 leading-none tabular-nums max-md:h-11 [@media(pointer:coarse)]:h-11"
            >
              <Calendar />
              {dateLabel}
              <ChevronDown />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto max-h-[min(70dvh,36rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain p-0"
            collisionPadding={12}
          >
            <div className="flex w-full flex-col overflow-hidden md:flex-row">
              <div className="flex w-full shrink-0 flex-col p-1 md:w-36">
                {datePresets.map((opt) => (
                  <Button
                    key={opt.id}
                    type="button"
                    variant={opt.active ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    aria-pressed={opt.active}
                    onClick={opt.apply}
                  >
                    {opt.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={isCustom ? "default" : "ghost"}
                  size="sm"
                  className="w-full justify-start"
                  aria-pressed={isCustom}
                  onClick={() => setCustomPicked(true)}
                >
                  {messages.customDate}
                </Button>
              </div>
              <Separator orientation="vertical" className="hidden md:block" />
              <Separator className="md:hidden" />
              {dateOpen ? (
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
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
        )}
        {extra}

        {shownExtras.map((id) => {
          const Icon = FILTER_ICONS[id];
          const active = hasValue(id);
          return (
            <div key={id} className="inline-flex h-full max-w-full shrink-0 items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label={`${extraMeta[id].label} ${extraMeta[id].value ?? ""}`.trim()}
                    className={cn(
                      "max-md:h-11 [@media(pointer:coarse)]:h-11",
                      active && "rounded-r-none",
                    )}
                  >
                    <Icon />
                    <span className="max-w-[12rem] truncate">
                      {extraMeta[id].value || extraMeta[id].label}
                    </span>
                    {/* On, in the brand red of the LR mark — the same dot on every screen. */}
                    {active ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand" /> : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className={cn(
                    "max-h-[min(60dvh,20rem)] overflow-y-auto [scrollbar-gutter:stable]",
                    id === "series" ? "w-72 max-w-[calc(100vw-1.5rem)]" : "w-56",
                  )}
                  collisionPadding={12}
                >
                  {renderValues(id)}
                </DropdownMenuContent>
              </DropdownMenu>
              {active ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  aria-label={`${messages.clearFilter} ${extraMeta[id].label}`}
                  className="rounded-l-none max-md:size-11 [@media(pointer:coarse)]:size-11"
                  onClick={() => unpin(id)}
                >
                  <X />
                </Button>
              ) : null}
            </div>
          );
        })}

        {menuFilters.length > 0 || menuExtra ? (
          <DropdownMenu
            onOpenChange={(next) => {
              if (next) setSeriesQuery("");
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={messages.addFilter}
                className="size-8 [@media(pointer:coarse)]:size-11"
              >
                <ListFilter />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56" collisionPadding={12}>
              {menuExtra}
              {menuFilters.map((id) => {
                const Icon = FILTER_ICONS[id];
                const active = hasValue(id);
                return (
                  <DropdownMenuSub key={id}>
                    <DropdownMenuSubTrigger className={cn(itemClass, active && "bg-accent/70 font-medium")}>
                      <Icon />
                      <span className="min-w-0 truncate">{extraMeta[id].label}</span>
                      {active ? (
                        <>
                          <span className="ml-auto max-w-24 truncate text-xs text-muted-foreground">{extraMeta[id].value}</span>
                          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand" />
                        </>
                      ) : null}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent
                        className={cn(
                          // The scrollbar took the column the counts sit in.
                          "max-h-80 overflow-y-auto [scrollbar-gutter:stable]",
                          id === "series" ? "w-72" : "w-56",
                        )}
                      >
                        {renderValues(id)}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {hideSearch ? null : q.trim() ? (
        <div className="inline-flex h-full max-w-[min(100%,12rem)] shrink-0 items-center">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label={messages.search}
                className="rounded-r-none"
              >
                <Search />
                <span className="max-w-[8rem] truncate">{q.trim()}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2" collisionPadding={12}>
              <PlaceSearchForm
                q={q}
                messages={messages}
                onQ={onQ}
                onSubmit={() => {
                  onSearchSubmit();
                  setSearchOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label={messages.clearFilter}
            className="rounded-l-none"
            onClick={() => onQ("")}
          >
            <X />
          </Button>
        </div>
      ) : (
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={messages.search}
              className="size-8 [@media(pointer:coarse)]:size-11"
            >
              <Search />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2" collisionPadding={12}>
            <PlaceSearchForm
              q={q}
              messages={messages}
              onQ={onQ}
              onSubmit={() => {
                onSearchSubmit();
                setSearchOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function PlaceSearchForm({
  q,
  messages,
  onQ,
  onSubmit,
}: {
  q: string;
  messages: Messages;
  onQ: (q: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          name="q"
          type="search"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder={messages.searchPlaceholder}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label={messages.search}
          autoFocus
        />
      </InputGroup>
    </form>
  );
}

const itemClass = "max-md:min-h-11 [@media(pointer:coarse)]:min-h-11";

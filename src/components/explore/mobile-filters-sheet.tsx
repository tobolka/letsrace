"use client";

import { useMemo, useState } from "react";
import { addDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { X } from "lucide-react";
import { DateRangeCalendar, isoToRange } from "@/components/explore/date-range-calendar";
import { seriesCountryKey, INT_COUNTRY, type SeriesOption } from "@/components/explore/map-filter-bar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHandle,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { thisWeekendRange, nextWeekendRange, todayIso } from "@/lib/date-presets";
import { countryDisplayName, sortCountryCodes } from "@/lib/geo/europe";
import type { Messages } from "@/lib/i18n/messages";
import {
  AGE_CATEGORY_FILTERS,
  AGE_CATEGORY_LABELS,
  DISCIPLINE_LABELS,
  DISCIPLINE_TREE,
  RACE_LEVEL_LABELS,
  RACE_LEVELS,
  type Discipline,
  type RaceLevel,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { dateFnsLocale } from "@/lib/i18n/dates";

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

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      className="h-11 shrink-0 rounded-full px-3.5 text-sm"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function MobileFiltersSheet({
  open,
  onOpenChange,
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
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  onReset: () => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState<DateRange | undefined>();
  const [seriesQuery, setSeriesQuery] = useState("");

  const thisW = thisWeekendRange();
  const nextW = nextWeekendRange();
  const thisM = thisMonthRange();
  const nextM = nextMonthRange();
  const today = todayIso();
  const isThisWeekend = dateFrom === thisW.from && dateTo === thisW.to;
  const isNextWeekend = dateFrom === nextW.from && dateTo === nextW.to;
  const isThisMonth = dateFrom === thisM.from && dateTo === thisM.to;
  const isNextMonth = dateFrom === nextM.from && dateTo === nextM.to;
  const isUpcoming = dateFrom === today && !dateTo;
  const anyDate = !dateFrom && !dateTo;
  const isPreset =
    isThisWeekend || isNextWeekend || isThisMonth || isNextMonth || anyDate || isUpcoming;
  const isCustom = customOpen || (Boolean(dateFrom || dateTo) && !isPreset);

  const countryCodes = sortCountryCodes(
    seriesList.map((s) => seriesCountryKey(s.countryCode)).filter((k) => k !== INT_COUNTRY),
    locale,
  );

  const visibleSeries = useMemo(() => {
    const base = country
      ? seriesList.filter((s) => seriesCountryKey(s.countryCode) === country)
      : seriesList;
    const q = seriesQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.includes(q) ||
        (s.shortName?.toLowerCase().includes(q) ?? false),
    );
  }, [seriesList, country, seriesQuery]);

  const datePresets = [
    { id: "weekend", label: messages.thisWeekend, active: !isCustom && isThisWeekend, apply: () => { setCustomOpen(false); onPreset(thisW.from, thisW.to); } },
    { id: "nextWeekend", label: messages.nextWeekend, active: !isCustom && isNextWeekend, apply: () => { setCustomOpen(false); onPreset(nextW.from, nextW.to); } },
    { id: "upcoming", label: messages.upcoming, active: !isCustom && isUpcoming, apply: () => { setCustomOpen(false); onPreset(today, ""); } },
    { id: "thisMonth", label: messages.thisMonth, active: !isCustom && isThisMonth, apply: () => { setCustomOpen(false); onPreset(thisM.from, thisM.to); } },
    { id: "nextMonth", label: messages.nextMonth, active: !isCustom && isNextMonth, apply: () => { setCustomOpen(false); onPreset(nextM.from, nextM.to); } },
    { id: "any", label: messages.anyDate, active: !isCustom && anyDate, apply: () => { setCustomOpen(false); onPreset("", ""); } },
  ];

  const selectedDisc = disciplines[0];
  const activeExtras =
    (disciplines.length ? 1 : 0) +
    (categories.length ? 1 : 0) +
    (levels.length ? 1 : 0) +
    (country ? 1 : 0) +
    (series ? 1 : 0) +
    (isThisWeekend ? 0 : 1);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setCustomOpen(false);
          setSeriesQuery("");
        }
      }}
      shouldScaleBackground={false}
      repositionInputs={false}
    >
      <DrawerContent className="flex max-h-[92dvh] flex-col md:hidden">
        <DrawerHandle />
        <div className="flex items-center justify-between gap-3 px-4 pb-2">
          <DrawerTitle className="text-left text-base font-semibold">
            {messages.addFilter}
          </DrawerTitle>
          {activeExtras > 0 ? (
            <Button type="button" variant="ghost" size="sm" className="h-11 px-3" onClick={onReset}>
              {messages.clearFilters}
            </Button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          <div className="flex flex-col gap-6">
            <Section title={messages.date}>
              <div className="flex flex-wrap gap-2">
                {datePresets.map((p) => (
                  <Chip key={p.id} active={p.active} onClick={p.apply}>
                    {p.label}
                  </Chip>
                ))}
                <Chip
                  active={isCustom}
                  onClick={() => {
                    setCustomOpen(true);
                    setDateDraft(isoToRange(dateFrom, dateTo));
                  }}
                >
                  {isCustom && dateFrom
                    ? dateTo
                      ? `${format(parseISO(dateFrom), "d MMM", { locale: dateFnsLocale(locale) })} – ${format(parseISO(dateTo), "d MMM", { locale: dateFnsLocale(locale) })}`
                      : format(parseISO(dateFrom), "d MMM", { locale: dateFnsLocale(locale) })
                    : messages.customDate}
                </Chip>
              </div>
              {isCustom ? (
                <div className="mt-1 overflow-hidden rounded-xl border bg-muted/30 p-1">
                  <DateRangeCalendar
                    locale={locale}
                    selected={dateDraft ?? isoToRange(dateFrom, dateTo)}
                    onSelect={(range) => {
                      if (!range?.from) return;
                      setDateDraft(range);
                      if (range.to) {
                        const start = range.from <= range.to ? range.from : range.to;
                        const end = range.from <= range.to ? range.to : range.from;
                        onPreset(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
                      }
                    }}
                  />
                </div>
              ) : null}
            </Section>

            <Separator />

            <Section title={messages.typeFilter}>
              <div className="flex flex-wrap gap-2">
                <Chip active={!selectedDisc} onClick={onClearDisciplines}>
                  {messages.clearFilter}
                </Chip>
                {DISCIPLINE_TREE.map((opt) => (
                  <Chip
                    key={opt.id}
                    active={selectedDisc === opt.id}
                    onClick={() => onDiscipline(opt.id)}
                  >
                    {DISCIPLINE_LABELS[opt.id as Discipline] || opt.label}
                  </Chip>
                ))}
              </div>
            </Section>

            <Section title={messages.categoryFilter}>
              <div className="flex flex-wrap gap-2">
                <Chip active={categories.length === 0} onClick={onClearCategories}>
                  {messages.clearFilter}
                </Chip>
                {AGE_CATEGORY_FILTERS.map((opt) => (
                  <Chip
                    key={opt.id}
                    active={categories.includes(opt.id)}
                    onClick={() => onCategory(opt.id)}
                  >
                    {AGE_CATEGORY_LABELS[opt.id as keyof typeof AGE_CATEGORY_LABELS] || opt.label}
                  </Chip>
                ))}
              </div>
            </Section>

            <Section title={messages.levelFilter}>
              <div className="flex flex-wrap gap-2">
                <Chip active={levels.length === 0} onClick={onClearLevels}>
                  {messages.clearFilter}
                </Chip>
                {RACE_LEVELS.map((id) => (
                  <Chip key={id} active={levels.includes(id)} onClick={() => onLevel(id)}>
                    {RACE_LEVEL_LABELS[id as RaceLevel] || id}
                  </Chip>
                ))}
              </div>
            </Section>

            {countryCodes.length > 0 ? (
              <Section title={messages.countryFilter}>
                <div className="flex flex-wrap gap-2">
                  <Chip active={!country} onClick={() => country && onCountry(country)}>
                    {messages.allCountries}
                  </Chip>
                  {countryCodes.map((code) => (
                    <Chip
                      key={code}
                      active={country === code}
                      onClick={() => onCountry(code)}
                    >
                      {countryDisplayName(code, locale)}
                    </Chip>
                  ))}
                </div>
              </Section>
            ) : null}

            {seriesList.length > 0 ? (
              <Section title={messages.seriesFilter}>
                <Input
                  type="search"
                  value={seriesQuery}
                  onChange={(e) => setSeriesQuery(e.target.value)}
                  placeholder={messages.searchSeries}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-11 text-base"
                />
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto overscroll-contain">
                  {series ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 justify-start gap-2 px-3"
                      onClick={() => onSeries(series)}
                    >
                      <X className="size-4" aria-hidden />
                      {messages.clearFilter}
                    </Button>
                  ) : null}
                  {visibleSeries.slice(0, 40).map((s) => (
                    <Button
                      key={s.slug}
                      type="button"
                      variant={series === s.slug ? "secondary" : "ghost"}
                      className={cn(
                        "h-11 justify-between gap-2 px-3 text-left",
                        series === s.slug && "bg-secondary",
                      )}
                      onClick={() => onSeries(s.slug)}
                    >
                      <span className="min-w-0 truncate">{s.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {s.eventCount}
                      </span>
                    </Button>
                  ))}
                  {visibleSeries.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-muted-foreground">{messages.noSeries}</p>
                  ) : null}
                </div>
              </Section>
            ) : null}
          </div>
        </div>

        <DrawerFooter className="border-t pt-3">
          <Button
            type="button"
            size="lg"
            className="h-12 w-full text-base"
            onClick={() => onOpenChange(false)}
          >
            {messages.filtersDone}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

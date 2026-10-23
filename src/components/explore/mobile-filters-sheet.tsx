"use client";

import { ageCategoryLabel, ageGroupHint, disciplineLabel, raceLevelLabel } from "@/lib/i18n/taxonomy";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { format, parseISO } from "date-fns";
import { LocateFixed, X } from "lucide-react";
import { isoToRange } from "@/components/explore/date-range";
import { seriesCountryKey, INT_COUNTRY, type SeriesOption } from "@/components/explore/map-filter-bar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHandle,
  DrawerTitle,
} from "@/components/ui/drawer";
import { MODAL_SURFACE } from "@/components/explore/mobile-sheets";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { nextMonthRange, nextWeekendRange, thisMonthRange, thisWeekendRange, todayIso } from "@/lib/date-presets";
import { RADIUS_OPTIONS } from "@/lib/explore-params";
import { countryDisplayName, sortCountryCodes } from "@/lib/geo/europe";
import type { Messages } from "@/lib/i18n/messages";
import {
  AGE_CATEGORY_FILTERS,
  DISCIPLINE_TREE,
  RACE_LEVELS,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { dateFnsLocale } from "@/lib/i18n/dates";

const DateRangeCalendar = dynamic(
  () =>
    import("@/components/explore/date-range-calendar").then((m) => ({
      default: m.DateRangeCalendar,
    })),
);

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

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {icon}
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
  onClearCountries,
  onReset,
  hideDate = false,
  customDate = false,
  radius,
  radiusStatus,
  onRadius,
  resultCount,
}: {
  /** The calendar picks its dates by month, so it has no date section. */
  hideDate?: boolean;
  /** Open on the date picker — "Vlastní datum" chosen from the date pill. */
  customDate?: boolean;
  /** The distance from you, the same chips on every view. */
  radius?: number | null;
  radiusStatus?: string;
  onRadius?: (km: number | null) => void;
  /** How many races the filters leave, for the button that shows them. */
  resultCount?: number | null;
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
  onReset: () => void;
}) {
  const [customOpen, setCustomOpen] = useState(customDate);
  const [dateDraft, setDateDraft] = useState<DateRange | undefined>(() => (customDate ? isoToRange(dateFrom, dateTo) : undefined));
  // The panel stays mounted between openings so it can finish closing; each
  // opening starts where the button that opened it asked.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCustomOpen(customDate);
      setDateDraft(customDate ? isoToRange(dateFrom, dateTo) : undefined);
    }
  }
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
    const base = country.length
      ? seriesList.filter((s) => country.includes(seriesCountryKey(s.countryCode)))
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

  const activeExtras =
    (disciplines.length ? 1 : 0) +
    (categories.length ? 1 : 0) +
    (levels.length ? 1 : 0) +
    (country.length ? 1 : 0) +
    (series ? 1 : 0) +
    (radius != null ? 1 : 0) +
    (hideDate || isThisWeekend ? 0 : 1);

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
      // vaul pins the body while open and restores it on close; the shell
      // never scrolls the body, and a restore that did not run left a strip
      // of overlay at the foot of the page.
      noBodyStyles
      repositionInputs={false}
      // The chips scroll; only the grab bar moves the sheet. A flick at the
      // top of the list used to start dragging the whole panel instead.
      handleOnly
    >
      <DrawerContent className={cn(MODAL_SURFACE, "flex flex-col")}>
        <DrawerHandle />
        <div className="flex items-center justify-between gap-3 px-4 pb-2">
          <DrawerTitle className="text-left text-base font-semibold">
            {messages.filtersButton}
          </DrawerTitle>
          <div className="flex items-center gap-1">
            {activeExtras > 0 ? (
              <Button type="button" variant="ghost" size="sm" className="h-11 px-3" onClick={onReset}>
                {messages.clearFilters}
              </Button>
            ) : null}
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="icon" className="-mr-2 size-10 rounded-full" aria-label={messages.close}>
                <X className="size-4" aria-hidden />
              </Button>
            </DrawerClose>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          <div className="flex flex-col gap-6">
            {/* The date has a pill of its own in the row; the panel holds it
                only when a range is being picked by hand. */}
            {hideDate || !customOpen ? null : (
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
            )}

            {hideDate || !customOpen ? null : <Separator />}

            <Section title={messages.typeFilter}>
              <div className="flex flex-wrap gap-2">
                <Chip active={disciplines.length === 0} onClick={onClearDisciplines}>
                  {messages.filterAll}
                </Chip>
                {DISCIPLINE_TREE.map((opt) => (
                  <Chip
                    key={opt.id}
                    active={disciplines.includes(opt.id)}
                    onClick={() => onDiscipline(opt.id)}
                  >
                    {disciplineLabel(opt.id, locale)}
                  </Chip>
                ))}
              </div>
            </Section>

            <Section title={messages.categoryFilter}>
              <div className="flex flex-wrap gap-2">
                <Chip active={categories.length === 0} onClick={onClearCategories}>
                  {messages.filterAll}
                </Chip>
                {AGE_CATEGORY_FILTERS.map((opt) => (
                  <Chip
                    key={opt.id}
                    active={categories.includes(opt.id)}
                    onClick={() => onCategory(opt.id)}
                  >
                    {ageCategoryLabel(opt.id, locale)}
                    {ageGroupHint(opt.id, locale) ? (
                      <span className="ml-1 text-xs opacity-60">{ageGroupHint(opt.id, locale)}</span>
                    ) : null}
                  </Chip>
                ))}
              </div>
            </Section>

            <Section title={messages.levelFilter}>
              <div className="flex flex-wrap gap-2">
                <Chip active={levels.length === 0} onClick={onClearLevels}>
                  {messages.filterAll}
                </Chip>
                {RACE_LEVELS.map((id) => (
                  <Chip key={id} active={levels.includes(id)} onClick={() => onLevel(id)}>
                    {raceLevelLabel(id, locale)}
                  </Chip>
                ))}
              </div>
            </Section>

            {countryCodes.length > 0 ? (
              <Section title={messages.countryFilter}>
                <div className="flex flex-wrap gap-2">
                  <Chip active={country.length === 0} onClick={onClearCountries}>
                    {messages.allCountries}
                  </Chip>
                  {countryCodes.map((code) => (
                    <Chip
                      key={code}
                      active={country.includes(code)}
                      onClick={() => onCountry(code)}
                    >
                      {countryDisplayName(code, locale)}
                    </Chip>
                  ))}
                </div>
              </Section>
            ) : null}

            {onRadius ? (
              <Section title={messages.distanceFilter} icon={<LocateFixed className="size-3.5" aria-hidden />}>
                <div className="flex flex-wrap gap-2">
                  {[null, ...RADIUS_OPTIONS].map((km) => (
                    <Chip key={km ?? "any"} active={(radius ?? null) === km} onClick={() => onRadius(km)}>
                      {km == null ? messages.distanceAny : messages.distanceWithin.replace("{km}", String(km))}
                    </Chip>
                  ))}
                </div>
                {radius != null && (radiusStatus === "denied" || radiusStatus === "outside") ? (
                  <p className="text-xs text-muted-foreground">
                    {radiusStatus === "outside" ? messages.distanceOutside : messages.distanceDenied}
                  </p>
                ) : null}
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
            {resultCount != null ? messages.showResults.replace("{n}", String(resultCount)) : messages.filtersDone}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

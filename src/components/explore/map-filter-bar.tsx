"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { Bike, ChartNoAxesColumnIncreasing, Globe, ListFilter, Trophy, UserRound, X } from "lucide-react";
import { DateFilter } from "@/components/explore/date-filter";
import {
  extraMeta as describeExtras,
  hasExtraValue,
  layoutExtras,
  seriesView,
  type ExtraFilter,
} from "@/components/explore/filter-bar-model";
import { FilterValues } from "@/components/explore/filter-values";
import { ACTIVE_CHIP, itemClass } from "@/components/explore/filter-styles";
import { PlaceSearch } from "@/components/explore/place-search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SeriesOption } from "@/lib/explore-filters";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const FILTER_ICONS: Record<ExtraFilter, ComponentType<{ className?: string }>> = {
  discipline: Bike,
  category: UserRound,
  level: ChartNoAxesColumnIncreasing,
  country: Globe,
  series: Trophy,
};

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
  const [seriesQuery, setSeriesQuery] = useState("");

  const state = { disciplines, categories, levels, country, series };
  const hasValue = (id: ExtraFilter) => hasExtraValue(id, state);
  const seriesName = seriesList.find((s) => s.slug === series)?.name;
  const view = seriesView(seriesList, country, locale, messages.international, seriesQuery);
  const extraMeta = describeExtras(state, seriesName, messages, locale);

  // Mobile: every extra filter is a chip (horizontal scroll). Nested
  // submenus behind “+ Filtr” are unusable on a phone.
  const pinAll = allFilters || hideSearch || wide;
  const { shown: shownExtras, menu: menuFilters } = layoutExtras({
    state,
    pinAll,
    hasMenuExtra: Boolean(menuExtra),
    hasSeries: view.visibleSeries.length > 0,
    hasCountries: view.countryCodes.length > 0,
  });

  function unpin(id: ExtraFilter) {
    if (id === "discipline" && disciplines.length) onClearDisciplines();
    if (id === "category" && categories.length) onClearCategories();
    if (id === "level" && levels.length) onClearLevels();
    if (id === "country" && country.length) onClearCountries();
    if (id === "series" && series) onSeries(series);
  }

  const renderValues = (id: ExtraFilter) => (
    <FilterValues
      id={id}
      messages={messages}
      locale={locale}
      disciplines={disciplines}
      categories={categories}
      levels={levels}
      country={country}
      countryCodes={view.countryCodes}
      seriesGroups={view.filteredGroups}
      showSeriesHeaders={view.showHeaders}
      seriesQuery={seriesQuery}
      onSeriesQuery={setSeriesQuery}
      onDiscipline={onDiscipline}
      onCategory={onCategory}
      onLevel={onLevel}
      onCountry={onCountry}
      onClearCountries={onClearCountries}
      onSeries={onSeries}
    />
  );

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
          <DateFilter
            messages={messages}
            locale={locale}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onPreset={onPreset}
          />
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
                      active && cn("rounded-r-none", ACTIVE_CHIP),
                    )}
                  >
                    <Icon />
                    <span className="max-w-[12rem] truncate">
                      {extraMeta[id].value || extraMeta[id].label}
                    </span>
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
                  className={cn("rounded-l-none max-md:size-11 [@media(pointer:coarse)]:size-11", ACTIVE_CHIP)}
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
                        <span className="ml-auto max-w-24 truncate text-xs text-muted-foreground">{extraMeta[id].value}</span>
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

      {hideSearch ? null : (
        <PlaceSearch q={q} messages={messages} onQ={onQ} onSubmit={onSearchSubmit} />
      )}
    </div>
  );
}

"use client";

import { ArrowDownUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { SeriesOption } from "@/components/explore/map-filter-bar";
import type { EventSort } from "@/lib/geo/distance";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { pluralForm } from "@/lib/i18n/plural";
import { ageCategoryLabel, disciplineLabel, raceLevelLabel } from "@/lib/i18n/taxonomy";
import { cn } from "@/lib/utils";

/** What the phone's filter row says about the query, on every view alike. */
export type ActiveFilters = {
  disciplines: string[];
  categories: string[];
  levels: string[];
  country: string[];
  series: string;
  q: string;
  radius: number | null;
};

/**
 * How many groups the Filters button counts.
 *
 * The date has a button of its own and so has the search, so neither is
 * counted here. The map used to count the date and the list did not, and the
 * same query wore a "1" on one screen and nothing on the next.
 */
export function activeFilterGroups(f: ActiveFilters): number {
  return (
    (f.disciplines.length ? 1 : 0) +
    (f.categories.length ? 1 : 0) +
    (f.levels.length ? 1 : 0) +
    (f.country.length ? 1 : 0) +
    (f.series ? 1 : 0) +
    (f.radius != null ? 1 : 0)
  );
}

export type ActiveFilterClears = {
  onClearDisciplines: () => void;
  onClearCategories: () => void;
  onClearLevels: () => void;
  onClearCountries: () => void;
  onClearSeries: () => void;
  onClearRadius: () => void;
  onClearQ: () => void;
};

/**
 * The filters in force, one chip a group, each with its own way out.
 *
 * A count on a button says that something is narrowing the list but not
 * what; these say what, and the cross takes it off without opening the
 * panel. The label opens the panel, where the group can be changed instead.
 */
export function ActiveFilterChips({
  locale,
  filters,
  seriesList,
  onOpenFilters,
  className,
  ...clear
}: {
  locale: string;
  filters: ActiveFilters;
  seriesList: SeriesOption[];
  onOpenFilters: () => void;
  className?: string;
} & ActiveFilterClears) {
  const t = messagesFor(locale);
  const join = (labels: string[]) => labels.filter(Boolean).join(", ");
  const seriesName = seriesList.find((s) => s.slug === filters.series)?.name ?? filters.series;
  const chips = [
    filters.q.trim() ? { key: "q", label: `„${filters.q.trim()}“`, clear: clear.onClearQ } : null,
    filters.disciplines.length
      ? { key: "disciplines", label: join(filters.disciplines.map((d) => disciplineLabel(d, locale))), clear: clear.onClearDisciplines }
      : null,
    filters.categories.length
      ? { key: "categories", label: join(filters.categories.map((c) => ageCategoryLabel(c, locale))), clear: clear.onClearCategories }
      : null,
    filters.levels.length
      ? { key: "levels", label: join(filters.levels.map((l) => raceLevelLabel(l, locale))), clear: clear.onClearLevels }
      : null,
    filters.country.length ? { key: "country", label: filters.country.join(", "), clear: clear.onClearCountries } : null,
    filters.series ? { key: "series", label: seriesName, clear: clear.onClearSeries } : null,
    filters.radius != null
      ? { key: "radius", label: t.distanceWithin.replace("{km}", String(filters.radius)), clear: clear.onClearRadius }
      : null,
  ].filter((c): c is { key: string; label: string; clear: () => void } => Boolean(c));

  if (chips.length === 0) return null;

  return (
    <ul
      aria-label={t.activeFilters}
      className={cn(
        "flex min-w-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain py-1.5 pr-6 pl-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      // A chip cut at the edge reads as more to come, not as a broken row.
      style={{
        maskImage: "linear-gradient(to right, black calc(100% - 20px), transparent)",
        WebkitMaskImage: "linear-gradient(to right, black calc(100% - 20px), transparent)",
      }}
    >
      {chips.map((chip) => (
        <li
          key={chip.key}
          className="flex h-9 max-w-[16rem] shrink-0 items-center rounded-full border border-foreground/15 bg-muted/60 text-sm"
        >
          <button
            type="button"
            onClick={onOpenFilters}
            className="h-full min-w-0 truncate pl-3.5 pr-1 font-medium touch-manipulation"
          >
            {chip.label}
          </button>
          <button
            type="button"
            onClick={chip.clear}
            aria-label={t.removeFilter.replace("{name}", chip.label)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground touch-manipulation active:bg-foreground/10"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "1 závod", "3 závody", "64 závodů" — the count said as a sentence would. */
export function raceCountLabel(n: number, locale: string): string {
  const t = messagesFor(locale);
  const loc = asLocale(locale);
  const abs = Math.abs(n);
  // Czech and Slovak take the "few" form for 2–4 only; 22 is "22 závodů".
  const form = loc === "cs" || loc === "sk" ? (abs === 1 ? "one" : abs >= 2 && abs <= 4 ? "few" : "many") : pluralForm(n, loc);
  const word = form === "one" ? t.racesCountOne : form === "few" ? t.racesCountFew : t.racesCount;
  return `${n} ${word}`;
}

/**
 * The count of what matched and how it is ordered: the head of every race
 * list on a phone, scrolling away with the races under it.
 */
export function ListMetaRow({
  locale,
  count,
  loading,
  sort,
  onSort,
  className,
}: {
  locale: string;
  /** `null` while the first answer is still on its way. */
  count: number | null;
  loading: boolean;
  sort: EventSort;
  onSort: (sort: EventSort) => void;
  className?: string;
}) {
  const t = messagesFor(locale);
  return (
    <div className={cn("flex h-10 shrink-0 items-center justify-between gap-2 pl-4 pr-2", className)}>
      <span
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums"
        aria-live="polite"
        aria-busy={loading}
      >
        {count == null ? <span aria-hidden className="h-3 w-20 animate-pulse rounded bg-muted" /> : raceCountLabel(count, locale)}
        <span className="inline-flex size-4 items-center justify-center" aria-hidden={!loading}>
          {loading ? <Spinner className="size-3.5" /> : null}
        </span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-10 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground touch-manipulation"
            aria-label={`${t.sortBy}: ${sort === "distance" ? t.sortByDistance : t.sortByDate}`}
          >
            <ArrowDownUp className="size-3.5" aria-hidden />
            {sort === "distance" ? t.sortDistance : t.date}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(value) => {
              if (value === "date" || value === "distance") onSort(value);
            }}
          >
            <DropdownMenuRadioItem value="date" className="min-h-11">{t.sortByDate}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="distance" className="min-h-11">{t.sortByDistance}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

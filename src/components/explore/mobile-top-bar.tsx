"use client";

import type { ReactNode } from "react";
import { ChevronDown, ListFilter, Search } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EventSort } from "@/lib/geo/distance";
import { cn } from "@/lib/utils";

const pillClass =
  "h-9 shrink-0 gap-1 rounded-full border border-border/80 bg-background px-3 text-sm font-medium text-foreground shadow-none hover:bg-muted/80";

export function MobileTopBar({
  homeHref,
  weekendLabel,
  weekendActive,
  onWeekend,
  filtersLabel,
  filterCount,
  onFilters,
  searchLabel,
  searchActive,
  onSearch,
  sort,
  sortByLabel,
  sortDateLabel,
  sortDistanceLabel,
  sortDateShort,
  sortDistanceShort,
  sortNeedsLocationLabel,
  distanceEnabled,
  onSort,
  menu,
}: {
  homeHref: string;
  weekendLabel: string;
  weekendActive: boolean;
  onWeekend: () => void;
  filtersLabel: string;
  filterCount: number;
  onFilters: () => void;
  searchLabel: string;
  searchActive: boolean;
  onSearch: () => void;
  sort: EventSort;
  sortByLabel: string;
  sortDateLabel: string;
  sortDistanceLabel: string;
  /** Short forms for the pill; the menu keeps the full wording. */
  sortDateShort: string;
  sortDistanceShort: string;
  sortNeedsLocationLabel: string;
  distanceEnabled: boolean;
  onSort: (sort: EventSort) => void;
  menu: ReactNode;
}) {
  // "Řadit dle vzdálenosti" does not fit a pill on a 375px screen — it was
  // clipped mid-word, and the search button behind it sat off-screen.
  const sortLabel = sort === "distance" ? sortDistanceShort : sortDateShort;

  return (
    <div className="flex items-center gap-2 px-3 pb-2">
      <BrandMark href={homeHref} mark="lr" size="sm" className="shrink-0 px-0.5" />
      {/*
        The strip scrolls, and a pill cut dead at the container edge reads as a
        broken layout rather than as more content. Fade the last few pixels so
        the clip is legible as "keep scrolling".
      */}
      <div
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: "linear-gradient(to right, black calc(100% - 20px), transparent)",
          WebkitMaskImage: "linear-gradient(to right, black calc(100% - 20px), transparent)",
        }}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(pillClass, weekendActive && "bg-muted")}
          aria-pressed={weekendActive}
          onClick={onWeekend}
        >
          <span className="truncate">{weekendLabel}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={pillClass}
          aria-label={filtersLabel}
          onClick={onFilters}
        >
          <ListFilter className="size-3.5" aria-hidden />
          <span>{filtersLabel}</span>
          {filterCount > 0 ? (
            <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background tabular-nums">
              {filterCount}
            </span>
          ) : null}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={pillClass}
              aria-label={sortByLabel}
            >
              <span className="truncate">{sortLabel}</span>
              <ChevronDown className="size-3.5 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => {
                if (value === "date" || value === "distance") onSort(value);
              }}
            >
              <DropdownMenuRadioItem value="date">{sortDateLabel}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="distance"
                disabled={!distanceEnabled}
                title={distanceEnabled ? undefined : sortNeedsLocationLabel}
              >
                {sortDistanceLabel}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Button
        type="button"
        variant={searchActive ? "secondary" : "outline"}
        size="icon"
        className="size-9 shrink-0 rounded-full border-border/80"
        aria-label={searchLabel}
        aria-pressed={searchActive}
        onClick={onSearch}
      >
        <Search className="size-4" aria-hidden />
      </Button>
      <div className="shrink-0">{menu}</div>
    </div>
  );
}

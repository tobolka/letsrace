"use client";

import type { ReactNode } from "react";
import { Calendar, ListFilter, Search } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  menu: ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-1 px-3 pb-2">
      <BrandMark href={homeHref} mark="lr" size="sm" className="px-1.5" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-11 min-w-0 shrink gap-1.5 rounded-full px-3",
          weekendActive && "bg-muted text-foreground",
        )}
        aria-pressed={weekendActive}
        onClick={onWeekend}
      >
        <Calendar className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{weekendLabel}</span>
      </Button>
      <Button
        type="button"
        variant={filterCount > 0 ? "secondary" : "ghost"}
        size="sm"
        className="h-11 shrink-0 gap-1.5 rounded-full px-3"
        aria-label={filtersLabel}
        onClick={onFilters}
      >
        <ListFilter className="size-4" aria-hidden />
        <span className="max-sm:hidden">{filtersLabel}</span>
        {filterCount > 0 ? (
          <span
            className={cn(
              "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
              "bg-foreground text-background",
            )}
          >
            {filterCount}
          </span>
        ) : null}
      </Button>
      <Button
        type="button"
        variant={searchActive ? "secondary" : "ghost"}
        size="icon"
        className="size-11 shrink-0 rounded-full"
        aria-label={searchLabel}
        aria-pressed={searchActive}
        onClick={onSearch}
      >
        <Search className="size-4" aria-hidden />
      </Button>
      <div className="ml-auto shrink-0">{menu}</div>
    </div>
  );
}

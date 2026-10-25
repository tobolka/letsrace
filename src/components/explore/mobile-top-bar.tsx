"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CalendarRange, ChevronDown, ListFilter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DatePresetId } from "@/lib/date-presets";
import { cn } from "@/lib/utils";

/**
 * Thirty-six points tall, and pressing one says so. These are the controls a
 * thumb uses most, in a row it reaches across; a chip that only lights up on
 * hover gives a finger nothing back at all.
 */
export const pillClass =
  "h-9 shrink-0 gap-1.5 rounded-full border border-border/80 bg-background px-3.5 text-sm font-medium text-foreground shadow-none touch-manipulation transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 hover:bg-background [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/80";

export type DateChoice = { id: DatePresetId; label: string; active: boolean; apply: () => void };

/**
 * The one row of controls every race view on a phone has: the date, the
 * filters with how many groups are on, and the search — in that order, on the
 * map, the list and the calendar alike.
 *
 * The search opens in the row itself rather than in a sheet from the bottom.
 * A field at the foot of the screen is where the keyboard comes up, and the
 * list it filters is right underneath, answering as you type.
 */
export function MobileTopBar({
  dateLabel,
  dateCustom,
  dateChoices,
  customDateLabel,
  onCustomDate,
  leading,
  filtersLabel,
  filterCount,
  onFilters,
  searchLabel,
  searchPlaceholder,
  doneLabel,
  clearLabel,
  q,
  onQ,
  onSearchSubmit,
  searchOpen,
  onSearchOpenChange,
  className,
}: {
  /** What the date pill says; without it there is no date pill. */
  dateLabel?: string;
  /** A range picked by hand rather than a quick choice. */
  dateCustom?: boolean;
  dateChoices?: DateChoice[];
  customDateLabel?: string;
  onCustomDate?: () => void;
  /** In place of the date — the calendar's month. */
  leading?: ReactNode;
  filtersLabel: string;
  filterCount: number;
  onFilters: () => void;
  searchLabel: string;
  searchPlaceholder: string;
  doneLabel: string;
  clearLabel: string;
  q: string;
  onQ: (q: string) => void;
  onSearchSubmit?: () => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);
  useKeepPageInPlace(searchOpen);

  if (searchOpen) {
    return (
      <form
        role="search"
        className={cn("flex h-13 items-center gap-2 px-4", className)}
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit?.();
          inputRef.current?.blur();
          onSearchOpenChange(false);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            name="q"
            type="search"
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label={searchLabel}
            onKeyDown={(e) => {
              if (e.key === "Escape") onSearchOpenChange(false);
            }}
            // 16px, or iOS zooms the page in on focus.
            className="h-10 w-full rounded-full border border-border/80 bg-background pr-10 pl-9 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
          />
          {q ? (
            <button
              type="button"
              className="absolute top-1/2 right-0.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground"
              aria-label={clearLabel}
              onClick={() => {
                onQ("");
                inputRef.current?.focus();
              }}
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <Button type="submit" variant="ghost" className="h-10 shrink-0 px-2.5 text-sm font-medium">
          {doneLabel}
        </Button>
      </form>
    );
  }

  return (
    <div className={cn("flex h-13 items-center gap-1.5 px-4", className)}>
      {leading}
      {dateLabel && dateChoices ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className={cn(pillClass, "min-w-0 pr-2.5")}>
              <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{dateLabel}</span>
              <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuRadioGroup
              value={dateCustom ? "" : (dateChoices.find((c) => c.active)?.id ?? "")}
              onValueChange={(id) => dateChoices.find((c) => c.id === id)?.apply()}
            >
              {dateChoices.map((choice) => (
                <DropdownMenuRadioItem key={choice.id} value={choice.id} className="min-h-11">
                  {choice.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {onCustomDate && customDateLabel ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="min-h-11" onSelect={onCustomDate}>
                  {customDateLabel}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(pillClass, filterCount > 0 && "border-foreground/30")}
        aria-label={filterCount > 0 ? `${filtersLabel} (${filterCount})` : filtersLabel}
        onClick={onFilters}
      >
        <ListFilter className="size-3.5" aria-hidden />
        <span>{filtersLabel}</span>
        {filterCount > 0 ? (
          <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white tabular-nums">
            {filterCount}
          </span>
        ) : null}
      </Button>
      <Button
        type="button"
        variant={q.trim() ? "secondary" : "outline"}
        size="icon"
        className="ml-auto size-9 shrink-0 rounded-full border-border/80 touch-manipulation transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 hover:bg-background [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/80"
        aria-label={searchLabel}
        aria-pressed={Boolean(q.trim())}
        onClick={() => onSearchOpenChange(true)}
      >
        <Search className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

/**
 * Hold the page where it is while the keyboard is up.
 *
 * The shell never scrolls the document — the views scroll inside it — but a
 * phone does, to bring a focused field above its keyboard. On the map the
 * field is focused at the foot of the screen in the same tap that raises the
 * sheet, so the browser scrolled the page up for a field that a moment later
 * sat at the top: the search ended above the screen, and the page stayed
 * shifted after the keyboard went. Any document scroll here is that one, so
 * it is undone — on focus, as the keyboard resizes the viewport, once the
 * sheet has settled, and on the way out.
 */
function useKeepPageInPlace(active: boolean) {
  useEffect(() => {
    const reset = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    };
    if (!active) {
      reset();
      return;
    }
    const viewport = window.visualViewport;
    const timers = [100, 350, 650].map((ms) => window.setTimeout(reset, ms));
    window.addEventListener("scroll", reset, { passive: true });
    viewport?.addEventListener("resize", reset);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("scroll", reset);
      viewport?.removeEventListener("resize", reset);
      reset();
    };
  }, [active]);
}

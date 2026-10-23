"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { addMonths, monthGrid, monthStart } from "@/lib/plan-month";
import { formatIsoDate, parseIsoDate } from "@/lib/planner";
import { cn } from "@/lib/utils";

export type CalendarItem = {
  id: string;
  name: string;
  startDate: string;
  endDate?: string | null;
  /** The discipline's colour — the dot. */
  color: string;
  /** One line under the name in a day's list: the place, the discipline. */
  meta?: string;
};

export type DayInfo = {
  /** A day already spoken for: busy on that weekday, or blocked by hand. */
  muted?: boolean;
  /** Shown in an empty cell — why the day is taken. */
  note?: ReactNode;
};

/** A stage race should not paint a whole month; its first days say enough. */
const MAX_SPAN_DAYS = 10;
/** How many races a cell names before it says "+2". */
const PER_CELL = 3;

type Open =
  | { kind: "item"; key: string }
  | { kind: "day"; iso: string; detailId: string | null }
  | null;

/**
 * A month of races, one calendar for the whole app.
 *
 * The schedule and the plan each had a grid of their own, drawn differently
 * and behaving differently. This is the one: a race is a coloured dot with its
 * name on the day it runs, a day with more than fits says "+N", and both open
 * floating over the grid the way a calendar app does — a race opens its card,
 * "+N" opens the day. On a phone there is no room for names, so a cell is its
 * dots and tapping it opens the day.
 *
 * What a race's card says is the caller's business (`renderDetail`): the
 * schedule shows the map's race card, the plan shows who is going.
 */
export function MonthCalendar({
  locale,
  month,
  items,
  renderDetail,
  dayInfo,
  selectedDay,
  onPickDay,
  fill = false,
  day: dayProp,
  onDay,
  onOpenItem,
  className,
}: {
  locale: string;
  /** Any date in the month being shown. */
  month: string;
  items: CalendarItem[];
  renderDetail: (id: string, close: () => void) => ReactNode;
  dayInfo?: (iso: string) => DayInfo | undefined;
  selectedDay?: string | null;
  /** Clicking a day itself — the plan uses it to block or note a day. */
  onPickDay?: (iso: string) => void;
  /** Stretch the rows to fill the height the calendar is given. */
  fill?: boolean;
  /**
   * The day whose races are listed under the month on a phone, when the
   * caller keeps it (the schedule keeps it in the address).
   */
  day?: string | null;
  onDay?: (iso: string) => void;
  /**
   * A race tapped in that list, when the caller opens it itself — the
   * schedule's sheet. Without it the card replaces the list in place.
   */
  onOpenItem?: (id: string) => void;
  className?: string;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState<Open>(null);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const days = weeks.flat();
  const headings = weeks[0]!.map((d) => format(parseISO(d.iso), "EEEEEE", { locale: df }));

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const first = days[0]!.iso;
    const last = days[days.length - 1]!.iso;
    for (const item of items) {
      const start = parseIsoDate(item.startDate);
      const end = item.endDate ? parseIsoDate(item.endDate) : start;
      const cursor = new Date(start);
      for (let n = 0; cursor <= end && n < MAX_SPAN_DAYS; n++) {
        const iso = formatIsoDate(cursor);
        if (iso >= first && iso <= last) {
          const list = map.get(iso);
          if (list) list.push(item);
          else map.set(iso, [item]);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [items, days]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const close = () => setOpen(null);

  // On a phone the day's races are listed under the month, not in a popover
  // that has no room: today when it is in this month, else the first day with races.
  const [ownDay, setOwnDay] = useState<string | null>(null);
  const phoneDay = dayProp !== undefined ? dayProp : ownDay;
  const [phoneDetail, setPhoneDetail] = useState<string | null>(null);
  const today = days.find((d) => d.isToday && d.inMonth)?.iso;
  const firstWithRaces = days.find((d) => d.inMonth && (byDay.get(d.iso)?.length ?? 0) > 0)?.iso;
  // A month with nothing in it still says so under the grid, rather than ending
  // at the grid and leaving the reader to wonder whether it is still loading.
  const firstInMonth = days.find((d) => d.inMonth)?.iso ?? null;
  const activeDay = phoneDay && days.some((d) => d.iso === phoneDay) ? phoneDay : (today ?? firstWithRaces ?? firstInMonth);

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col", fill && "flex-1", className)}>
      <div className="grid shrink-0 grid-cols-7 border-b">
        {headings.map((label, i) => (
          <div
            key={label + i}
            className={cn(
              "px-2 py-1.5 text-[11px] font-medium tracking-wide uppercase max-md:text-center",
              i >= 5 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className={cn("grid min-w-0 shrink-0 grid-cols-7", fill && !isMobile && "flex-1 auto-rows-[minmax(7rem,1fr)]")}>
        {days.map((day, i) => {
          const list = byDay.get(day.iso) ?? [];
          const info = dayInfo?.(day.iso);
          const dayOpen = open?.kind === "day" && open.iso === day.iso;
          const shown = isMobile ? [] : list.slice(0, PER_CELL);
          const extra = list.length - shown.length;
          const openDay = () => setOpen({ kind: "day", iso: day.iso, detailId: null });

          if (isMobile) {
            const picked = day.iso === activeDay;
            return (
              <button
                key={day.iso}
                type="button"
                role="gridcell"
                aria-selected={picked}
                aria-label={format(parseISO(day.iso), "PPPP", { locale: df })}
                onClick={() => {
                  onPickDay?.(day.iso);
                  if (onDay) onDay(day.iso);
                  else setOwnDay(day.iso);
                  setPhoneDetail(null);
                }}
                className={cn(
                  // 44 points: as tall as a finger needs and no taller, so a
                  // six-week month leaves the day's races on screen.
                  "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 border-r border-b py-1 transition-colors",
                  i % 7 === 6 && "border-r-0",
                  !day.inMonth && "bg-muted/40",
                  day.isWeekend && day.inMonth && "bg-muted/25",
                  info?.muted && "bg-muted/60",
                  (picked || day.iso === selectedDay) && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    !day.inMonth && "text-muted-foreground",
                    day.isToday && "bg-brand font-semibold text-white",
                    picked && !day.isToday && "bg-foreground font-semibold text-background",
                  )}
                >
                  {day.day}
                </span>
                {list.length > 0 ? (
                  <span className="text-[10px] leading-none font-medium tabular-nums text-muted-foreground">{list.length}</span>
                ) : null}
              </button>
            );
          }

          return (
            <Popover key={day.iso} open={dayOpen} onOpenChange={(next) => !next && close()}>
              <PopoverAnchor asChild>
                <div
                  role="gridcell"
                  onClick={() => {
                    onPickDay?.(day.iso);
                    if (isMobile && list.length > 0) openDay();
                  }}
                  className={cn(
                    "flex min-w-0 flex-col gap-0.5 overflow-hidden border-r border-b p-1 transition-colors",
                    fill ? "min-h-24" : "min-h-24 max-md:min-h-14",
                    i % 7 === 6 && "border-r-0",
                    i >= days.length - 7 && "border-b-0",
                    !day.inMonth && "bg-muted/40",
                    day.isWeekend && day.inMonth && "bg-muted/25",
                    info?.muted && "bg-muted/60",
                    (onPickDay || isMobile) && "cursor-pointer hover:bg-accent/40",
                    (day.iso === selectedDay || dayOpen) && "bg-accent/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (list.length > 0) openDay();
                      else onPickDay?.(day.iso);
                    }}
                    aria-label={format(parseISO(day.iso), "PPPP", { locale: df })}
                    aria-current={day.isToday ? "date" : undefined}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs tabular-nums transition-colors hover:bg-accent max-md:self-center md:self-start",
                      !day.inMonth && "text-muted-foreground",
                      day.isToday && "bg-brand font-semibold text-white hover:bg-brand/90",
                    )}
                  >
                    {day.day}
                  </button>

                  {isMobile && list.length > 0 ? (
                    <span className="flex flex-wrap justify-center gap-0.5 px-0.5" aria-hidden>
                      {list.slice(0, 6).map((item) => (
                        <span key={item.id} className="size-1.5 rounded-full" style={{ background: item.color }} />
                      ))}
                    </span>
                  ) : null}

                  {shown.map((item) => {
                    const key = `${day.iso}:${item.id}`;
                    const itemOpen = open?.kind === "item" && open.key === key;
                    return (
                      <Popover
                        key={item.id}
                        open={itemOpen}
                        onOpenChange={(next) => setOpen(next ? { kind: "item", key } : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            title={item.name}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-xs leading-tight transition-colors hover:bg-accent",
                              itemOpen && "bg-accent",
                            )}
                          >
                            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: item.color }} />
                            <span className="truncate">{item.name}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          side="right"
                          align="start"
                          collisionPadding={12}
                          className="w-auto overflow-hidden p-0"
                        >
                          {renderDetail(item.id, close)}
                        </PopoverContent>
                      </Popover>
                    );
                  })}

                  {extra > 0 && !isMobile ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDay();
                      }}
                      className="w-fit rounded-md px-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      +{extra} {t.scheduleMore}
                    </button>
                  ) : null}

                  {list.length === 0 && info?.note && !isMobile ? (
                    <span className="truncate px-1 text-[11px] text-muted-foreground">{info.note}</span>
                  ) : null}
                </div>
              </PopoverAnchor>

              <PopoverContent
                align="start"
                side={isMobile ? "bottom" : "right"}
                collisionPadding={12}
                className="w-auto overflow-hidden p-0"
                onClick={(e) => e.stopPropagation()}
              >
                {dayOpen && open.detailId && byId.has(open.detailId) ? (
                  <div className="flex flex-col">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="m-1 w-fit capitalize text-muted-foreground"
                      onClick={() => setOpen({ kind: "day", iso: day.iso, detailId: null })}
                    >
                      <ChevronLeft data-icon="inline-start" />
                      {format(parseISO(day.iso), "EEEE d. MMMM", { locale: df })}
                    </Button>
                    {renderDetail(open.detailId, close)}
                  </div>
                ) : (
                  <DayList
                    iso={day.iso}
                    locale={locale}
                    items={list}
                    onPick={(id) => setOpen({ kind: "day", iso: day.iso, detailId: id })}
                  />
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {isMobile && activeDay ? (
        <div className="flex flex-col border-t">
          {phoneDetail && byId.has(phoneDetail) ? (
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="m-1 w-fit capitalize text-muted-foreground"
                onClick={() => setPhoneDetail(null)}
              >
                <ChevronLeft data-icon="inline-start" />
                {format(parseISO(activeDay), "EEEE d. MMMM", { locale: df })}
              </Button>
              {renderDetail(phoneDetail, () => setPhoneDetail(null))}
            </div>
          ) : (
            <>
              {/* Stays in view while the day's races scroll under it. */}
              <div className="sticky top-0 z-10 border-b bg-background px-4 py-2.5 text-sm font-semibold first-letter:uppercase">
                {format(parseISO(activeDay), "EEEE d. MMMM", { locale: df })}
                <span className="ml-2 font-normal text-muted-foreground tabular-nums">{byDay.get(activeDay)?.length ?? 0}</span>
              </div>
              {(byDay.get(activeDay) ?? []).length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">{t.scheduleEmptyDay}</p>
              ) : (
                <ul className="flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {(byDay.get(activeDay) ?? []).map((item) => (
                    <li key={item.id} className="border-b border-border/50 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => (onOpenItem ? onOpenItem(item.id) : setPhoneDetail(item.id))}
                        className="relative flex min-h-12 w-full min-w-0 items-center px-4 py-1.5 text-left transition-colors active:bg-accent"
                      >
                        {/* The list's own rule, so a race reads the same here and there. */}
                        <span aria-hidden className="absolute inset-y-2 left-1.5 w-[3px] rounded-full" style={{ background: item.color }} />
                        <span className="min-w-0">
                          <span className="line-clamp-2 block text-sm leading-snug font-medium break-words">{item.name}</span>
                          {item.meta ? <span className="block truncate text-xs text-muted-foreground">{item.meta}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** One day, every race on it — what "+3" opens, the way a calendar app does. */
function DayList({
  iso,
  locale,
  items,
  onPick,
}: {
  iso: string;
  locale: string;
  items: CalendarItem[];
  onPick: (id: string) => void;
}) {
  const df = dateFnsLocale(locale);
  const date = parseISO(iso);
  return (
    <div className="flex w-[min(20rem,calc(100vw-2rem))] flex-col">
      <div className="flex flex-col items-center gap-0.5 border-b px-4 py-3">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {format(date, "EEEE", { locale: df })}
        </span>
        <span className="text-2xl font-semibold tabular-nums">{format(date, "d", { locale: df })}</span>
      </div>
      <ul className="max-h-[min(60dvh,24rem)] overflow-y-auto p-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onPick(item.id)}
              className="flex w-full min-w-0 items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
            >
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                {item.meta ? <span className="block truncate text-xs text-muted-foreground">{item.meta}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The month's name and the way to the next one, for above a `MonthCalendar`. */
export function MonthToolbar({
  locale,
  month,
  onMonth,
  busy,
  children,
}: {
  locale: string;
  month: string;
  onMonth: (month: string) => void;
  busy?: ReactNode;
  /** Anything else for the row, at its end. */
  children?: ReactNode;
}) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const current = monthStart(formatIsoDate(new Date()));
  // The months as pills in a row that scrolls sideways: the season at a
  // glance, and any month one tap away instead of a click per month.
  const selected = monthStart(month);
  const months = useMemo(() => {
    const list: string[] = [];
    for (let i = -1; i <= 12; i++) list.push(addMonths(current, i));
    if (!list.includes(selected)) {
      list.push(selected);
      list.sort();
    }
    return list;
  }, [current, selected]);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rowRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selected]);

  return (
    <div className="flex shrink-0 items-center gap-2 border-b py-2">
      <div
        ref={rowRef}
        role="tablist"
        aria-label={t.navSchedule}
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain px-4 [-ms-overflow-style:none] [scrollbar-width:none] md:px-6 [&::-webkit-scrollbar]:hidden"
        // Both edges fade, so a pill under the edge reads as "more this way",
        // not as a row cut off.
        style={{
          maskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 24px), transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 24px), transparent)",
        }}
      >
        {months.map((m) => {
          const d = parseISO(m);
          const active = m === selected;
          const label = format(d, d.getFullYear() === new Date().getFullYear() ? "LLLL" : "LLLL yyyy", { locale: df });
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={active}
              aria-current={active ? "true" : undefined}
              onClick={() => onMonth(m)}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap first-letter:uppercase transition-colors touch-manipulation",
                active ? "border-foreground bg-foreground text-background" : "border-border/80 bg-background hover:bg-muted/80",
                m === current && !active && "border-foreground/40",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {busy}
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}

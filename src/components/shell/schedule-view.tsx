"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { EventCard } from "@/components/explore/event-rows";
import { ExploreFilterBar } from "@/components/shell/explore-filter-bar";
import { RacePreview } from "@/components/shell/race-preview";
import { SectionHeader } from "@/components/shell/section-header";
import { useExploreFilters } from "@/components/shell/use-explore-filters";
import { useRaceFeed } from "@/components/shell/use-race-feed";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { EventListItem } from "@/lib/events";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { messagesFor } from "@/lib/i18n/messages";
import { disciplineColor } from "@/lib/map-visuals";
import { cn } from "@/lib/utils";

const ISO = "yyyy-MM-dd";
const WEEK = { weekStartsOn: 1 } as const;
/** A stage race should not paint a whole month; the first days say enough. */
const MAX_SPAN_DAYS = 10;
const CHIPS_PER_DAY = 3;

function monthKey(d: Date) {
  return format(d, "yyyy-MM");
}

/** `2026-09` → the first of that month, or the current month for anything else. */
function parseMonth(raw: string): Date {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? parseISO(`${raw}-01`) : startOfMonth(new Date());
}

/**
 * The season as a month at a time.
 *
 * The date is chosen here by moving through months, so the filter row has no
 * date control; everything else in it is the same filters the map and the list
 * use. A race that runs over several days appears on each of them. On a phone
 * there is no room for a grid, so the same races are an agenda of the days that
 * have any.
 */
export function ScheduleView({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const state = useExploreFilters();
  const { filters, setFilters, ready } = state;
  const [monthRaw, setMonthRaw] = useQueryState("month", parseAsString.withDefault(monthKey(new Date())));
  const month = parseMonth(monthRaw);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusDay, setFocusDay] = useState<string | null>(null);

  const gridStart = startOfWeek(startOfMonth(month), WEEK);
  const gridEnd = endOfWeek(endOfMonth(month), WEEK);
  const feed = useRaceFeed(
    { ...filters, dateFrom: format(gridStart, ISO), dateTo: format(gridEnd, ISO) },
    ready,
  );

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) out.push(d);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthRaw]);

  const byDay = useMemo(() => {
    const map = new Map<string, EventListItem[]>();
    const first = format(gridStart, ISO);
    const last = format(gridEnd, ISO);
    for (const event of feed.events) {
      const start = parseISO(event.startDate);
      const end = event.endDate ? parseISO(event.endDate) : start;
      const stop = addDays(start, MAX_SPAN_DAYS - 1);
      for (let d = start; d <= end && d <= stop; d = addDays(d, 1)) {
        const key = format(d, ISO);
        if (key < first || key > last) continue;
        const list = map.get(key);
        if (list) list.push(event);
        else map.set(key, [event]);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.events, monthRaw]);

  const selected = useMemo(
    () => feed.events.find((e) => e.id === selectedId) ?? null,
    [feed.events, selectedId],
  );
  const dayEvents = focusDay ? (byDay.get(focusDay) ?? []) : [];
  const agendaDays = days.filter((d) => isSameMonth(d, month) && byDay.has(format(d, ISO)));
  const today = format(new Date(), ISO);
  const label = format(month, "LLLL yyyy", { locale: df });
  const title = label.charAt(0).toUpperCase() + label.slice(1);
  const monthHasRaces = agendaDays.length > 0;

  function go(next: Date) {
    setFocusDay(null);
    void setMonthRaw(monthKey(next) === monthKey(new Date()) ? null : monthKey(next));
  }

  return (
    <div className="absolute inset-0 flex">
      <section className="flex min-w-0 flex-1 flex-col">
        <SectionHeader locale={locale} title={t.navSchedule}>
          <ExploreFilterBar locale={locale} state={state} hideDate />
        </SectionHeader>

        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 md:px-6">
          <h2 className="min-w-0 truncate text-sm font-semibold tabular-nums" aria-live="polite">
            {title}
          </h2>
          <span className="inline-flex size-4 items-center justify-center" aria-hidden={!feed.loading}>
            {feed.loading ? <Spinner className="size-3.5" /> : null}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => go(startOfMonth(new Date()))}>
              {t.scheduleToday}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t.schedulePrevMonth}
              onClick={() => go(addMonths(month, -1))}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t.scheduleNextMonth}
              onClick={() => go(addMonths(month, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        {/* Desktop: the month as a grid. */}
        <div
          className={cn(
            "hidden min-h-0 flex-1 flex-col overflow-y-auto transition-opacity md:flex",
            feed.loading && "opacity-60",
          )}
        >
          <div className="sticky top-0 z-10 grid shrink-0 grid-cols-7 border-b bg-background text-xs text-muted-foreground">
            {days.slice(0, 7).map((d) => (
              <div key={d.getDay()} className="px-2 py-1.5 font-medium capitalize">
                {format(d, "EEE", { locale: df })}
              </div>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-fr grid-cols-7">
            {days.map((d) => {
              const key = format(d, ISO);
              const list = byDay.get(key) ?? [];
              const inMonth = isSameMonth(d, month);
              const extra = list.length - CHIPS_PER_DAY;
              return (
                <div
                  key={key}
                  className={cn(
                    "flex min-h-28 min-w-0 flex-col gap-0.5 border-b border-r p-1 last:border-r-0",
                    !inMonth && "bg-muted/40",
                    focusDay === key && "bg-accent/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setFocusDay(focusDay === key ? null : key)}
                    aria-label={format(d, "PPPP", { locale: df })}
                    className={cn(
                      "flex size-6 items-center justify-center self-start rounded-full text-xs tabular-nums transition-colors hover:bg-accent",
                      !inMonth && "text-muted-foreground",
                      key === today && "bg-brand font-medium text-white hover:bg-brand/90",
                    )}
                  >
                    {d.getDate()}
                  </button>
                  {list.slice(0, CHIPS_PER_DAY).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      data-event-id={event.id}
                      onClick={() => {
                        setSelectedId(event.id);
                        setFocusDay(null);
                      }}
                      title={event.name}
                      className={cn(
                        "min-w-0 truncate rounded-sm border-l-[3px] bg-muted/60 px-1.5 py-0.5 text-left text-xs leading-snug transition-colors hover:bg-muted",
                        event.id === selectedId && "bg-muted ring-1 ring-foreground/30",
                      )}
                      style={{ borderLeftColor: disciplineColor(event.disciplines) }}
                    >
                      {event.name}
                    </button>
                  ))}
                  {extra > 0 ? (
                    <button
                      type="button"
                      onClick={() => setFocusDay(key)}
                      className="self-start rounded-sm px-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      +{extra} {t.scheduleMore}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Phone: the same races as an agenda of the days that have any. */}
        <div className={cn("min-h-0 flex-1 overflow-y-auto md:hidden", feed.loading && "opacity-60")}>
          {feed.settled && !monthHasRaces ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t.scheduleNoRaces}</p>
          ) : null}
          {agendaDays.map((d) => {
            const key = format(d, ISO);
            return (
              <section key={key}>
                <h3
                  className={cn(
                    "sticky top-0 z-10 border-b bg-muted/80 px-4 py-1.5 text-xs font-medium backdrop-blur",
                    key === today && "text-brand",
                  )}
                >
                  {format(d, "EEEE d. MMMM", { locale: df })}
                </h3>
                {(byDay.get(key) ?? []).map((event) => (
                  <div key={event.id} className="border-b border-border/50">
                    <EventCard
                      event={event}
                      locale={locale}
                      active={event.id === selectedId}
                      onSelect={setSelectedId}
                    />
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </section>

      {selected ? (
        <RacePreview
          event={selected}
          locale={locale}
          onClose={() => setSelectedId(null)}
          onSelectSeries={(slug) => {
            setSelectedId(null);
            void setFilters({ series: slug });
          }}
        />
      ) : focusDay ? (
        <aside className="hidden w-[340px] shrink-0 flex-col border-l bg-card md:flex">
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
            <h3 className="truncate text-sm font-semibold capitalize">
              {format(parseISO(focusDay), "EEEE d. MMMM", { locale: df })}
            </h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFocusDay(null)}>
              {t.close}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {dayEvents.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t.noResults}</p>
            ) : (
              dayEvents.map((event) => (
                <div key={event.id} className="border-b border-border/50">
                  <EventCard event={event} locale={locale} active={false} onSelect={setSelectedId} />
                </div>
              ))
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

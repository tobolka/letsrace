"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { EventDetailPanel, loadEventDetailPanel } from "@/components/explore/event-detail-lazy";
import { MonthCalendar, MonthToolbar, type CalendarItem } from "@/components/calendar/month-calendar";
import { ExploreActiveChips, ExploreFilterBar } from "@/components/shell/explore-filter-bar";
import { RaceCount } from "@/components/shell/race-count";
import { RacePreview } from "@/components/shell/race-preview";
import { SectionHeader } from "@/components/shell/section-header";
import { SubscribeFeed } from "@/components/calendar/subscribe-feed";
import { useExploreFilters } from "@/components/shell/use-explore-filters";
import { useLinkedRace, useRaceParam } from "@/components/shell/use-race-param";
import { useResultsAnalytics } from "@/components/analytics/use-results-analytics";
import { useRaceFeed } from "@/components/shell/use-race-feed";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { messagesFor } from "@/lib/i18n/messages";
import { disciplineColor } from "@/lib/map-visuals";
import { addMonths, monthGrid, monthStart } from "@/lib/plan-month";
import { todayIso } from "@/lib/date-presets";
import { cn } from "@/lib/utils";

/** `2026-09` → `2026-09-01`, or this month for anything else. */
function parseMonth(raw: string): string {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? `${raw}-01` : monthStart(todayIso());
}

/**
 * The season a month at a time.
 *
 * The month on show and the day picked in it are where you are looking, not
 * a filter: they live in the address as `month` and `day`, apart from the
 * date range the map and the list filter by, and the filter row here has no
 * date control at all. Everything else in it is the same filters the map and
 * the list use. A race opens the map's own race card — floating over the
 * grid on a desktop, a sheet over the page on a phone.
 */
export function ScheduleView({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const df = dateFnsLocale(locale);
  const state = useExploreFilters();
  const { filters, setFilters, ready, near } = state;
  const isMobile = useIsMobile();
  // The race card's code is fetched while the view is idle, so the first
  // click finds it already here.
  useEffect(() => {
    void loadEventDetailPanel();
  }, []);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [monthRaw, setMonthRaw] = useQueryState("month", parseAsString.withDefault(""));
  const [dayRaw, setDayRaw] = useQueryState("day", parseAsString.withDefault(""));
  const month = parseMonth(monthRaw);
  const race = useRaceParam();

  const weeks = useMemo(() => monthGrid(month), [month]);
  const first = weeks[0]![0]!.iso;
  const last = weeks[weeks.length - 1]![6]!.iso;
  const feed = useRaceFeed({ ...filters, dateFrom: first, dateTo: last }, ready, near);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayRaw) && dayRaw >= first && dayRaw <= last ? dayRaw : null;

  const items: CalendarItem[] = useMemo(
    () =>
      feed.events.map((e) => ({
        id: e.id,
        name: e.name,
        startDate: e.startDate,
        endDate: e.endDate,
        color: disciplineColor(e.disciplines),
        meta: [
          e.location?.municipality || e.location?.name,
          e.location?.countryCode,
          e.disciplines.map((d) => disciplineLabel(d, locale)).filter(Boolean).join(", "),
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [feed.events, locale],
  );
  const byId = useMemo(() => new Map(feed.events.map((e) => [e.id, e])), [feed.events]);
  const selected = useLinkedRace(race.slug, feed.events);
  const inMonth = feed.events.filter((e) => e.startDate.slice(0, 7) === month.slice(0, 7)).length;

  useResultsAnalytics({ query: { ...filters, dateFrom: first, dateTo: last }, count: feed.events.length, ready: ready && feed.settled && !feed.loading, failed: feed.failed, scope: near ? "radius" : "global", radius: state.radius });

  function goMonth(next: string) {
    void setMonthRaw(next === monthStart(todayIso()) ? null : next.slice(0, 7));
    void setDayRaw(null);
  }

  const monthLabel = format(
    parseISO(month),
    parseISO(month).getFullYear() === new Date().getFullYear() ? "LLLL" : "LLLL yyyy",
    { locale: df },
  );

  // On a phone the month and its arrows are the start of the filter row: one
  // bar where there used to be the logo, the filters and a row of months.
  const monthNav = (
    <div className="mr-auto flex min-w-0 items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 rounded-full"
        aria-label={t.previousMonth}
        onClick={() => goMonth(addMonths(month, -1))}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <h2 className="min-w-0 truncate px-0.5 text-base font-semibold first-letter:uppercase" aria-live="polite">
        {monthLabel}
      </h2>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 rounded-full"
        aria-label={t.followingMonth}
        onClick={() => goMonth(addMonths(month, 1))}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );

  return (
    <div className="absolute inset-0 flex min-w-0 flex-col overflow-hidden">
      <SectionHeader title={t.navSchedule} brandHref={`/${locale}`}>
        <ExploreFilterBar
          locale={locale}
          state={state}
          hideDate
          leading={monthNav}
          filtersOpen={filtersOpen}
          onFiltersOpenChange={setFiltersOpen}
          resultCount={feed.settled ? inMonth : null}
        />
      </SectionHeader>

      {isMobile ? null : (
        <MonthToolbar
          locale={locale}
          month={month}
          onMonth={goMonth}
          busy={
            <span className="inline-flex size-4 items-center justify-center" aria-hidden={!feed.loading}>
              {feed.loading ? <Spinner className="size-3.5" /> : null}
            </span>
          }
        >
          <SubscribeFeed locale={locale} filters={filters} />
        </MonthToolbar>
      )}

      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-scroll overscroll-contain transition-opacity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", feed.loading && "opacity-60")}>
        {isMobile ? (
          // What narrows the month, and the way to take it home — scrolling
          // away with the month under it.
          <div className="shrink-0 border-b">
            <ExploreActiveChips locale={locale} state={state} onOpenFilters={() => setFiltersOpen(true)} className="pb-0" />
            <div className="flex h-10 items-center justify-between gap-2 pr-2 pl-4">
              <RaceCount count={feed.settled ? inMonth : null} locale={locale} loading={feed.loading} />
              <SubscribeFeed locale={locale} filters={filters} />
            </div>
          </div>
        ) : null}
        <MonthCalendar
          locale={locale}
          month={month}
          items={items}
          fill
          day={isMobile ? day : undefined}
          onDay={(iso) => void setDayRaw(iso)}
          onOpenItem={(id) => {
            const slug = byId.get(id)?.slug;
            if (slug) race.open(slug);
          }}
          renderDetail={(id, close) => {
            const event = byId.get(id);
            if (!event) return null;
            return (
              <Suspense fallback={null}>
                <EventDetailPanel
                  event={event}
                  locale={locale}
                  anchored
                  onClose={close}
                  onSelectSeries={(slug) => {
                    close();
                    void setFilters({ series: slug });
                  }}
                />
              </Suspense>
            );
          }}
        />
      </div>

      {/* A phone's race, and a desktop's linked one (`?e=`) — the grid's own
          popovers open everything else there. */}
      {isMobile || race.slug ? (
        <RacePreview
          event={selected}
          locale={locale}
          onClose={race.close}
          onSelectSeries={(slug) => {
            race.drop();
            void setFilters({ series: slug });
          }}
        />
      ) : null}
    </div>
  );
}

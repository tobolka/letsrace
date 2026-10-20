"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { parseAsString, useQueryState } from "nuqs";
import { MonthCalendar, MonthToolbar, type CalendarItem } from "@/components/calendar/month-calendar";
import { ExploreFilterBar } from "@/components/shell/explore-filter-bar";
import { SectionHeader } from "@/components/shell/section-header";
import { SubscribeFeed } from "@/components/calendar/subscribe-feed";
import { useExploreFilters } from "@/components/shell/use-explore-filters";
import { useRaceFeed } from "@/components/shell/use-race-feed";
import { Spinner } from "@/components/ui/spinner";
import { disciplineLabel } from "@/lib/i18n/taxonomy";
import { messagesFor } from "@/lib/i18n/messages";
import { disciplineColor } from "@/lib/map-visuals";
import { monthGrid, monthStart } from "@/lib/plan-month";
import { todayIso } from "@/lib/date-presets";
import { cn } from "@/lib/utils";

const EventDetailPanel = dynamic(() =>
  import("@/components/explore/event-detail-panel").then((m) => ({ default: m.EventDetailPanel })),
);

/** `2026-09` → `2026-09-01`, or this month for anything else. */
function parseMonth(raw: string): string {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? `${raw}-01` : monthStart(todayIso());
}

/**
 * The season a month at a time.
 *
 * The date is chosen here by moving through months, so the filter row has no
 * date control; everything else in it is the same filters the map and the
 * list use. A race opens the map's own race card, floating over the grid.
 */
export function ScheduleView({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const state = useExploreFilters();
  const { filters, setFilters, ready, near } = state;
  const [monthRaw, setMonthRaw] = useQueryState("month", parseAsString.withDefault(""));
  const month = parseMonth(monthRaw);

  const weeks = useMemo(() => monthGrid(month), [month]);
  const first = weeks[0]![0]!.iso;
  const last = weeks[weeks.length - 1]![6]!.iso;
  const feed = useRaceFeed({ ...filters, dateFrom: first, dateTo: last }, ready, near);

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

  return (
    <div className="absolute inset-0 flex min-w-0 flex-col overflow-hidden">
      <SectionHeader title={t.navSchedule} brandHref={`/${locale}`}>
        <ExploreFilterBar locale={locale} state={state} hideDate />
      </SectionHeader>

      <MonthToolbar
        locale={locale}
        month={month}
        onMonth={(next) => void setMonthRaw(next === monthStart(todayIso()) ? null : next.slice(0, 7))}
        busy={
          <span className="inline-flex size-4 items-center justify-center" aria-hidden={!feed.loading}>
            {feed.loading ? <Spinner className="size-3.5" /> : null}
          </span>
        }
      >
        <SubscribeFeed locale={locale} filters={filters} />
      </MonthToolbar>

      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-scroll overscroll-contain transition-opacity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", feed.loading && "opacity-60")}>
        <MonthCalendar
          locale={locale}
          month={month}
          items={items}
          fill
          renderDetail={(id, close) => {
            const event = byId.get(id);
            if (!event) return null;
            return (
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
            );
          }}
        />
      </div>
    </div>
  );
}

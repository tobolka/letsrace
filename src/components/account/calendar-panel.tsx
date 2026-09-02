"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { format, parseISO } from "date-fns";
import { CalendarDays, List, MapPin } from "lucide-react";
import { AuthForm } from "@/components/account/auth-form";
import { PlanSetup } from "@/components/account/plan-setup";
import { PlanStats } from "@/components/account/plan-stats";
import { WeekendBoard } from "@/components/account/weekend-board";
import { SeriesProgressCard } from "@/components/account/series-progress-card";
import type { PickedPlace } from "@/components/account/place-picker";
import { PlanRaceCard } from "@/components/account/plan-race-card";
import { PlanCardList } from "@/components/account/plan-card-list";
import { PlanTable } from "@/components/account/plan-table";
import { FreeWeekendSuggestions } from "@/components/account/free-weekend-suggestions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { todayIso } from "@/lib/date-presets";
import { pluralize } from "@/lib/i18n/plural";
import { buildSeriesProgress, type SeriesProgress, type SeriesRound } from "@/lib/plan-series";
import { ALERT_RADIUS_DEFAULT } from "@/lib/race-alerts";
import { isBusyIsoDate, parseWeekdays, toJsDayOfWeek } from "@/lib/plan-prefs";
import {
  buildWeekendBoard,
  countFreeWeekends,
  currentWeekendPlans,
  formatIsoDate,
  mergeEventPlans,
  planNeedsAction,
  plansOnIsoDate,
  raceDatesFromPlans,
  saturdayOfRaceWeekend,
  type PlanMemberStatus,
  type PlannerEvent,
  type PlannerMember,
} from "@/lib/planner";
import {
  ensureFavorite,
  removeFromPlan,
  setMemberPlanStatus,
  type AttendanceRecord,
} from "@/lib/planner-db";
import type { SuggestionContext } from "@/lib/plan-suggestions";

const EVENT_EMBED =
  "id, name, start_date, end_date, slug, level, class_label, disciplines, series_id, registration_url, website_url, location:locations(name, municipality, country_code)";

type EventEmbed = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  slug: string;
  level: string | null;
  class_label: string | null;
  disciplines: string[] | null;
  series_id: string | null;
  registration_url: string | null;
  website_url: string | null;
  location:
    | { name: string | null; municipality: string | null; country_code: string | null }
    | { name: string | null; municipality: string | null; country_code: string | null }[]
    | null;
};

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function toPlannerEvent(row: EventEmbed): PlannerEvent {
  const loc = unwrap(row.location);
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    slug: row.slug,
    level: row.level,
    classLabel: row.class_label,
    disciplines: row.disciplines ?? [],
    place: loc?.municipality || loc?.name || null,
    countryCode: loc?.country_code ?? null,
    registrationUrl: row.registration_url,
    websiteUrl: row.website_url,
    seriesId: row.series_id,
  };
}

const FILTERS = ["all", "weekend", "action"] as const;
type Filter = (typeof FILTERS)[number];
const VIEWS = ["calendar", "list"] as const;

export function CalendarPanel({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const loc = asLocale(locale);
  const [view, setView] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("list"));
  const [filter, setFilter] = useQueryState(
    "filter",
    parseAsStringLiteral(FILTERS).withDefault("all"),
  );
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<PlannerMember[]>([]);
  const [eventsById, setEventsById] = useState<Record<string, PlannerEvent>>({});
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [attendanceByEvent, setAttendanceByEvent] = useState<Record<string, AttendanceRecord[]>>(
    {},
  );
  const [busyWeekdays, setBusyWeekdays] = useState<number[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [suggestCtx, setSuggestCtx] = useState<SuggestionContext | null>(null);
  const [series, setSeries] = useState<SeriesProgress[]>([]);
  const [pickedSaturday, setPickedSaturday] = useState<string | null>(null);

  async function load() {
    const supabase = createBrowserSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setAuthed(false);
      setReady(true);
      return;
    }
    setAuthed(true);
    setUserId(auth.user.id);

    const [{ data: mems }, { data: att }, { data: favs }, { data: prefs }] = await Promise.all([
      supabase
        .from("family_members")
        .select("id, name, relationship, is_self")
        .eq("user_id", auth.user.id)
        .order("created_at"),
      supabase
        .from("event_attendance")
        .select(`member_id, status, registered, paid, event:events(${EVENT_EMBED})`)
        .eq("user_id", auth.user.id),
      supabase.from("event_favorites").select(`event:events(${EVENT_EMBED})`).eq("user_id", auth.user.id),
      supabase.from("profiles").select("busy_weekdays").eq("id", auth.user.id).maybeSingle(),
    ]);

    const nextEvents: Record<string, PlannerEvent> = {};
    const nextAtt: Record<string, AttendanceRecord[]> = {};
    const nextFavs: string[] = [];

    for (const row of (att ?? []) as unknown as {
      member_id: string;
      status: string;
      registered: boolean;
      paid: boolean;
      event: EventEmbed | EventEmbed[] | null;
    }[]) {
      const ev = unwrap(row.event);
      if (!ev) continue;
      nextEvents[ev.id] = toPlannerEvent(ev);
      nextAtt[ev.id] = [
        ...(nextAtt[ev.id] ?? []),
        {
          member_id: row.member_id,
          status: row.status,
          registered: Boolean(row.registered),
          paid: Boolean(row.paid),
        },
      ];
    }

    for (const row of (favs ?? []) as unknown as {
      event: EventEmbed | EventEmbed[] | null;
    }[]) {
      const ev = unwrap(row.event);
      if (!ev) continue;
      nextEvents[ev.id] = toPlannerEvent(ev);
      nextFavs.push(ev.id);
    }

    setMembers(
      (mems ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        relationship: m.relationship,
        isSelf: Boolean(m.is_self),
      })),
    );
    setEventsById(nextEvents);
    setFavoriteIds(nextFavs);
    setAttendanceByEvent(nextAtt);
    setBusyWeekdays(parseWeekdays(prefs?.busy_weekdays));

    // What the ranker needs: where they said they are, and what they have
    // actually ridden — series to continue and disciplines they turn up for.
    const [{ data: alertRows }, { data: ridden }] = await Promise.all([
      supabase
        .from("race_alerts")
        .select("id, lat, lng, radius_km")
        .eq("user_id", auth.user.id)
        .eq("enabled", true),
      supabase
        .from("event_attendance")
        .select("event:events(series_id, disciplines)")
        .eq("user_id", auth.user.id),
    ]);
    const home = (alertRows ?? []).find((a) => a.lat != null && a.lng != null);
    const riddenSeriesIds = new Set<string>();
    const riddenDisciplines = new Set<string>();
    for (const row of (ridden ?? []) as unknown as {
      event: { series_id: string | null; disciplines: string[] | null } | { series_id: string | null; disciplines: string[] | null }[] | null;
    }[]) {
      const ev = unwrap(row.event);
      if (!ev) continue;
      if (ev.series_id) riddenSeriesIds.add(ev.series_id);
      for (const d of ev.disciplines ?? []) riddenDisciplines.add(d);
    }
    setSuggestCtx({
      home: home ? { lat: Number(home.lat), lng: Number(home.lng) } : null,
      radiusKm: Number(home?.radius_km ?? 60),
      riddenSeriesIds,
      riddenDisciplines,
      plannedEventIds: new Set(Object.keys(nextEvents)),
    });

    await loadSeries(nextEvents);

    setReady(true);
  }

  /**
   * A series only becomes interesting once at least one of its rounds is in
   * the plan, so the rounds are fetched for those series alone — and only for
   * this season, because last year's standings are not a plan.
   */
  async function loadSeries(planned: Record<string, PlannerEvent>) {
    const seriesIds = [
      ...new Set(
        Object.values(planned)
          .map((e) => e.seriesId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (seriesIds.length === 0) {
      setSeries([]);
      return;
    }
    const year = new Date().getFullYear();
    const supabase = createBrowserSupabase();
    const { data } = await supabase
      .from("events")
      .select(
        "id, name, slug, start_date, end_date, series_id, series:series(id, name, slug), location:locations(name, municipality)",
      )
      .in("series_id", seriesIds)
      .gte("start_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`)
      .order("start_date");

    const rounds: SeriesRound[] = [];
    for (const row of (data ?? []) as unknown as {
      id: string;
      name: string;
      slug: string;
      start_date: string;
      end_date: string | null;
      series_id: string | null;
      series: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
      location: { name: string | null; municipality: string | null } | { name: string | null; municipality: string | null }[] | null;
    }[]) {
      const ser = unwrap(row.series);
      if (!row.series_id || !ser) continue;
      const place = unwrap(row.location);
      rounds.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        startDate: row.start_date,
        endDate: row.end_date,
        place: place?.municipality || place?.name || null,
        seriesId: row.series_id,
        seriesName: ser.name,
        seriesSlug: ser.slug,
      });
    }
    setSeries(buildSeriesProgress(rounds, { plannedEventIds: new Set(Object.keys(planned)) }));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const attendance = useMemo(
    () =>
      Object.entries(attendanceByEvent).flatMap(([eventId, rows]) =>
        rows.map((r) => ({
          eventId,
          memberId: r.member_id,
          status: r.status,
          registered: r.registered,
          paid: r.paid,
        })),
      ),
    [attendanceByEvent],
  );

  const plans = useMemo(
    () => mergeEventPlans({ eventsById, favoriteIds, attendance }),
    [eventsById, favoriteIds, attendance],
  );

  const board = useMemo(() => buildWeekendBoard({ plans, weeks: 16 }), [plans]);
  const today = todayIso();
  const thisWeekend = currentWeekendPlans(board.weekends);
  const freeCount = countFreeWeekends(board.weekends, busyWeekdays);
  const upcomingCount = plans.filter((p) => p.event.startDate >= today).length;
  const actionCount = plans.filter((p) => planNeedsAction(p, today)).length;
  const raceDates = useMemo(() => raceDatesFromPlans(plans), [plans]);

  const listPlans = useMemo(() => {
    const day = todayIso();
    const upcoming = plans.filter(
      (p) => saturdayOfRaceWeekend(p.event.startDate) >= board.currentSaturday,
    );
    if (filter === "weekend") return thisWeekend;
    if (filter === "action") return upcoming.filter((p) => planNeedsAction(p, day));
    return upcoming;
  }, [board.currentSaturday, filter, plans, thisWeekend]);

  useEffect(() => {
    if (selectedDay) return;
    const next = plans.find((p) => p.event.startDate >= today);
    setSelectedDay(next ? parseISO(next.event.startDate) : parseISO(today));
  }, [plans, selectedDay, today]);

  async function onStatusChange(eventId: string, memberId: string, status: PlanMemberStatus) {
    if (!userId) return;
    setBusyId(eventId);
    const supabase = createBrowserSupabase();
    const next = await setMemberPlanStatus({
      supabase,
      userId,
      eventId,
      memberId,
      status,
      rows: attendanceByEvent[eventId] ?? [],
      favorited: favoriteIds.includes(eventId),
    });
    setAttendanceByEvent((prev) => ({ ...prev, [eventId]: next.rows }));
    setFavoriteIds((prev) =>
      next.favorited ? (prev.includes(eventId) ? prev : [...prev, eventId]) : prev.filter((id) => id !== eventId),
    );
    setBusyId(null);
  }

  async function onDiscard(eventId: string) {
    if (!userId) return;
    setBusyId(eventId);
    const supabase = createBrowserSupabase();
    await removeFromPlan({ supabase, userId, eventId });
    setAttendanceByEvent((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    setFavoriteIds((prev) => prev.filter((id) => id !== eventId));
    setBusyId(null);
  }

  async function onSetHome(place: PickedPlace) {
    if (!userId) return;
    const supabase = createBrowserSupabase();
    await supabase.from("race_alerts").insert({
      user_id: userId,
      enabled: true,
      label: place.label,
      lat: place.lat,
      lng: place.lng,
      radius_km: ALERT_RADIUS_DEFAULT,
      locale,
    });
    await load();
  }

  async function onAddRounds(eventIds: string[]) {
    if (!userId) return;
    const supabase = createBrowserSupabase();
    for (const id of eventIds) {
      await ensureFavorite(supabase, userId, id, false);
    }
    await load();
  }

  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!authed) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{t.myCalendar}</CardTitle>
          <CardDescription>{t.planAuthGoing}</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm locale={locale} onSuccess={() => void load()} />
        </CardContent>
      </Card>
    );
  }

  const raceForms = { one: t.countRaceOne, few: t.countRaceFew, many: t.countRaceMany };
  const freeForms = { one: t.countFreeOne, few: t.countFreeFew, many: t.countFreeMany };
  const thisForms = { one: t.planThisCountOne, few: t.planThisCountFew, many: t.planThisCountMany };
  const selectedIso = selectedDay ? formatIsoDate(selectedDay) : today;
  const dayPlans = plansOnIsoDate(plans, selectedIso);
  const currentWeekend = board.weekends.find((w) => w.isCurrent);
  const thisWeekendBusy = Boolean(
    currentWeekend &&
      (isBusyIsoDate(currentWeekend.saturday, busyWeekdays) ||
        isBusyIsoDate(currentWeekend.sunday, busyWeekdays)),
  );
  const selectedBusy = isBusyIsoDate(selectedIso, busyWeekdays);
  // The weekend the suggestions are answering for: whichever was clicked on
  // the board, or this one when it is sitting empty.
  // Derived from the board rather than held as a snapshot, so adding a race
  // to the picked weekend updates what is shown for it.
  const fillWeekend =
    board.weekends.find((w) => w.saturday === pickedSaturday) ??
    (currentWeekend && thisWeekend.length === 0 && !thisWeekendBusy ? currentWeekend : null);
  const busyDayOfWeek = toJsDayOfWeek(busyWeekdays);

  const summary = [
    pluralize(upcomingCount, loc, raceForms),
    thisWeekend.length === 0
      ? thisWeekendBusy
        ? t.planThisWeekendBusy
        : t.planThisWeekendFree
      : pluralize(thisWeekend.length, loc, thisForms),
    pluralize(freeCount, loc, freeForms),
  ].join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.planTitle}</h1>
        <p className="max-w-xl text-sm text-muted-foreground">{t.planSubtitle}</p>
        <p className="sr-only">{summary}</p>
      </header>

      <PlanStats
        locale={locale}
        upcoming={upcomingCount}
        needsAction={actionCount}
        freeWeekends={freeCount}
        onShowAction={() => {
          void setView("list");
          void setFilter("action");
        }}
      />

      <PlanSetup
        locale={locale}
        hasPeople={members.length > 0}
        hasPlace={Boolean(suggestCtx?.home)}
        hasRace={plans.length > 0}
        onSetHome={(place) => onSetHome(place)}
      />

      <WeekendBoard
        locale={locale}
        weekends={board.weekends}
        busyWeekdays={busyWeekdays}
        selected={fillWeekend?.saturday ?? null}
        onSelect={(w) => setPickedSaturday(w.saturday)}
      />

      {fillWeekend && suggestCtx ? (
        <FreeWeekendSuggestions
          key={fillWeekend.saturday}
          locale={locale}
          saturday={fillWeekend.saturday}
          sunday={fillWeekend.sunday}
          context={suggestCtx}
          title={
            fillWeekend.isCurrent
              ? undefined
              : t.suggestForWeekend.replace(
                  "{range}",
                  `${format(parseISO(fillWeekend.saturday), "d.", { locale: dateFnsLocale(locale) })}–${format(
                    parseISO(fillWeekend.sunday),
                    "d. M.",
                    { locale: dateFnsLocale(locale) },
                  )}`,
                )
          }
          onAdd={async (eventId) => {
            const supabase = createBrowserSupabase();
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) return;
            await ensureFavorite(supabase, auth.user.id, eventId, false);
            await load();
          }}
        />
      ) : null}

      <SeriesProgressCard
        locale={locale}
        items={series}
        plannedEventIds={new Set(Object.keys(eventsById))}
        onAddRounds={(ids) => onAddRounds(ids)}
      />

      {plans.length === 0 ? null : (
      <Tabs value={view} onValueChange={(v) => void setView(v as (typeof VIEWS)[number])}>
        <TabsList>
          <TabsTrigger value="calendar">
            <CalendarDays data-icon="inline-start" />
            {t.planViewCalendar}
          </TabsTrigger>
          <TabsTrigger value="list">
            <List data-icon="inline-start" />
            {t.planViewList}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          {plans.length === 0 ? (
            <PlanEmpty locale={locale} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-start">
              <Card className="w-fit">
                <CardContent className="pt-4">
                  <Calendar
                    mode="single"
                    locale={dateFnsLocale(locale)}
                    weekStartsOn={1}
                    selected={selectedDay}
                    onSelect={(d) => {
                      if (d) setSelectedDay(d);
                    }}
                    modifiers={{
                      hasRace: raceDates,
                      ...(busyDayOfWeek.length > 0 ? { busy: { dayOfWeek: busyDayOfWeek } } : {}),
                    }}
                    modifiersClassNames={{
                      busy: "text-muted-foreground",
                    }}
                    className="w-fit"
                    components={{
                      DayButton: (props) => (
                        <CalendarDayButton {...props}>
                          {props.children}
                          {props.modifiers.hasRace ? (
                            <i
                              aria-hidden
                              className="size-1 rounded-full bg-brand"
                            />
                          ) : null}
                        </CalendarDayButton>
                      ),
                    }}
                  />
                </CardContent>
              </Card>
              <div className="flex min-w-0 flex-col gap-3">
                <h2 className="text-sm font-semibold tabular-nums">
                  {format(parseISO(selectedIso), "EEEE d. MMMM yyyy", { locale: dateFnsLocale(locale) })}
                </h2>
                {dayPlans.length === 0 ? (
                  <Empty className="border border-dashed">
                    <EmptyHeader>
                      <EmptyTitle>{selectedBusy ? t.planDayBusy : t.planDayEmpty}</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="flex flex-col gap-3">
                    {dayPlans.map((plan) => (
                      <PlanRaceCard
                        key={plan.event.id}
                        locale={locale}
                        plan={plan}
                        members={members}
                        attendance={attendanceByEvent[plan.event.id] ?? []}
                        busy={busyId === plan.event.id}
                        onStatusChange={(memberId, status) =>
                          void onStatusChange(plan.event.id, memberId, status)
                        }
                        onDiscard={() => void onDiscard(plan.event.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4 flex flex-col gap-4">
          {plans.length === 0 ? (
            <PlanEmpty locale={locale} />
          ) : (
            <>
              <ToggleGroup
                type="single"
                value={filter}
                onValueChange={(v) => {
                  if (v) setFilter(v as Filter);
                }}
                variant="outline"
                size="sm"
                className="justify-start"
              >
                <ToggleGroupItem value="all">{t.planAll}</ToggleGroupItem>
                <ToggleGroupItem value="weekend">{t.thisWeekend}</ToggleGroupItem>
                <ToggleGroupItem value="action">
                  {t.planNeedsAction}
                  {actionCount > 0 ? (
                    <Badge variant="secondary" className="tabular-nums">
                      {actionCount}
                    </Badge>
                  ) : null}
                </ToggleGroupItem>
              </ToggleGroup>

              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Link href={`/${locale}/account`} className="underline-offset-4 hover:underline">
                    {t.planAddPeople}…
                  </Link>
                </p>
              ) : null}

              {filter === "action" && actionCount === 0 ? (
                <p className="text-sm text-muted-foreground">{t.planActionEmpty}</p>
              ) : null}

              {filter === "weekend" && thisWeekend.length === 0 ? (
                <Empty className="border border-dashed">
                  <EmptyHeader>
                    <EmptyTitle>
                      {thisWeekendBusy ? t.planThisWeekendBusy : t.planThisWeekendFree}
                    </EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : null}

              {listPlans.length > 0 ? (
                <>
                  <div className="hidden sm:block">
                    <PlanTable
                      locale={locale}
                      plans={listPlans}
                      members={members}
                      busyId={busyId}
                      currentSaturday={board.currentSaturday}
                      onStatusChange={(eventId, memberId, status) =>
                        void onStatusChange(eventId, memberId, status)
                      }
                      onDiscard={(eventId) => void onDiscard(eventId)}
                    />
                  </div>
                  <div className="sm:hidden">
                    <PlanCardList
                      locale={locale}
                      plans={listPlans}
                      members={members}
                      attendanceByEvent={attendanceByEvent}
                      busyId={busyId}
                      currentSaturday={board.currentSaturday}
                      onStatusChange={(eventId, memberId, status) =>
                        void onStatusChange(eventId, memberId, status)
                      }
                      onDiscard={(eventId) => void onDiscard(eventId)}
                    />
                  </div>
                </>
              ) : filter !== "weekend" && filter !== "action" ? (
                <PlanEmpty locale={locale} />
              ) : null}

              {filter === "all" && board.past.length > 0 ? (
                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">{t.planPast}</h2>
                  <div className="hidden sm:block">
                    <PlanTable
                      locale={locale}
                      plans={board.past}
                      members={members}
                      busyId={busyId}
                      muted
                      showWeekendBands={false}
                      onStatusChange={(eventId, memberId, status) =>
                        void onStatusChange(eventId, memberId, status)
                      }
                      onDiscard={(eventId) => void onDiscard(eventId)}
                    />
                  </div>
                  <div className="sm:hidden">
                    <PlanCardList
                      locale={locale}
                      plans={board.past}
                      members={members}
                      attendanceByEvent={attendanceByEvent}
                      busyId={busyId}
                      muted
                      showWeekendBands={false}
                      onStatusChange={(eventId, memberId, status) =>
                        void onStatusChange(eventId, memberId, status)
                      }
                      onDiscard={(eventId) => void onDiscard(eventId)}
                    />
                  </div>
                </section>
              ) : null}
            </>
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}

function PlanEmpty({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarDays />
        </EmptyMedia>
        <EmptyTitle>{t.planThisWeekendFree}</EmptyTitle>
        <EmptyDescription>{t.planEmpty}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href={`/${locale}`}>
            <MapPin data-icon="inline-start" />
            {t.viewOnMap}
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

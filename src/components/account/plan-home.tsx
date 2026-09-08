"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { AuthForm } from "@/components/account/auth-form";
import { FreeWeekendSuggestions } from "@/components/account/free-weekend-suggestions";
import { NextRaceHero } from "@/components/account/next-race-hero";
import type { PickedPlace } from "@/components/account/place-picker";
import { PlanSeason } from "@/components/account/plan-season";
import { PlanSetup } from "@/components/account/plan-setup";
import { PlanTodo } from "@/components/account/plan-todo";
import { SeriesProgressCard } from "@/components/account/series-progress-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { messagesFor } from "@/lib/i18n/messages";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { todayIso } from "@/lib/date-presets";
import { buildSeriesProgress, type SeriesProgress, type SeriesRound } from "@/lib/plan-series";
import { ALERT_RADIUS_DEFAULT } from "@/lib/race-alerts";
import { parseWeekdays } from "@/lib/plan-prefs";
import { planActions } from "@/lib/plan-actions";
import {
  mergeEventPlans,
  type BlockedDay,
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
import { persist } from "@/lib/account/save";
import { toast } from "sonner";

const EVENT_EMBED =
  "id, name, start_date, end_date, slug, level, class_label, disciplines, series_id, registration_url, registration_closes_at, website_url, location:locations(name, municipality, country_code)";

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
  registration_closes_at: string | null;
  website_url: string | null;
  location:
    | { name: string | null; municipality: string | null; country_code: string | null }
    | { name: string | null; municipality: string | null; country_code: string | null }[]
    | null;
};

function addDaysIso(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}

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
    registrationClosesAt: row.registration_closes_at,
    websiteUrl: row.website_url,
    seriesId: row.series_id,
  };
}

/**
 * The account, which is the plan.
 *
 * Four questions in the order a season is actually lived: what is next, what
 * do I owe on it, how does the rest of the year look, and what could fill the
 * hole. Everything that used to sit between them — a view switcher, a filter
 * row that reordered the same list, a month grid, three summary cards
 * repeating counts printed a hundred pixels below — is gone, because none of
 * it answered a question anybody arrived with.
 */
export function PlanHome({ locale }: { locale: string }) {
  const t = messagesFor(locale);
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<PlannerMember[]>([]);
  const [eventsById, setEventsById] = useState<Record<string, PlannerEvent>>({});
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [attendanceByEvent, setAttendanceByEvent] = useState<Record<string, AttendanceRecord[]>>({});
  const [busyWeekdays, setBusyWeekdays] = useState<number[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suggestCtx, setSuggestCtx] = useState<SuggestionContext | null>(null);
  const [series, setSeries] = useState<SeriesProgress[]>([]);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Record<string, BlockedDay>>({});
  const fillRef = useRef<HTMLDivElement>(null);

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
      supabase
        .from("event_favorites")
        .select(`event:events(${EVENT_EMBED})`)
        .eq("user_id", auth.user.id),
      supabase.from("profiles").select("busy_weekdays").eq("id", auth.user.id).maybeSingle(),
    ]);

    const { data: blockedRows } = await supabase
      .from("blocked_days")
      .select("day, note")
      .eq("user_id", auth.user.id);
    setBlocked(Object.fromEntries(((blockedRows ?? []) as BlockedDay[]).map((r) => [r.day, r])));

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

    for (const row of (favs ?? []) as unknown as { event: EventEmbed | EventEmbed[] | null }[]) {
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
      event:
        | { series_id: string | null; disciplines: string[] | null }
        | { series_id: string | null; disciplines: string[] | null }[]
        | null;
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
      series:
        | { id: string; name: string; slug: string }
        | { id: string; name: string; slug: string }[]
        | null;
      location:
        | { name: string | null; municipality: string | null }
        | { name: string | null; municipality: string | null }[]
        | null;
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

  const today = todayIso();
  const past = useMemo(
    () =>
      plans
        .filter((p) => (p.event.endDate ?? p.event.startDate) < today)
        .sort((a, b) => b.event.startDate.localeCompare(a.event.startDate)),
    [plans, today],
  );
  const actions = useMemo(() => planActions(plans, { members, today }), [plans, members, today]);
  const nextRace = plans.find((p) => (p.event.endDate ?? p.event.startDate) >= today) ?? null;

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
      next.favorited
        ? prev.includes(eventId)
          ? prev
          : [...prev, eventId]
        : prev.filter((id) => id !== eventId),
    );
    setBusyId(null);
  }

  async function onDiscard(eventId: string) {
    if (!userId) return;
    setBusyId(eventId);
    const supabase = createBrowserSupabase();
    if (!(await removeFromPlan({ supabase, userId, eventId }))) {
      toast.error(t.saveFailed);
      setBusyId(null);
      return;
    }
    setAttendanceByEvent((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    setFavoriteIds((prev) => prev.filter((id) => id !== eventId));
    setBusyId(null);
  }

  // Picking a day answers further down the page; without this the click looks
  // like it did nothing.
  useEffect(() => {
    if (!pickedDay) return;
    fillRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pickedDay]);

  /** One note per day: writing it claims the day, clearing it gives it back. */
  async function onSetNote(day: string, note: string) {
    if (!userId) return;
    const supabase = createBrowserSupabase();
    const before = blocked[day];
    if (!note) {
      setBlocked((prev) => {
        const next = { ...prev };
        delete next[day];
        return next;
      });
      await persist(
        supabase.from("blocked_days").delete().eq("user_id", userId).eq("day", day),
        {
          locale,
          onFailure: () =>
            setBlocked((prev) => (before ? { ...prev, [day]: before } : prev)),
        },
      );
      return;
    }
    setBlocked((prev) => ({ ...prev, [day]: { day, note } }));
    await persist(
      supabase
        .from("blocked_days")
        .upsert({ user_id: userId, day, note }, { onConflict: "user_id,day" }),
      {
        locale,
        onFailure: () =>
          setBlocked((prev) => {
            const next = { ...prev };
            if (before) next[day] = before;
            else delete next[day];
            return next;
          }),
      },
    );
  }

  async function onSetHome(place: PickedPlace) {
    if (!userId) return;
    const supabase = createBrowserSupabase();
    const ok = await persist(
      supabase.from("race_alerts").insert({
        user_id: userId,
        enabled: true,
        label: place.label,
        lat: place.lat,
        lng: place.lng,
        radius_km: ALERT_RADIUS_DEFAULT,
        locale,
      }),
      { locale },
    );
    if (ok) await load();
  }

  async function onAddRounds(eventIds: string[]) {
    if (!userId) return;
    const supabase = createBrowserSupabase();
    let allStored = true;
    for (const id of eventIds) {
      if (!(await ensureFavorite(supabase, userId, id, false))) allStored = false;
    }
    if (!allStored) toast.error(t.saveFailed);
    await load();
  }

  if (!ready) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!authed) {
    return (
      <Card className="m-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{t.planTitle}</CardTitle>
          <CardDescription>{t.planAuthGoing}</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm locale={locale} onSuccess={() => void load()} />
        </CardContent>
      </Card>
    );
  }

  // What the suggestions answer for: the day that was clicked, or — before
  // anything has been — the month ahead, which is more use than one arbitrary
  // day would be.
  const suggestFrom = pickedDay ?? today;
  const suggestTo = pickedDay ?? addDaysIso(today, 30);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PlanSetup
        locale={locale}
        hasPeople={members.length > 0}
        hasPlace={Boolean(suggestCtx?.home)}
        hasRace={plans.length > 0}
        onSetHome={(place) => onSetHome(place)}
      />

      {/*
        The next race used to be a card the height of a phone screen, above a
        list of jobs, above the season — so the season, which is the reason
        this page exists, started below the fold. It is one line now, and the
        season starts under it.
      */}
      {nextRace ? (
        <NextRaceHero
          locale={locale}
          plan={nextRace}
          members={members}
          busy={busyId === nextRace.event.id}
          onStatusChange={(memberId, status) =>
            void onStatusChange(nextRace.event.id, memberId, status)
          }
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {plans.length === 0 ? t.planEmpty : t.planNoUpcomingBody}{" "}
          <Link href={`/${locale}`} className="text-foreground underline underline-offset-4">
            {t.viewOnMap}
          </Link>
        </p>
      )}

      {/* The season on the left, and beside it the two things that answer
          "what now" — rather than a thousand pixels further down. */}
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <PlanSeason
          locale={locale}
          plans={plans}
          past={past}
          members={members}
          busyWeekdays={busyWeekdays}
          blocked={blocked}
          selected={pickedDay}
          busyId={busyId}
          onSelectDay={(day) => setPickedDay(day === pickedDay ? null : day)}
          onSetNote={(day, note) => onSetNote(day, note)}
          onStatusChange={(eventId, memberId, status) =>
            void onStatusChange(eventId, memberId, status)
          }
          onDiscard={(eventId) => void onDiscard(eventId)}
        />

        <aside ref={fillRef} className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20">
          {actions.length > 0 ? (
            <PlanTodo
              locale={locale}
              actions={actions}
              members={members}
              busyId={busyId}
              onStatusChange={(eventId, memberId, status) =>
                void onStatusChange(eventId, memberId, status)
              }
              onDiscard={(eventId) => void onDiscard(eventId)}
            />
          ) : null}

          {suggestCtx ? (
            <FreeWeekendSuggestions
              key={`${suggestFrom}-${suggestTo}`}
              locale={locale}
              from={suggestFrom}
              to={suggestTo}
              context={suggestCtx}
              title={
                pickedDay
                  ? t.suggestForDay.replace(
                      "{day}",
                      format(parseISO(pickedDay), "EEEE d. M.", { locale: dateFnsLocale(locale) }),
                    )
                  : t.suggestSoon
              }
              onAdd={async (eventId) => {
                const supabase = createBrowserSupabase();
                const { data: auth } = await supabase.auth.getUser();
                if (!auth.user) return;
                if (!(await ensureFavorite(supabase, auth.user.id, eventId, false))) {
                  toast.error(t.saveFailed);
                  return;
                }
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
        </aside>
      </div>
    </div>
  );
}

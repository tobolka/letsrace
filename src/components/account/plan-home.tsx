"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertInbox } from "@/components/account/alert-inbox";
import { AuthForm } from "@/components/account/auth-form";
import { FreeWeekendSuggestions } from "@/components/account/free-weekend-suggestions";
import { DayPickerButton } from "@/components/account/day-picker-button";
import { DocPageSkeleton, PlanPageSkeleton } from "@/components/account/page-skeletons";
import type { PickedPlace } from "@/components/account/place-picker";
import { PlanSeason, PlanViewToggle } from "@/components/account/plan-season";
import { SectionHeader } from "@/components/shell/section-header";
import { PlanSetup } from "@/components/account/plan-setup";
import { planActionNote } from "@/components/account/plan-action-note";
import { SeriesProgressCard } from "@/components/account/series-progress-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

/** Shared account data and persistence for the plan and recommendations routes. */
export function PlanHome({ locale, section = "plan", day }: { locale: string; section?: "plan" | "recommendations"; day?: string }) {
  const t = messagesFor(locale);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
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
  const [pickedDay, setPickedDay] = useState<string | null>(day ?? null);
  const [blocked, setBlocked] = useState<Record<string, BlockedDay>>({});

  async function load() {
    setLoadFailed(false);
    setReady(false);
    try {
      const supabase = createBrowserSupabase();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError && authError.name !== "AuthSessionMissingError") throw authError;
      if (!auth.user) {
        setAuthed(false);
        setReady(true);
        return;
      }
      setAuthed(true);
      setUserId(auth.user.id);

      // One round trip for everything the page needs, not four in a row: the
      // blocked days and the ranker's inputs do not depend on the plan, so
      // waiting for it before asking for them only added latency.
      const [
        { data: mems },
        { data: att },
        { data: favs },
        { data: prefs },
        { data: blockedRows },
        { data: alertRows },
      ] = await Promise.all([
        supabase
          .from("family_members")
          .select("id, name, relationship, is_self")
          .eq("user_id", auth.user.id)
          .order("created_at").throwOnError(),
        supabase
          .from("event_attendance")
          .select(`member_id, status, registered, paid, event:events(${EVENT_EMBED})`)
          .eq("user_id", auth.user.id).throwOnError(),
        supabase
          .from("event_favorites")
          .select(`event:events(${EVENT_EMBED})`)
          .eq("user_id", auth.user.id).throwOnError(),
        supabase.from("profiles").select("busy_weekdays").eq("id", auth.user.id).maybeSingle().throwOnError(),
        supabase
          .from("blocked_days")
          .select("day, note")
          .eq("user_id", auth.user.id).throwOnError(),
        supabase
          .from("race_alerts")
          .select("id, lat, lng, radius_km")
          .eq("user_id", auth.user.id)
          .eq("enabled", true).throwOnError(),
      ]);

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
      // The attendance rows already carry both; asking again was a fifth query.
      const home = (alertRows ?? []).find((a) => a.lat != null && a.lng != null);
      const riddenSeriesIds = new Set<string>();
      const riddenDisciplines = new Set<string>();
      for (const id of Object.keys(nextAtt)) {
        const ev = nextEvents[id];
        if (!ev) continue;
        if (ev.seriesId) riddenSeriesIds.add(ev.seriesId);
        for (const d of ev.disciplines) riddenDisciplines.add(d);
      }
      setSuggestCtx({
        home: home ? { lat: Number(home.lat), lng: Number(home.lng) } : null,
        radiusKm: Number(home?.radius_km ?? 60),
        riddenSeriesIds,
        riddenDisciplines,
        plannedEventIds: new Set(Object.keys(nextEvents)),
      });

      await loadSeries(nextEvents);
    } catch {
      setLoadFailed(true);
    } finally {
      setReady(true);
    }
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
        "id, name, slug, start_date, end_date, series_id, series:series!events_series_id_fkey(id, name, slug), location:locations(name, municipality)",
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

  async function onStatusChange(eventId: string, memberId: string, status: PlanMemberStatus) {
    if (!userId) return;
    setBusyId(eventId);
    try {
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
    } catch {
      toast.error(t.saveFailed);
    } finally {
      setBusyId(null);
    }
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
    // The shape of the page that is about to arrive, so nothing jumps when it does.
    return section === "recommendations" ? <DocPageSkeleton boxes={3} withHeading={false} /> : <PlanPageSkeleton />;
  }

  if (loadFailed) return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold">{t.myCalendar}</h1>
      <p role="alert" className="text-muted-foreground">{t.loadFailed}</p>
      <Button onClick={() => void load()}>{t.retry}</Button>
    </div>
  );

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

  /*
   * Discover is one feed, read top to bottom, most time-sensitive first: what
   * just appeared near you, what would fill a free weekend, which series you
   * could carry on. The areas these come from are set on their own page,
   * linked from the header — results here, settings there.
   */
  if (section === "recommendations") return (
    <div className="flex w-full flex-col gap-8">
      <PlanSetup locale={locale} hasPeople={members.length > 0} hasPlace={Boolean(suggestCtx?.home)} hasRace={plans.length > 0} onSetHome={onSetHome} />
      {userId ? <AlertInbox locale={locale} userId={userId} /> : null}
      <div className="flex flex-col gap-8 [&>*]:min-w-0">
          {suggestCtx ? (
            <FreeWeekendSuggestions
              key={`${suggestFrom}-${suggestTo}`}
              locale={locale}
              from={suggestFrom}
              to={suggestTo}
              context={suggestCtx}
              actions={<DayPickerButton locale={locale} value={pickedDay} onChange={setPickedDay} />}
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
      </div>
    </div>
  );

  // What each race is waiting for, on its own row — the plan's to-do list is
  // the plan itself, not a second list beside it naming the same races.
  const notes = Object.fromEntries(actions.map((a) => [a.plan.event.id, planActionNote(a, locale)]));

  /*
   * The same frame as the race list and the calendar: the section's name, one
   * line on what this page is for, the view switch — then the races across
   * the whole sheet. Each upcoming race says what it is waiting for, and its
   * riders' switches say "going → entered → paid" in words.
   */
  return (
    <div className="flex min-h-full flex-col md:absolute md:inset-0">
      <SectionHeader
        title={t.myCalendar}
        actions={<PlanViewToggle locale={locale} />}
      />
      <div className="flex min-w-0 flex-1 flex-col md:overflow-y-auto">
        <PlanSetup
          locale={locale}
          hasPeople={members.length > 0}
          hasPlace={Boolean(suggestCtx?.home)}
          hasRace={plans.length > 0}
          onSetHome={(place) => onSetHome(place)}
          className="border-b px-4 py-4 md:px-6"
        />
        <PlanSeason
          locale={locale}
          plans={plans}
          past={past}
          members={members}
          busyWeekdays={busyWeekdays}
          blocked={blocked}
          selected={pickedDay}
          busyId={busyId}
          notes={notes}
          onSelectDay={(day) => setPickedDay(day === pickedDay ? null : day)}
          onSetNote={(day, note) => onSetNote(day, note)}
          onStatusChange={(eventId, memberId, status) => void onStatusChange(eventId, memberId, status)}
          onDiscard={(eventId) => void onDiscard(eventId)}
        />
      </div>
    </div>
  );
}

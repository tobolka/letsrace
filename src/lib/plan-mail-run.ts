import { format, parseISO } from "date-fns";
import { createServerSupabase } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/read-all";
import { todayIso } from "@/lib/date-presets";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { sendResendEmail } from "@/lib/mail";
import { renderEmail, renderEmailText, type EmailContent, type EmailSection } from "@/lib/email/layout";
import { emailFooterLinks } from "@/lib/email/links";
import { disciplineColor } from "@/lib/map-visuals";
import { eventPagePath } from "@/lib/event-url";
import { formatDistanceKm } from "@/lib/geo/distance";
import { parseWeekdays } from "@/lib/plan-prefs";
import {
  buildWeeklyDigest,
  digestHasContent,
  isWednesdayInPrague,
  pickDigestNearby,
  pragueIsoDate,
  type DigestNearby,
} from "@/lib/plan-digest";
import { mergeEventPlans, type EventPlan, type PlannerAttendance, type PlannerEvent } from "@/lib/planner";
import { matchAlert, type AlertCandidate, type RaceAlert } from "@/lib/race-alerts";
import { getSiteUrl } from "@/lib/seo";
import { DISCIPLINE_LABELS, type Discipline } from "@/lib/taxonomy";
import type { PlanChangeKind } from "@/lib/plan-changes";
import { UPCOMING_EVENT_STATUSES } from "@/lib/event-visibility";
import { localePath } from "@/lib/localized-paths";

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type EventRow = {
  id: string;
  name: string;
  slug: string;
  start_date: string;
  end_date: string | null;
  disciplines: string[] | null;
  registration_url: string | null;
  website_url: string | null;
  status: string | null;
  visibility: string | null;
  created_at?: string;
  level: string | null;
  class_label: string | null;
  location:
    | {
        lat: number | null;
        lng: number | null;
        municipality: string | null;
        name: string | null;
        country_code: string | null;
      }
    | {
        lat: number | null;
        lng: number | null;
        municipality: string | null;
        name: string | null;
        country_code: string | null;
      }[]
    | null;
};

const EVENT_EMBED =
  "id, name, slug, start_date, end_date, disciplines, registration_url, website_url, status, visibility, level, class_label, created_at, location:locations(lat, lng, municipality, name, country_code)";

function toPlannerEvent(row: EventRow): PlannerEvent {
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
  };
}

function toCandidate(row: EventRow): AlertCandidate {
  const loc = unwrap(row.location);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    startDate: row.start_date,
    disciplines: row.disciplines ?? [],
    status: row.status,
    visibility: row.visibility,
    createdAt: row.created_at ?? "",
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
    place: loc?.municipality || loc?.name || null,
    countryCode: loc?.country_code ?? null,
  };
}

function disciplineLabel(ids: string): string {
  return ids
    .split(",")
    .map((id) => DISCIPLINE_LABELS[id as Discipline] || id)
    .filter(Boolean)
    .join(" · ");
}

function formatDay(iso: string, locale: string) {
  return format(parseISO(iso), "d. M. yyyy", { locale: dateFnsLocale(locale) });
}

function subjectForChange(kind: PlanChangeKind, t: ReturnType<typeof messagesFor>): string {
  if (kind === "cancelled") return t.planChangeSubjectCancelled;
  if (kind === "registration") return t.planChangeSubjectRegistration;
  if (kind === "discipline") return t.planChangeSubjectDiscipline;
  return t.planChangeSubjectDate;
}

function changeLine(
  kind: PlanChangeKind,
  payload: Record<string, string>,
  locale: string,
  t: ReturnType<typeof messagesFor>,
): string {
  if (kind === "date") {
    return t.planChangeDateBody
      .replace("{date}", formatDay(payload.to ?? "", locale))
      .replace("{from}", formatDay(payload.from ?? "", locale));
  }
  if (kind === "cancelled") return t.planChangeCancelledBody;
  if (kind === "registration") return t.planChangeRegistrationBody;
  return t.planChangeDisciplineBody.replace("{discipline}", disciplineLabel(payload.to ?? ""));
}

export type Notice = {
  event: { id: string; name: string; slug: string; startDate: string; endDate: string | null };
  kind: PlanChangeKind;
  payload: Record<string, string>;
  changeId: string;
};

type Mail = { subject: string; html: string; text: string; headers?: Record<string, string> };

function flagFor(kind: PlanChangeKind, t: ReturnType<typeof messagesFor>): string {
  if (kind === "cancelled") return t.planChangeFlagCancelled;
  if (kind === "registration") return t.planChangeFlagRegistration;
  if (kind === "discipline") return t.planChangeFlagDiscipline;
  return t.planChangeFlagDate;
}

/** What changed on races in someone's plan: one row per race, the change flagged. */
export function planChangeEmail(locale: string, userId: string, notices: Notice[]): Mail {
  const t = messagesFor(locale);
  const loc = asLocale(locale);
  const origin = getSiteUrl();
  const kinds = [...new Set(notices.map((n) => n.kind))];
  const subject =
    notices.length === 1 && kinds.length === 1 ? subjectForChange(kinds[0]!, t) : t.planChangeSubjectMany;
  const links = emailFooterLinks(loc, { kind: "plan", id: userId });
  const content: EmailContent = {
    locale: loc,
    preheader: t.emailPreheaderChange,
    heading: subject,
    intro: notices.length === 1 ? undefined : t.planChangeIntroMany,
    sections: [
      {
        races: notices.map((n) => ({
          name: n.event.name,
          href: `${origin}${eventPagePath(loc, n.event.slug)}`,
          // A moved race is shown on the day it moved to.
          date: n.kind === "date" && n.payload.to ? n.payload.to : n.event.startDate,
          flag: flagFor(n.kind, t),
          meta: changeLine(n.kind, n.payload, loc, t),
        })),
      },
    ],
    cta: { label: t.planChangeCta, href: `${origin}${localePath(loc, "account")}` },
    reason: t.planMailFooter,
    manage: links.manage,
    unsubscribe: links.unsubscribe,
  };
  return { subject, html: renderEmail(content), text: renderEmailText(content), headers: links.headers };
}

/** Wednesday's look at the weekend: what is on, what is not settled, what is free. */
export function digestEmail(locale: string, userId: string, digest: ReturnType<typeof buildWeeklyDigest>): Mail {
  const t = messagesFor(locale);
  const loc = asLocale(locale);
  const origin = getSiteUrl();
  const race = (p: EventPlan) => ({
    name: p.event.name,
    href: `${origin}${eventPagePath(loc, p.event.slug)}`,
    date: p.event.startDate,
    color: disciplineColor(p.event.disciplines),
    meta: [[p.event.place, p.event.countryCode].filter(Boolean).join(" · "), disciplineLabel(p.event.disciplines.join(","))]
      .filter(Boolean)
      .join(" · "),
  });
  const sections: EmailSection[] = [
    digest.thisWeekend.length === 0
      ? { title: t.digestThisWeekend, text: t.digestThisFree }
      : { title: t.digestThisWeekend, races: digest.thisWeekend.map(race) },
  ];
  if (digest.needsAction.length > 0) sections.push({ title: t.digestNeedsAction, races: digest.needsAction.map(race) });
  if (digest.nearby) {
    const n = digest.nearby;
    sections.push({
      title: t.digestNearby,
      races: [
        {
          name: n.name,
          href: `${origin}${eventPagePath(loc, n.slug)}`,
          date: n.startDate,
          meta: [n.place, formatDistanceKm(n.km, loc)].filter(Boolean).join(" · "),
        },
      ],
    });
  }
  if (digest.nextWeekendFree) sections.push({ text: t.digestNextFree });
  const links = emailFooterLinks(loc, { kind: "digest", id: userId });
  const content: EmailContent = {
    locale: loc,
    preheader: t.emailPreheaderDigest,
    heading: t.digestSubject,
    intro: t.digestIntro,
    sections,
    cta: { label: t.digestCta, href: `${origin}${localePath(loc, "account")}` },
    reason: t.planMailFooter,
    manage: links.manage,
    unsubscribe: links.unsubscribe,
  };
  return { subject: t.digestSubject, html: renderEmail(content), text: renderEmailText(content), headers: links.headers };
}

export async function runPlanChangeMails(now = new Date()) {
  const supabase = createServerSupabase();
  const since = new Date(now);
  since.setDate(since.getDate() - 14);

  const { data: changeRows } = await supabase
    .from("event_plan_changes")
    .select(
      "id, event_id, kind, payload, event:events(id, name, slug, start_date, end_date)",
    )
    .gte("created_at", since.toISOString())
    .limit(500);

  type ChangeRow = {
    id: string;
    event_id: string;
    kind: PlanChangeKind;
    payload: Record<string, string> | null;
    event:
      | { id: string; name: string; slug: string; start_date: string; end_date: string | null }
      | { id: string; name: string; slug: string; start_date: string; end_date: string | null }[]
      | null;
  };
  const changes = ((changeRows ?? []) as unknown as ChangeRow[]).filter((row) => unwrap(row.event));
  if (changes.length === 0) return { changes: 0, emailed: 0 };

  const eventIds = [...new Set(changes.map((c) => c.event_id))];
  const [{ data: favs }, { data: atts }, existing] = await Promise.all([
    supabase.from("event_favorites").select("user_id, event_id").in("event_id", eventIds),
    supabase.from("event_attendance").select("user_id, event_id").in("event_id", eventIds),
    /*
     * Who has already had this letter. Read short — and PostgREST answers at
     * most a thousand rows whatever `.limit()` says — it reads as "not sent",
     * and the same change is mailed out again.
     */
    readAllRows<{ user_id: string; change_id: string }>((from, to) =>
      supabase
        .from("plan_change_deliveries")
        .select("user_id, change_id")
        .in(
          "change_id",
          changes.map((c) => c.id),
        )
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const owners = new Map<string, Set<string>>();
  for (const row of [...(favs ?? []), ...(atts ?? [])] as { user_id: string; event_id: string }[]) {
    const set = owners.get(row.event_id) ?? new Set<string>();
    set.add(row.user_id);
    owners.set(row.event_id, set);
  }
  const seen = new Set(existing.map((d) => `${d.user_id}:${d.change_id}`));

  const pending: { userId: string; notice: Notice }[] = [];
  for (const row of changes) {
    const ev = unwrap(row.event);
    if (!ev) continue;
    for (const userId of owners.get(row.event_id) ?? []) {
      const key = `${userId}:${row.id}`;
      if (seen.has(key)) continue;
      pending.push({
        userId,
        notice: {
          event: {
            id: ev.id,
            name: ev.name,
            slug: ev.slug,
            startDate: ev.start_date,
            endDate: ev.end_date,
          },
          kind: row.kind,
          payload: row.payload ?? {},
          changeId: row.id,
        },
      });
    }
  }

  if (pending.length === 0) return { changes: changes.length, emailed: 0 };

  const userIds = [...new Set(pending.map((p) => p.userId))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, plan_mail, locale")
    .in("id", userIds);

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        email: (p.email as string | null) ?? null,
        planMail: p.plan_mail !== false,
        locale: (p.locale as string | null) || "cs",
      },
    ]),
  );

  const { error: insertError } = await supabase.from("plan_change_deliveries").upsert(
    pending.map((p) => ({ user_id: p.userId, change_id: p.notice.changeId })),
    { onConflict: "user_id,change_id", ignoreDuplicates: true },
  );
  if (insertError) console.error("plan_change_deliveries", insertError.message);

  const grouped = new Map<string, { email: string; locale: string; notices: Notice[] }>();
  for (const p of pending) {
    const profile = profileById.get(p.userId);
    if (!profile?.email || !profile.planMail) continue;
    const g = grouped.get(p.userId) ?? { email: profile.email, locale: profile.locale, notices: [] };
    g.notices.push(p.notice);
    grouped.set(p.userId, g);
  }

  let emailed = 0;
  const stamped: string[] = [];
  for (const [userId, g] of grouped) {
    const mail = planChangeEmail(g.locale, userId, g.notices);
    const ok = await sendResendEmail({
      to: g.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: mail.headers,
      idempotencyKey: `plan-change/${userId}/${g.notices.map((n) => n.changeId).sort().join(",")}`,
    });
    if (ok) {
      emailed += 1;
      stamped.push(userId);
    }
  }

  if (stamped.length > 0) {
    const stamp = new Date().toISOString();
    await supabase
      .from("plan_change_deliveries")
      .update({ emailed_at: stamp })
      .in("user_id", stamped)
      .is("emailed_at", null);
  }

  return { changes: changes.length, emailed };
}

export async function runWeeklyDigest(now = new Date()) {
  if (!isWednesdayInPrague(now)) return { users: 0, emailed: 0, skipped: "not_wednesday" as const };
  const supabase = createServerSupabase();
  const weekKey = pragueIsoDate(now);
  const today = todayIso(now);

  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, digest_mail, locale, busy_weekdays")
    .eq("digest_mail", true)
    .not("email", "is", null);

  const eligible = (users ?? []).filter((u) => u.email);
  if (eligible.length === 0) return { users: 0, emailed: 0 };

  const userIds = eligible.map((u) => u.id as string);
  const already = await readAllRows<{ user_id: string }>((from, to) =>
    supabase
      .from("plan_digest_deliveries")
      .select("user_id")
      .eq("week_key", weekKey)
      .in("user_id", userIds)
      .order("id", { ascending: true })
      .range(from, to),
  );
  const sent = new Set(already.map((r) => r.user_id));
  const remaining = eligible.filter((u) => !sent.has(u.id as string));
  if (remaining.length === 0) return { users: eligible.length, emailed: 0 };

  const remainingIds = remaining.map((u) => u.id as string);
  const [{ data: favs }, { data: atts }, { data: alerts }] = await Promise.all([
    supabase
      .from("event_favorites")
      .select(`user_id, event_id, event:events(${EVENT_EMBED})`)
      .in("user_id", remainingIds),
    supabase
      .from("event_attendance")
      .select(`user_id, event_id, member_id, status, registered, paid, event:events(${EVENT_EMBED})`)
      .in("user_id", remainingIds),
    supabase
      .from("race_alerts")
      .select("id, user_id, enabled, label, lat, lng, radius_km, disciplines, locale, created_at")
      .in("user_id", remainingIds)
      .eq("enabled", true),
  ]);

  const { data: blockedRows } = await supabase
    .from("blocked_days")
    .select("user_id, day")
    .in("user_id", remainingIds);
  const blockedByUser = new Map<string, Set<string>>();
  for (const row of (blockedRows ?? []) as { user_id: string; day: string }[]) {
    const set = blockedByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.day);
    blockedByUser.set(row.user_id, set);
  }

  const since = new Date(now);
  since.setDate(since.getDate() - 7);
  const { data: recentEvents } = await supabase
    .from("events")
    .select(EVENT_EMBED)
    .eq("visibility", "public")
    .in("status", [...UPCOMING_EVENT_STATUSES])
    .gte("start_date", today)
    .gte("created_at", since.toISOString())
    .limit(800);

  const candidates = ((recentEvents ?? []) as unknown as EventRow[]).map(toCandidate);

  type FavRow = { user_id: string; event_id: string; event: EventRow | EventRow[] | null };
  type AttRow = {
    user_id: string;
    event_id: string;
    member_id: string;
    status: string;
    registered: boolean;
    paid: boolean;
    event: EventRow | EventRow[] | null;
  };

  const eventsByUser = new Map<string, Record<string, PlannerEvent>>();
  const favsByUser = new Map<string, string[]>();
  const attByUser = new Map<string, PlannerAttendance[]>();

  function addEvent(userId: string, row: EventRow | EventRow[] | null) {
    const ev = unwrap(row);
    if (!ev) return;
    const bag = eventsByUser.get(userId) ?? {};
    bag[ev.id] = toPlannerEvent(ev);
    eventsByUser.set(userId, bag);
  }

  for (const row of (favs ?? []) as unknown as FavRow[]) {
    addEvent(row.user_id, row.event);
    favsByUser.set(row.user_id, [...(favsByUser.get(row.user_id) ?? []), row.event_id]);
  }
  for (const row of (atts ?? []) as unknown as AttRow[]) {
    addEvent(row.user_id, row.event);
    attByUser.set(row.user_id, [
      ...(attByUser.get(row.user_id) ?? []),
      {
        eventId: row.event_id,
        memberId: row.member_id,
        status: row.status,
        registered: Boolean(row.registered),
        paid: Boolean(row.paid),
      },
    ]);
  }

  const alertsByUser = new Map<string, RaceAlert[]>();
  for (const row of (alerts ?? []) as unknown as {
    id: string;
    user_id: string;
    enabled: boolean;
    label: string;
    lat: number;
    lng: number;
    radius_km: number;
    disciplines: string[] | null;
    locale: string;
    created_at: string;
  }[]) {
    const list = alertsByUser.get(row.user_id) ?? [];
    list.push({
      id: row.id,
      userId: row.user_id,
      enabled: row.enabled,
      label: row.label,
      lat: row.lat,
      lng: row.lng,
      radiusKm: row.radius_km,
      disciplines: row.disciplines ?? [],
      locale: row.locale,
      createdAt: row.created_at,
    });
    alertsByUser.set(row.user_id, list);
  }

  let emailed = 0;
  for (const user of remaining) {
    const userId = user.id as string;
    const plans = mergeEventPlans({
      eventsById: eventsByUser.get(userId) ?? {},
      favoriteIds: favsByUser.get(userId) ?? [],
      attendance: attByUser.get(userId) ?? [],
    });
    const upcoming = plans.filter((p) => p.event.startDate >= today);
    const nearbyHits: DigestNearby[] = [];
    for (const alert of alertsByUser.get(userId) ?? []) {
      for (const event of candidates) {
        const hit = matchAlert(alert, event, today, parseWeekdays(user.busy_weekdays));
        if (!hit) continue;
        nearbyHits.push({
          id: hit.event.id,
          name: hit.event.name,
          slug: hit.event.slug,
          startDate: hit.event.startDate,
          km: hit.km,
          place: hit.event.place,
        });
      }
    }
    const nearby = pickDigestNearby(
      nearbyHits,
      upcoming.map((p) => p.event.id),
    );
    const digest = buildWeeklyDigest({
      plans: upcoming,
      busyWeekdays: parseWeekdays(user.busy_weekdays),
      blockedDays: blockedByUser.get(user.id as string) ?? new Set<string>(),
      nearby,
      now,
    });
    if (!digestHasContent(digest, upcoming.length > 0)) continue;

    const locale = (user.locale as string | null) || "cs";
    const mail = digestEmail(locale, userId, digest);
    const ok = await sendResendEmail({
      to: user.email as string,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: mail.headers,
      idempotencyKey: `plan-digest/${userId}/${weekKey}`,
    });
    if (!ok) continue;
    emailed += 1;
    await supabase.from("plan_digest_deliveries").upsert(
      { user_id: userId, week_key: weekKey, emailed_at: new Date().toISOString() },
      { onConflict: "user_id,week_key" },
    );
  }

  return { users: remaining.length, emailed };
}

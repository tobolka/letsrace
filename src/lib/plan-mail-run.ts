import { format, parseISO } from "date-fns";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayIso } from "@/lib/date-presets";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { escapeHtml, sendResendEmail } from "@/lib/mail";
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
import { mergeEventPlans, type PlannerAttendance, type PlannerEvent } from "@/lib/planner";
import { matchAlert, type AlertCandidate, type RaceAlert } from "@/lib/race-alerts";
import { getSiteUrl, SITE_NAME } from "@/lib/seo";
import { DISCIPLINE_LABELS, type Discipline } from "@/lib/taxonomy";
import type { PlanChangeKind } from "@/lib/plan-changes";

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

function brandWrap(body: string, footer: string): string {
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;color:#1c1917;">
    <p style="font-weight:800;font-style:italic;letter-spacing:-0.04em;color:#c81d25;font-size:22px;margin:0 0 12px;">${SITE_NAME}</p>
    ${body}
    <p style="margin:20px 0 0;font-size:12px;color:#a8a29e;">${escapeHtml(footer)}</p>
  </div>`;
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

type Notice = {
  event: { id: string; name: string; slug: string; startDate: string; endDate: string | null };
  kind: PlanChangeKind;
  payload: Record<string, string>;
  changeId: string;
};

function planChangeEmail(locale: string, notices: Notice[]): { subject: string; html: string } {
  const t = messagesFor(locale);
  const loc = asLocale(locale);
  const origin = getSiteUrl();
  const kinds = [...new Set(notices.map((n) => n.kind))];
  const subject =
    notices.length === 1 && kinds.length === 1
      ? subjectForChange(kinds[0]!, t)
      : t.planChangeSubjectMany;
  const rows = notices
    .map((n) => {
      const href = `${origin}${eventPagePath(loc, n.event.slug)}`;
      const detail = changeLine(n.kind, n.payload, loc, t);
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e7e5e4;">
          <a href="${href}" style="color:#c81d25;font-weight:600;text-decoration:none;">${escapeHtml(n.event.name)}</a>
          <div style="color:#57534d;font-size:13px;margin-top:2px;">${escapeHtml(detail)}</div>
        </td>
      </tr>`;
    })
    .join("");
  const cta = `${origin}/${loc}/calendar`;
  const html = brandWrap(
    `<p style="margin:0 0 16px;color:#57534d;">${escapeHtml(notices.length === 1 ? subjectForChange(notices[0]!.kind, t) : t.planChangeIntroMany)}</p>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <p style="margin:16px 0 0;"><a href="${cta}" style="color:#c81d25;font-weight:600;text-decoration:none;">${escapeHtml(t.planChangeCta)}</a></p>`,
    t.planMailFooter,
  );
  return { subject, html };
}

function digestEmail(
  locale: string,
  digest: ReturnType<typeof buildWeeklyDigest>,
): { subject: string; html: string } {
  const t = messagesFor(locale);
  const loc = asLocale(locale);
  const origin = getSiteUrl();
  const cta = `${origin}/${loc}/calendar`;
  const raceLink = (slug: string, name: string, startDate: string) => {
    const href = `${origin}${eventPagePath(loc, slug)}`;
    return `<div style="padding:6px 0;">
      <a href="${href}" style="color:#c81d25;font-weight:600;text-decoration:none;">${escapeHtml(name)}</a>
      <span style="color:#57534d;font-size:13px;"> · ${escapeHtml(formatDay(startDate, loc))}</span>
    </div>`;
  };
  const sections: string[] = [];
  sections.push(`<p style="margin:0 0 4px;font-weight:600;">${escapeHtml(t.digestThisWeekend)}</p>`);
  if (digest.thisWeekend.length === 0) {
    sections.push(`<p style="margin:0 0 16px;color:#57534d;">${escapeHtml(t.digestThisFree)}</p>`);
  } else {
    sections.push(
      `<div style="margin:0 0 16px;">${digest.thisWeekend.map((p) => raceLink(p.event.slug, p.event.name, p.event.startDate)).join("")}</div>`,
    );
  }
  if (digest.needsAction.length > 0) {
    sections.push(`<p style="margin:0 0 4px;font-weight:600;">${escapeHtml(t.digestNeedsAction)}</p>`);
    sections.push(
      `<div style="margin:0 0 16px;">${digest.needsAction.map((p) => raceLink(p.event.slug, p.event.name, p.event.startDate)).join("")}</div>`,
    );
  }
  if (digest.nextWeekendFree) {
    sections.push(`<p style="margin:0 0 16px;color:#57534d;">${escapeHtml(t.digestNextFree)}</p>`);
  }
  if (digest.nearby) {
    const n = digest.nearby;
    const dist = formatDistanceKm(n.km, loc);
    const where = [n.place, dist].filter(Boolean).join(" · ");
    sections.push(`<p style="margin:0 0 4px;font-weight:600;">${escapeHtml(t.digestNearby)}</p>`);
    sections.push(
      `<div style="margin:0 0 16px;">${raceLink(n.slug, n.name, n.startDate)}<div style="color:#57534d;font-size:13px;">${escapeHtml(where)}</div></div>`,
    );
  }
  const html = brandWrap(
    `<p style="margin:0 0 16px;color:#57534d;">${escapeHtml(t.digestIntro)}</p>${sections.join("")}
    <p style="margin:16px 0 0;"><a href="${cta}" style="color:#c81d25;font-weight:600;text-decoration:none;">${escapeHtml(t.digestCta)}</a></p>`,
    t.planMailFooter,
  );
  return { subject: t.digestSubject, html };
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
  const [{ data: favs }, { data: atts }, { data: existing }] = await Promise.all([
    supabase.from("event_favorites").select("user_id, event_id").in("event_id", eventIds),
    supabase.from("event_attendance").select("user_id, event_id").in("event_id", eventIds),
    supabase
      .from("plan_change_deliveries")
      .select("user_id, change_id")
      .in(
        "change_id",
        changes.map((c) => c.id),
      ),
  ]);

  const owners = new Map<string, Set<string>>();
  for (const row of [...(favs ?? []), ...(atts ?? [])] as { user_id: string; event_id: string }[]) {
    const set = owners.get(row.event_id) ?? new Set<string>();
    set.add(row.user_id);
    owners.set(row.event_id, set);
  }
  const seen = new Set((existing ?? []).map((d) => `${d.user_id}:${d.change_id}`));

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
    const mail = planChangeEmail(g.locale, g.notices);
    const ok = await sendResendEmail({
      to: g.email,
      subject: mail.subject,
      html: mail.html,
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
  const { data: already } = await supabase
    .from("plan_digest_deliveries")
    .select("user_id")
    .eq("week_key", weekKey)
    .in("user_id", userIds);
  const sent = new Set((already ?? []).map((r) => r.user_id as string));
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
    .from("blocked_weekends")
    .select("user_id, saturday")
    .in("user_id", remainingIds);
  const blockedByUser = new Map<string, Set<string>>();
  for (const row of (blockedRows ?? []) as { user_id: string; saturday: string }[]) {
    const set = blockedByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.saturday);
    blockedByUser.set(row.user_id, set);
  }

  const since = new Date(now);
  since.setDate(since.getDate() - 7);
  const { data: recentEvents } = await supabase
    .from("events")
    .select(EVENT_EMBED)
    .eq("visibility", "public")
    .in("status", ["scheduled", "postponed", "registration_open"])
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
      blockedSaturdays: blockedByUser.get(user.id as string) ?? new Set<string>(),
      nearby,
      now,
    });
    if (!digestHasContent(digest, upcoming.length > 0)) continue;

    const locale = (user.locale as string | null) || "cs";
    const mail = digestEmail(locale, digest);
    const ok = await sendResendEmail({
      to: user.email as string,
      subject: mail.subject,
      html: mail.html,
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

import { createServerSupabase } from "@/lib/supabase/server";
import { todayIso } from "@/lib/date-presets";
import { eventMapPath } from "@/lib/event-url";
import { getSiteUrl, SITE_NAME } from "@/lib/seo";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { formatDistanceKm } from "@/lib/geo/distance";
import { escapeHtml, sendResendEmail } from "@/lib/mail";
import { matchAlert, type AlertCandidate, type AlertMatch, type RaceAlert } from "@/lib/race-alerts";
import { parseWeekdays } from "@/lib/plan-prefs";

type AlertRow = {
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
  profile: {
    email: string | null;
    busy_weekdays: number[] | null;
  } | {
    email: string | null;
    busy_weekdays: number[] | null;
  }[] | null;
};

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function toAlert(row: AlertRow): RaceAlert {
  return {
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
  };
}

function toCandidate(row: {
  id: string;
  name: string;
  slug: string;
  start_date: string;
  disciplines: string[] | null;
  status: string | null;
  visibility: string | null;
  created_at: string;
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
}): AlertCandidate {
  const loc = unwrap(row.location);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    startDate: row.start_date,
    disciplines: row.disciplines ?? [],
    status: row.status,
    visibility: row.visibility,
    createdAt: row.created_at,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
    place: loc?.municipality || loc?.name || null,
    countryCode: loc?.country_code ?? null,
  };
}

function emailHtml(
  locale: string,
  alert: RaceAlert,
  matches: AlertMatch[],
): { subject: string; html: string } {
  const t = messagesFor(locale);
  const loc = asLocale(locale);
  const origin = getSiteUrl();
  const place = alert.label || t.myLocation;
  const subject = t.alertEmailSubject
    .replace("{n}", String(matches.length))
    .replace("{place}", place)
    .replace("{km}", String(alert.radiusKm));
  const rows = matches
    .map((m) => {
      const href = `${origin}${eventMapPath(loc, { slug: m.event.slug, startDate: m.event.startDate })}`;
      const where = [m.event.place, m.event.countryCode].filter(Boolean).join(" · ");
      const dist = formatDistanceKm(m.km, loc);
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e7e5e4;">
          <a href="${href}" style="color:#c81d25;font-weight:600;text-decoration:none;">${escapeHtml(m.event.name)}</a>
          <div style="color:#57534d;font-size:13px;margin-top:2px;">${escapeHtml(m.event.startDate)} · ${escapeHtml(where)} · ${escapeHtml(dist)}</div>
        </td>
      </tr>`;
    })
    .join("");
  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;color:#1c1917;">
    <p style="font-weight:800;font-style:italic;letter-spacing:-0.04em;color:#c81d25;font-size:22px;margin:0 0 12px;">${SITE_NAME}</p>
    <p style="margin:0 0 16px;color:#57534d;">${escapeHtml(t.alertEmailIntro.replace("{place}", place).replace("{km}", String(alert.radiusKm)))}</p>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <p style="margin:20px 0 0;font-size:12px;color:#a8a29e;">${escapeHtml(t.alertEmailFooter)}</p>
  </div>`;
  return { subject, html };
}

export async function runRaceAlerts(now = new Date()) {
  const supabase = createServerSupabase();
  const today = todayIso(now);
  const since = new Date(now);
  since.setDate(since.getDate() - 14);

  const [{ data: alertRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("race_alerts")
      .select("id, user_id, enabled, label, lat, lng, radius_km, disciplines, locale, created_at, profile:profiles(email, busy_weekdays)")
      .eq("enabled", true),
    supabase
      .from("events")
      .select(
        "id, name, slug, start_date, disciplines, status, visibility, created_at, location:locations(lat, lng, municipality, name, country_code)",
      )
      .eq("visibility", "public")
      .in("status", ["scheduled", "postponed", "registration_open"])
      .gte("start_date", today)
      .gte("created_at", since.toISOString())
      .limit(800),
  ]);

  const alerts = ((alertRows ?? []) as unknown as AlertRow[]).map(toAlert);
  const emails = new Map<string, string>();
  const busyByUser = new Map<string, number[]>();
  for (const row of (alertRows ?? []) as unknown as AlertRow[]) {
    const profile = unwrap(row.profile);
    const email = profile?.email;
    if (email) emails.set(row.user_id, email);
    busyByUser.set(row.user_id, parseWeekdays(profile?.busy_weekdays));
  }
  const candidates = ((eventRows ?? []) as unknown as Parameters<typeof toCandidate>[0][]).map(toCandidate);

  if (alerts.length === 0 || candidates.length === 0) {
    return { alerts: alerts.length, candidates: candidates.length, matched: 0, emailed: 0 };
  }

  const { data: existing } = await supabase
    .from("race_alert_deliveries")
    .select("alert_id, event_id")
    .in(
      "alert_id",
      alerts.map((a) => a.id),
    );
  const seen = new Set((existing ?? []).map((d) => `${d.alert_id}:${d.event_id}`));

  const pending: { alert: RaceAlert; match: AlertMatch; email: string | null }[] = [];
  for (const alert of alerts) {
    const email = emails.get(alert.userId) ?? null;
    for (const event of candidates) {
      const key = `${alert.id}:${event.id}`;
      if (seen.has(key)) continue;
      const hit = matchAlert(alert, event, today, busyByUser.get(alert.userId) ?? []);
      if (!hit) continue;
      pending.push({ alert, match: hit, email });
    }
  }

  if (pending.length === 0) {
    return { alerts: alerts.length, candidates: candidates.length, matched: 0, emailed: 0 };
  }

  const { error: insertError } = await supabase.from("race_alert_deliveries").upsert(
    pending.map((p) => ({
      alert_id: p.alert.id,
      event_id: p.match.event.id,
      distance_km: Math.round(p.match.km * 10) / 10,
    })),
    { onConflict: "alert_id,event_id", ignoreDuplicates: true },
  );
  if (insertError) {
    console.error("race_alert_deliveries insert", insertError.message);
  }

  const grouped = new Map<string, { alert: RaceAlert; email: string; matches: AlertMatch[] }>();
  for (const p of pending) {
    if (!p.email) continue;
    const g = grouped.get(p.alert.id) ?? { alert: p.alert, email: p.email, matches: [] };
    g.matches.push(p.match);
    grouped.set(p.alert.id, g);
  }

  let emailed = 0;
  const emailedIds: string[] = [];
  for (const g of grouped.values()) {
    g.matches.sort((a, b) => a.event.startDate.localeCompare(b.event.startDate) || a.km - b.km);
    const mail = emailHtml(g.alert.locale || "cs", g.alert, g.matches);
    const ok = await sendResendEmail({
      to: g.email,
      subject: mail.subject,
      html: mail.html,
      idempotencyKey: `race-alert/${g.alert.id}/${today}/${g.matches.map((m) => m.event.id).join(",")}`,
    });
    if (ok) {
      emailed += 1;
      emailedIds.push(g.alert.id);
    }
  }

  if (emailedIds.length > 0) {
    const stamp = new Date().toISOString();
    await supabase
      .from("race_alert_deliveries")
      .update({ emailed_at: stamp })
      .in("alert_id", emailedIds)
      .is("emailed_at", null);
  }

  return {
    alerts: alerts.length,
    candidates: candidates.length,
    matched: pending.length,
    emailed,
  };
}

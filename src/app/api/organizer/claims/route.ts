import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, serverError } from "@/lib/api/respond";
import { parseJson } from "@/lib/api/validate";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireSessionUser } from "@/lib/supabase/user-server";
import { clientIp, rateLimit } from "@/lib/security";
import { emailMatchesSite, organizerDb, syncBadge, type OrganizerClaim } from "@/lib/organizer";
import { refreshOrganizerPages } from "@/lib/organizer-publish";

const bodySchema = z.object({
  kind: z.enum(["race", "series"]),
  slug: z.string().trim().min(1).max(200),
  note: z
    .unknown()
    .optional()
    .transform((v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 2000) : null)),
});

type Target = { id: string; name: string; slug: string; website_url: string | null };

/** This account's claims, each with the race or series it is for. */
export async function GET() {
  const user = await requireSessionUser();
  if (!user) return apiError(401, "Sign in first");
  const { data: claims, error } = await organizerDb()
    .from("organizer_claims")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return serverError("reading organiser claims failed", error);

  const supabase = createServerSupabase();
  const eventIds = (claims ?? []).map((c) => c.event_id).filter((id): id is string => Boolean(id));
  const seriesIds = (claims ?? []).map((c) => c.series_id).filter((id): id is string => Boolean(id));
  const [{ data: events }, { data: series }] = await Promise.all([
    eventIds.length
      ? supabase.from("events").select("id, name, slug, start_date").in("id", eventIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string; start_date: string }[] }),
    seriesIds.length
      ? supabase.from("series").select("id, name, slug").in("id", seriesIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
  ]);
  // The rounds a series claim lets its organiser edit, upcoming first.
  const { data: rounds } = seriesIds.length
    ? await supabase
        .from("events")
        .select("id, name, slug, start_date, series_id")
        .in("series_id", seriesIds)
        .eq("visibility", "public")
        .gte("start_date", new Date().toISOString().slice(0, 10))
        .order("start_date")
        .limit(200)
    : { data: [] as { id: string; name: string; slug: string; start_date: string; series_id: string | null }[] };

  return NextResponse.json({
    email: user.email ?? null,
    claims: (claims ?? []).map((c: OrganizerClaim) => ({
      id: c.id,
      kind: c.event_id ? "race" : "series",
      status: c.status,
      method: c.method,
      createdAt: c.created_at,
      target: c.event_id ? events?.find((e) => e.id === c.event_id) ?? null : series?.find((s) => s.id === c.series_id) ?? null,
      rounds: c.series_id ? (rounds ?? []).filter((r) => r.series_id === c.series_id) : [],
    })),
  });
}

/** Claims a race or series: verified at once on the race website's own domain, otherwise sent for approval. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`organizer-claim:${clientIp(req)}`, 10, 60_000)) return apiError(429, "Too many requests");
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { kind, slug, note } = parsed.data;

  const user = await requireSessionUser();
  if (!user?.email) return apiError(401, "Sign in first");

  const supabase = createServerSupabase();
  const { data: target, error: targetError } = await (kind === "race"
    ? supabase.from("events").select("id, name, slug, website_url").eq("slug", slug).eq("visibility", "public").maybeSingle()
    : supabase.from("series").select("id, name, slug, website_url").eq("slug", slug).eq("visibility", "public").maybeSingle());
  if (targetError) return serverError("reading claim target failed", targetError);
  if (!target) return apiError(404, "Not found");
  const t = target as Target;

  const db = organizerDb();
  const column = kind === "race" ? "event_id" : "series_id";
  const { data: existing, error: existingError } = await db.from("organizer_claims").select("*").eq("user_id", user.id).eq(column, t.id).maybeSingle();
  if (existingError) return serverError("reading organiser claim failed", existingError);
  // Only an explicit owner decision may restore rejected or revoked access.
  // Repeating this request must never re-run automatic domain approval.
  if (existing) {
    return NextResponse.json({ id: existing.id, status: existing.status }, { status: existing.status === "rejected" || existing.status === "revoked" ? 403 : 200 });
  }

  // Google signs in only with a confirmed address; anything else must have confirmed it.
  const confirmed = Boolean(user.email_confirmed_at) || user.app_metadata?.provider === "google";
  const verified = confirmed && emailMatchesSite(user.email, t.website_url);
  const row = {
    user_id: user.id,
    event_id: kind === "race" ? t.id : null,
    series_id: kind === "series" ? t.id : null,
    status: verified ? ("verified" as const) : ("pending" as const),
    method: verified ? ("email_domain" as const) : null,
    contact_email: user.email,
    note,
    created_at: new Date().toISOString(),
    decided_at: verified ? new Date().toISOString() : null,
  };
  const { data: claim, error } = await db.from("organizer_claims").insert(row).select("id, status").single();
  if (error || !claim) return serverError("saving organiser claim failed", error);

  if (verified) {
    await syncBadge(kind === "race" ? { eventId: t.id } : { seriesId: t.id });
    await refreshOrganizerPages(kind === "race" ? [t.slug] : [], kind === "series" ? [t.slug] : []);
  } else {
    await supabase.from("admin_notifications").insert({
      kind: "organizer_claim",
      title: kind === "series" ? `Organiser claims series: ${t.name}` : `Organiser claims race: ${t.name}`,
      body: `${user.email}${note ? ` — ${note}` : ""}`,
      payload: { claimId: claim.id, kind, slug: t.slug, website: t.website_url, email: user.email },
    });
  }
  return NextResponse.json({ id: claim.id, status: claim.status });
}

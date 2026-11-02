import { createServerSupabase } from "@/lib/supabase/server";
import { SubmissionsInbox } from "@/components/admin/submissions-inbox";
import { OrganizerClaimsInbox, type PendingClaim } from "@/components/admin/organizer-claims-inbox";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { organizerDb } from "@/lib/organizer";

/** Organiser claims still waiting, each with the race or series and its website. */
async function pendingClaims(): Promise<PendingClaim[]> {
  const { data: claims } = await organizerDb()
    .from("organizer_claims")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);
  if (!claims?.length) return [];
  const supabase = createServerSupabase();
  const eventIds = claims.map((c) => c.event_id).filter((id): id is string => Boolean(id));
  const seriesIds = claims.map((c) => c.series_id).filter((id): id is string => Boolean(id));
  const [{ data: events }, { data: series }] = await Promise.all([
    supabase.from("events").select("id, name, slug, website_url").in("id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("series").select("id, name, slug, website_url").in("id", seriesIds.length ? seriesIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  return claims.flatMap((c) => {
    const target = c.event_id ? events?.find((e) => e.id === c.event_id) : series?.find((s) => s.id === c.series_id);
    if (!target) return [];
    return [{
      id: c.id,
      email: c.contact_email,
      note: c.note,
      createdAt: c.created_at,
      kind: c.event_id ? ("race" as const) : ("series" as const),
      name: target.name,
      slug: target.slug,
      website: target.website_url,
    }];
  });
}

export default async function AdminInboxPage() {
  await requireAdminPage();
  const supabase = createServerSupabase();
  const [{ data: notes }, { data: subs }, { data: feedback }, claims] = await Promise.all([
    supabase
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("race_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("feedback_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    pendingClaims().catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Organiser claims, feature requests, race URLs, and notifications.
        </p>
      </div>
      <OrganizerClaimsInbox claims={claims} />
      <SubmissionsInbox
        notifications={notes ?? []}
        submissions={subs ?? []}
        feedback={feedback ?? []}
      />
    </div>
  );
}

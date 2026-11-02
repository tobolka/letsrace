import { createServerSupabase } from "@/lib/supabase/server";
import { SubmissionsInbox } from "@/components/admin/submissions-inbox";
import { OrganizerClaimsInbox, type PendingClaim } from "@/components/admin/organizer-claims-inbox";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { organizerDb } from "@/lib/organizer";
import { ProposalsInbox, type PendingProposal } from "@/components/admin/proposals-inbox";

const PROPOSAL_FIELDS: [string, string, string][] = [
  ["name", "name", "Name"],
  ["startDate", "start_date", "Start"],
  ["endDate", "end_date", "End"],
  ["status", "status", "Status"],
  ["websiteUrl", "website_url", "Website"],
  ["registrationUrl", "registration_url", "Entries"],
  ["regulationsUrl", "regulations_url", "Regulations"],
  ["registrationClosesAt", "registration_closes_at", "Entry deadline"],
  ["description", "description", "Description"],
];

type Cat = { name: string; distanceKm?: number | null; distance_km?: number | null; ageMin?: number | null; age_min?: number | null; ageMax?: number | null; age_max?: number | null };
const categoriesText = (rows: Cat[] | null | undefined) =>
  (rows ?? [])
    .map((c) => {
      const km = c.distanceKm ?? c.distance_km;
      const lo = c.ageMin ?? c.age_min;
      const hi = c.ageMax ?? c.age_max;
      return [c.name, km != null ? `${km} km` : null, lo != null || hi != null ? `${lo ?? ""}–${hi ?? ""} y` : null].filter(Boolean).join(" ");
    })
    .join("; ");
const text = (v: unknown) => (v == null ? "" : String(v).slice(0, 400));

/** Readers' proposals still waiting, each as the rows it would change. */
async function pendingProposals(): Promise<PendingProposal[]> {
  const supabase = createServerSupabase();
  const { data: notes } = await supabase
    .from("admin_notifications")
    .select("id, title, created_at, payload")
    .eq("kind", "race_proposal")
    .order("created_at", { ascending: true })
    .limit(50);
  const pending = (notes ?? []).filter((n) => (n.payload as { status?: string } | null)?.status === "pending");
  const eventIds = pending.map((n) => (n.payload as { eventId?: string }).eventId).filter((id): id is string => Boolean(id));
  const { data: events } = eventIds.length
    ? await supabase.from("events").select("id, slug, name, start_date, end_date, status, website_url, registration_url, regulations_url, registration_closes_at, description, categories:event_categories(name, distance_km, age_min, age_max)").in("id", eventIds)
    : { data: [] };
  return pending.map((n) => {
    const p = n.payload as Record<string, unknown>;
    if (p.action === "edit") {
      const changes = p.changes as Record<string, unknown>;
      const current = (events ?? []).find((e) => e.id === p.eventId) as Record<string, unknown> | undefined;
      const rows = PROPOSAL_FIELDS.filter(([key]) => key in changes).map(([key, column, label]) => ({ field: label, before: text(current?.[column]), after: text(changes[key]) }));
      if (changes.categories) rows.push({ field: "Routes & categories", before: categoriesText(current?.categories as Cat[]), after: categoriesText(changes.categories as Cat[]) });
      return { id: n.id, title: n.title, email: (p.email as string) ?? null, createdAt: n.created_at, action: "edit" as const, slug: (p.slug as string) ?? null, rows: rows.filter((r) => r.before !== r.after) };
    }
    const race = p.race as Record<string, unknown>;
    const place = race.place as { name?: string; countryCode?: string } | undefined;
    const rows = [
      ...PROPOSAL_FIELDS.filter(([key]) => race[key] != null).map(([key, , label]) => ({ field: label, before: "", after: text(race[key]) })),
      { field: "Place", before: "", after: [place?.name, place?.countryCode].filter(Boolean).join(", ") },
      { field: "Disciplines", before: "", after: ((race.disciplines as string[]) ?? []).join(", ") },
      ...(race.categories ? [{ field: "Routes & categories", before: "", after: categoriesText(race.categories as Cat[]) }] : []),
    ];
    return { id: n.id, title: n.title, email: (p.email as string) ?? null, createdAt: n.created_at, action: "create" as const, slug: null, rows };
  });
}

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
  const proposals = await pendingProposals().catch(() => []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Proposed changes, organiser claims, feature requests, race URLs, and notifications.
        </p>
      </div>
      <ProposalsInbox proposals={proposals} />
      <OrganizerClaimsInbox claims={claims} />
      <SubmissionsInbox
        notifications={notes ?? []}
        submissions={subs ?? []}
        feedback={feedback ?? []}
      />
    </div>
  );
}

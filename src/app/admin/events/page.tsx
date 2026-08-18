import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  AdminEventsTable,
  type AdminEventRow,
} from "@/components/admin/admin-events-table";
import { Button } from "@/components/ui/button";

export default async function EventsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const view = sp.view === "hidden" || sp.view === "all" ? sp.view : "visible";

  const supabase = createServerSupabase();
  let query = supabase
    .from("events")
    .select(
      "id, name, start_date, audience, source_kind, status, visibility, website_url, registration_url, location:locations(name, country_code)",
    )
    .order("start_date", { ascending: true })
    .limit(200);

  if (view === "hidden") query = query.eq("visibility", "hidden");
  else if (view === "visible") query = query.eq("visibility", "public");

  const { data: events } = await query;

  const rows: AdminEventRow[] = (events ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    start_date: e.start_date,
    audience: e.audience,
    source_kind: e.source_kind,
    status: e.status,
    visibility: e.visibility ?? "public",
    website_url: e.website_url ?? null,
    registration_url: e.registration_url ?? null,
    location: (e.location as AdminEventRow["location"]) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">
            Hide camps and non-races from the map, or bring them back
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">Add event</Link>
        </Button>
      </div>
      <AdminEventsTable events={rows} filter={view} />
    </div>
  );
}

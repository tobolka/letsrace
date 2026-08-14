import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  AdminEventsTable,
  type AdminEventRow,
} from "@/components/admin/admin-events-table";

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
      "id, name, start_date, audience, source_kind, status, visibility, location:locations(name, country_code)",
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
    location: (e.location as AdminEventRow["location"]) ?? null,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-sans text-3xl font-semibold tracking-tight">Events</h1>
          <p className="text-sm text-stone-500">
            Hide camps and non-races from the map, or bring them back
          </p>
        </div>
        <Link
          href="/admin/events/new"
          className="rounded-md bg-stone-900 px-3 py-2 text-sm text-white hover:bg-stone-900"
        >
          Add event
        </Link>
      </div>
      <AdminEventsTable events={rows} filter={view} />
    </div>
  );
}

import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  AdminEventsTable,
  type AdminEventRow,
} from "@/components/admin/admin-events-table";
import { Button } from "@/components/ui/button";
import { computeMissing } from "@/lib/admin/data-quality";
import { AdminEventFilters } from "@/components/admin/admin-event-filters";

const PAGE_SIZE = 50;

/**
 * The page used to ask for the first 200 races by date with no filter at all,
 * which meant it always answered with the oldest rows in the table — every
 * visit opened on January 2025 and nothing you could do would reach the two
 * thousand races that are still to come. It is a page for finding one race, so
 * it now searches, starts on what is ahead, and pages.
 */
export default async function EventsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    when?: string;
    q?: string;
    page?: string;
    country?: string;
    discipline?: string;
    missing?: string;
  }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const view = sp.view === "hidden" || sp.view === "all" ? sp.view : "visible";
  const when = sp.when === "past" || sp.when === "all" ? sp.when : "upcoming";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const country = (sp.country ?? "").trim().toUpperCase();
  const discipline = (sp.discipline ?? "").trim();
  const missing = (sp.missing ?? "").trim();
  const today = new Date().toISOString().slice(0, 10);

  const supabase = createServerSupabase();
  let query = supabase
    .from("events")
    .select(
      `id, name, start_date, audience, source_kind, status, visibility, website_url, registration_url, disciplines, location_id, location:locations${
        country ? "!inner" : ""
      }(name, municipality, country_code, lat, lng)`,
      { count: "exact" },
    );

  if (view === "hidden") query = query.eq("visibility", "hidden");
  else if (view === "visible") query = query.eq("visibility", "public");

  if (when === "upcoming") query = query.gte("start_date", today);
  else if (when === "past") query = query.lt("start_date", today);

  if (q) query = query.ilike("name", `%${q}%`);
  if (discipline) query = query.contains("disciplines", [discipline]);
  // The country lives on the joined row, so the join has to be an inner one —
  // otherwise the filter is silently ignored and every country comes back.
  if (country) query = query.eq("location.country_code", country);
  /*
   * The gaps you can ask the database for directly. "place" and "coords" are
   * conditions on the joined row, so they are read off the page below instead —
   * a filter that only narrows the current page is honest about what it does,
   * and it is what makes eighteen pages of hidden races into a job.
   */
  if (missing === "website") query = query.is("website_url", null);
  if (missing === "registration") query = query.is("registration_url", null);
  if (missing === "disciplines") query = query.eq("disciplines", "{}");
  if (missing === "coords") query = query.is("location_id", null);

  // Past races read newest-first: the one you want is the one that just ran.
  query = query
    .order("start_date", { ascending: when !== "past" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data: events, count } = await query;

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
    disciplines: (e.disciplines as string[]) ?? [],
    missing: computeMissing({
      location_id: e.location_id as string | null,
      website_url: e.website_url,
      registration_url: e.registration_url,
      disciplines: (e.disciplines as string[]) ?? null,
      location: (() => {
        const loc = e.location as AdminEventRow["location"];
        if (!loc) return null;
        return {
          name: loc.name ?? null,
          municipality: loc.municipality ?? null,
          lat: loc.lat ?? null,
          lng: loc.lng ?? null,
        };
      })(),
    }),
    location: (e.location as AdminEventRow["location"]) ?? null,
  }));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">
            Find a race, then hide it from the map or bring it back
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">Add event</Link>
        </Button>
      </div>
      <AdminEventFilters country={country} discipline={discipline} missing={missing} />
      <AdminEventsTable
        events={rows}
        filter={view}
        when={when}
        q={q}
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
      />
    </div>
  );
}

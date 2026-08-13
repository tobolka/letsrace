import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createServerSupabase } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/primitives";

export default async function EventsAdminPage() {
  await requireAdminPage();
  const supabase = createServerSupabase();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, start_date, audience, source_kind, status, location:locations(name, country_code)")
    .order("start_date", { ascending: true })
    .limit(100);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-sans tracking-tight text-3xl font-semibold">Events</h1>
          <p className="text-sm text-stone-500">Edit scraped data or open a race to fix fields</p>
        </div>
        <Link
          href="/admin/events/new"
          className="rounded-md bg-stone-900 px-3 py-2 text-sm text-white hover:bg-stone-900"
        >
          Add event
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-stone-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Place</th>
              <th className="px-3 py-2">Audience</th>
              <th className="px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((e) => {
              const loc = e.location as { name?: string; country_code?: string } | null;
              return (
                <tr key={e.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 whitespace-nowrap">{e.start_date}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/events/${e.id}`} className="font-medium text-stone-900 hover:underline">
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {loc?.name ?? "—"}
                    {loc?.country_code ? ` · ${loc.country_code}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    <Badge>{e.audience}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={e.source_kind === "manual" ? "bg-orange-100 text-orange-800" : ""}>
                      {e.source_kind}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

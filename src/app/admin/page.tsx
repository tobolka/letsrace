import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createServerSupabase } from "@/lib/supabase/server";
import { listIncompleteEvents } from "@/lib/admin/data-quality";
import { CompletenessDashboard } from "@/components/admin/completeness-dashboard";
import { Badge, Button } from "@/components/ui/primitives";

export default async function AdminHomePage() {
  await requireAdminPage();
  const supabase = createServerSupabase();

  const [{ count: sourceCount }, { count: pendingCount }, { data: recentRuns }, quality] =
    await Promise.all([
      supabase.from("watched_urls").select("*", { count: "exact", head: true }),
      supabase
        .from("discovered_links")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("ingest_runs")
        .select("id, ok, events_upserted, error, started_at, strategy")
        .order("started_at", { ascending: false })
        .limit(6),
      listIncompleteEvents({ upcomingOnly: true, limit: 500 }),
    ]);

  const { data: needsReview } = await supabase
    .from("watched_urls")
    .select("id, url, last_error, last_extract_status")
    .eq("status", "needs_review")
    .limit(8);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-stone-500">
            Fill missing race data — pin, place, website, discipline
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/events/new">
            <Button>Add event</Button>
          </Link>
          <Link href="/admin/events">
            <Button variant="outline">All events</Button>
          </Link>
          <form action="/api/admin/watch-now" method="post">
            <Button type="submit" variant="outline">
              Run watcher
            </Button>
          </form>
          <form action="/api/admin/geocode" method="post">
            <Button type="submit" variant="outline">
              Geocode pending
            </Button>
          </form>
        </div>
      </div>

      <CompletenessDashboard
        initialSummary={quality.summary}
        initialEvents={quality.events}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/discovery"
          className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50"
        >
          <p className="font-mono text-[10px] uppercase tracking-wide text-stone-500">
            Discovery queue
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
            {pendingCount ?? 0}
          </p>
        </Link>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <p className="font-mono text-[10px] uppercase tracking-wide text-stone-500">
            Watched URLs
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
            {sourceCount ?? 0}
          </p>
        </div>
      </div>

      {(needsReview?.length ?? 0) > 0 && (
        <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <h2 className="font-medium text-amber-900">Sources need review</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {needsReview!.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-100 text-amber-900">{w.last_extract_status}</Badge>
                <a
                  href={w.url}
                  className="text-amber-950 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {w.url}
                </a>
                <span className="text-amber-800">{w.last_error}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          Recent ingest
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-wide text-stone-500">
              <tr>
                <th className="py-1 pr-3">When</th>
                <th className="py-1 pr-3">OK</th>
                <th className="py-1 pr-3">Upserts</th>
                <th className="py-1 pr-3">Strategy</th>
                <th className="py-1">Error</th>
              </tr>
            </thead>
            <tbody>
              {(recentRuns ?? []).map((r) => (
                <tr key={r.id} className="border-t border-stone-100">
                  <td className="py-2 pr-3 font-mono text-xs">
                    {new Date(r.started_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3">{r.ok ? "✓" : "✗"}</td>
                  <td className="py-2 pr-3 font-mono">{r.events_upserted}</td>
                  <td className="py-2 pr-3">{r.strategy ?? "—"}</td>
                  <td className="py-2 text-red-600">{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

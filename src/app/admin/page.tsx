import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createServerSupabase } from "@/lib/supabase/server";
import { listIncompleteEvents } from "@/lib/admin/data-quality";
import { getIngestHealth, pct } from "@/lib/admin/ingest-health";
import { CompletenessDashboard } from "@/components/admin/completeness-dashboard";
import { Badge, Button } from "@/components/ui/primitives";

export default async function AdminHomePage() {
  await requireAdminPage();
  const supabase = createServerSupabase();

  const [{ count: sourceCount }, { count: pendingCount }, { data: recentRuns }, quality, health] =
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
      getIngestHealth(),
    ]);

  const { data: needsReview } = await supabase
    .from("watched_urls")
    .select("id, url, last_error, last_extract_status")
    .eq("status", "needs_review")
    .limit(8);

  const c = health.completeness;

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

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Catalog health
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Upcoming public races — ages · format · link · pin
            </p>
          </div>
          <p className="font-mono text-xs text-stone-500">
            7d ingest fail rate{" "}
            <span className="font-semibold text-stone-800">
              {pct(health.recentFails, health.recentRuns)}
            </span>{" "}
            ({health.recentFails}/{health.recentRuns})
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <HealthStat
            label="Ages known"
            value={pct(c.withAges, c.total)}
            sub={`${c.withAges}/${c.total}`}
          />
          <HealthStat
            label="Discipline"
            value={pct(c.withDisciplines, c.total)}
            sub={`${c.withDisciplines}/${c.total}`}
          />
          <HealthStat
            label="Website / reg"
            value={pct(c.withWebsiteOrReg, c.total)}
            sub={`${c.withWebsiteOrReg}/${c.total}`}
          />
          <HealthStat
            label="Registration URL"
            value={pct(c.withRegistration, c.total)}
            sub={`${c.withRegistration}/${c.total}`}
          />
          <HealthStat
            label="Map pin"
            value={pct(c.withCoords, c.total)}
            sub={`${c.withCoords}/${c.total}`}
          />
          <HealthStat
            label="Complete core"
            value={pct(c.completeCore, c.total)}
            sub={`${c.completeCore}/${c.total}`}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <HealthStat label="Sources active" value={String(health.sourceHealth.active)} />
          <HealthStat label="Needs review" value={String(health.sourceHealth.needsReview)} />
          <HealthStat label="Paused" value={String(health.sourceHealth.paused)} />
          <HealthStat label="With last error" value={String(health.sourceHealth.withError)} />
        </div>
        {health.adapterFailures.length > 0 ? (
          <div className="mt-5">
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              Adapter failures (7d)
            </h3>
            <ul className="mt-2 divide-y divide-stone-100">
              {health.adapterFailures.map((f) => (
                <li
                  key={`${f.strategy ?? "unknown"}-${f.lastAt}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                >
                  <span className="font-medium text-stone-800">{f.strategy || "unknown"}</span>
                  <span className="font-mono text-xs text-stone-500">{f.fails}×</span>
                  <p className="w-full truncate text-xs text-red-600">{f.lastError || "—"}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

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

function HealthStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2.5 ring-1 ring-stone-100">
      <p className="font-mono text-[10px] uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-stone-900">{value}</p>
      {sub ? <p className="font-mono text-[11px] text-stone-400">{sub}</p> : null}
    </div>
  );
}

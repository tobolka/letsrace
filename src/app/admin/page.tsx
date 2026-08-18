import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { createServerSupabase } from "@/lib/supabase/server";
import { listIncompleteEvents } from "@/lib/admin/data-quality";
import { getIngestHealth, pct } from "@/lib/admin/ingest-health";
import { CompletenessDashboard } from "@/components/admin/completeness-dashboard";
import { firstOpenableUrl, OpenUrlButton } from "@/components/admin/open-url";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TriangleAlert } from "lucide-react";

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
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Fill missing race data — pin, place, website, discipline
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/admin/events/new">Add event</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/events">All events</Link>
          </Button>
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

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Catalog health</CardTitle>
          <CardDescription>Upcoming public races — ages · format · link · pin</CardDescription>
          <CardAction>
            <p className="text-xs text-muted-foreground tabular-nums">
              7d ingest fail rate{" "}
              <span className="font-medium text-foreground">
                {pct(health.recentFails, health.recentRuns)}
              </span>{" "}
              ({health.recentFails}/{health.recentRuns})
            </p>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
          <div className="grid gap-3 sm:grid-cols-4">
            <HealthStat label="Sources active" value={String(health.sourceHealth.active)} />
            <HealthStat label="Needs review" value={String(health.sourceHealth.needsReview)} />
            <HealthStat label="Paused" value={String(health.sourceHealth.paused)} />
            <HealthStat label="With last error" value={String(health.sourceHealth.withError)} />
          </div>
          {health.adapterFailures.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adapter</TableHead>
                  <TableHead>Fails (7d)</TableHead>
                  <TableHead>Last error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {health.adapterFailures.map((f) => (
                  <TableRow key={`${f.strategy ?? "unknown"}-${f.lastAt}`}>
                    <TableCell className="font-medium">{f.strategy || "unknown"}</TableCell>
                    <TableCell className="tabular-nums">{f.fails}×</TableCell>
                    <TableCell className="text-destructive">{f.lastError || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <CompletenessDashboard initialSummary={quality.summary} initialEvents={quality.events} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/discovery">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardDescription>Discovery queue</CardDescription>
              <CardTitle className="tabular-nums">{pendingCount ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Card>
          <CardHeader>
            <CardDescription>Watched URLs</CardDescription>
            <CardTitle className="tabular-nums">{sourceCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {(needsReview?.length ?? 0) > 0 ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Sources need review</AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-2">
              {needsReview!.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{w.last_extract_status}</Badge>
                  <span className="min-w-0 break-all">{w.url}</span>
                  <OpenUrlButton href={firstOpenableUrl(w.url)} label="Open source URL" />
                  <span>{w.last_error}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent ingest</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>OK</TableHead>
                <TableHead>Upserts</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recentRuns ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular-nums">
                    {new Date(r.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.ok ? "secondary" : "destructive"}>{r.ok ? "OK" : "Fail"}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.events_upserted}</TableCell>
                  <TableCell>{r.strategy ?? "—"}</TableCell>
                  <TableCell className="text-destructive">{r.error ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="tabular-nums">{value}</CardTitle>
        {sub ? <CardDescription className="tabular-nums">{sub}</CardDescription> : null}
      </CardHeader>
    </Card>
  );
}

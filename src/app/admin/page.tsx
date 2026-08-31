import Link from "next/link";
import {
  CalendarRange,
  Flag,
  Inbox,
  MapPin,
  Play,
  Plus,
  Radar,
  TrendingDown,
} from "lucide-react";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { getAdminOverview } from "@/lib/admin/overview";
import { StalledSources } from "@/components/admin/stalled-sources";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

/** A thing waiting for a person, with somewhere to go and do it. */
function Queue({
  href,
  icon: Icon,
  label,
  count,
  hint,
}: {
  href: string;
  icon: typeof Inbox;
  label: string;
  count: number;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">{count}</span>
          <span className="text-sm font-medium">{label}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
    </Link>
  );
}

export default async function AdminHomePage() {
  await requireAdminPage();
  const o = await getAdminOverview();

  const monthMax = Math.max(1, ...o.forward.map((f) => f.races));
  const cliff = o.beyond90 < o.totals.publicUpcoming * 0.15;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Control room</h1>
          <p className="text-sm text-muted-foreground">
            {o.totals.publicUpcoming.toLocaleString()} upcoming races ·{" "}
            {o.totals.activeSources} active sources ·{" "}
            {o.failRate7d.runs > 0
              ? `${pct(o.failRate7d.fails, o.failRate7d.runs)}% run failures this week`
              : "no runs this week"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/admin/events/new">
              <Plus /> Add race
            </Link>
          </Button>
          <form action="/api/admin/watch-now" method="post">
            <Button type="submit" size="sm" variant="outline">
              <Play /> Run watcher
            </Button>
          </form>
          <form action="/api/admin/geocode" method="post">
            <Button type="submit" size="sm" variant="outline">
              <MapPin /> Geocode
            </Button>
          </form>
        </div>
      </div>

      {/* Silent failures first — everything else is visible on its own page. */}
      <StalledSources initial={o.stalled} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Queue
          href="/admin/discovery"
          icon={Radar}
          label="to triage"
          count={o.pendingDiscovery}
          hint="Discovered links awaiting a verdict"
        />
        <Queue
          href="/admin/inbox"
          icon={Inbox}
          label="from riders"
          count={o.openFeedback}
          hint="Corrections and submissions"
        />
        <Queue
          href="/admin/events?filter=incomplete"
          icon={Flag}
          label="incomplete"
          count={o.incompleteUpcoming}
          hint="Upcoming races missing a link or a pin"
        />
        <Queue
          href="/admin/sources"
          icon={CalendarRange}
          label="sources"
          count={o.totals.sources}
          hint={`${o.totals.activeSources} active`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              Forward calendar
              {cliff && (
                <Badge variant="secondary" className="gap-1">
                  <TrendingDown className="size-3" /> thin beyond 90 days
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {o.beyond90} of {o.totals.publicUpcoming} races are more than 90 days out — this is
              what someone planning next season sees.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-6">
            {o.forward.map((f) => (
              <div key={f.month} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {f.month}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm bg-primary/80"
                    style={{ width: `${Math.max(2, (f.races / monthMax) * 100)}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums">{f.races}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>Coverage by market</CardTitle>
            <CardDescription>Upcoming races with a usable link and a map pin.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-6">
            {o.coverage.map((c) => (
              <div key={c.code} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{c.code}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.upcoming} races · {pct(c.withLink, c.upcoming)}% linked ·{" "}
                    {pct(c.withPin, c.upcoming)}% pinned
                  </span>
                </div>
                <Progress value={pct(c.withPin, c.upcoming)} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {o.lastRun?.at && (
        <>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Last ingest run {new Date(o.lastRun.at).toLocaleString()} —{" "}
            {o.lastRun.ok === false ? "failed" : `${o.lastRun.upserted} races upserted`}
          </p>
        </>
      )}
    </div>
  );
}

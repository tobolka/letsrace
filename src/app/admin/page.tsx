import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Check,
  Flag,
  Inbox,
  MapPin,
  Play,
  Plus,
  Radar,
  TrendingDown,
} from "lucide-react";
import { requireAdminPage } from "@/lib/auth/require-admin-page";
import { getAdminOverview, type GrowthDay } from "@/lib/admin/overview";
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
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

/**
 * A thing waiting for a person, with somewhere to go and do it.
 *
 * An empty queue is drawn as clearly as a full one: the whole point of coming
 * here is to find out whether anything needs you, and a row of quiet zeros is
 * a good answer.
 */
function Queue({
  href,
  icon: Icon,
  label,
  count,
  hint,
  quiet,
}: {
  href: string;
  icon: typeof Inbox;
  label: string;
  count: number;
  hint: string;
  quiet?: string;
}) {
  const clear = count === 0;
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent",
        !clear && "border-foreground/15 bg-card shadow-xs",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          clear ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {clear && quiet ? <Check className="size-4" /> : <Icon className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-2xl font-semibold tabular-nums",
              clear && "text-muted-foreground",
            )}
          >
            {count}
          </span>
          <span className="text-sm font-medium">{label}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {clear && quiet ? quiet : hint}
        </span>
      </span>
    </Link>
  );
}

/** Fourteen days of arrivals. Bars, because the shape is the whole message. */
function Pulse({ days }: { days: GrowthDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.added));
  return (
    <div className="flex h-16 items-end gap-1">
      {days.map((d, i) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.added}`}
          className={cn(
            "min-w-0 flex-1 rounded-sm transition-colors",
            i >= days.length - 7 ? "bg-primary/80" : "bg-muted-foreground/25",
          )}
          style={{ height: `${Math.max(4, (d.added / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default async function AdminHomePage() {
  await requireAdminPage();
  const o = await getAdminOverview();

  const monthMax = Math.max(1, ...o.forward.map((f) => f.races));
  const cliff = o.beyond90 < o.totals.publicUpcoming * 0.15;
  const delta = o.growth.thisWeek - o.growth.lastWeek;

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

      {/* What needs a person, before anything that merely can be counted. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Queue
          href="/admin/discovery"
          icon={Radar}
          label="to triage"
          count={o.pendingDiscovery}
          hint="Discovered links awaiting a verdict"
          quiet="Every discovered link has a verdict"
        />
        <Queue
          href="/admin/inbox"
          icon={Inbox}
          label="from riders"
          count={o.openFeedback}
          hint="Corrections and submissions"
          quiet="Nothing unanswered"
        />
        <Queue
          href="/admin/events?filter=incomplete"
          icon={Flag}
          label="incomplete"
          count={o.incompleteUpcoming}
          hint="Upcoming races missing a link or a pin"
          quiet="Every upcoming race has a link and a pin"
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
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              New races
              <Badge variant={delta >= 0 ? "secondary" : "outline"} className="gap-1 tabular-nums">
                {delta >= 0 ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {delta >= 0 ? "+" : ""}
                {delta}
              </Badge>
            </CardTitle>
            <CardDescription>
              {o.growth.thisWeek.toLocaleString()} added in the last seven days, against{" "}
              {o.growth.lastWeek.toLocaleString()} the week before.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Pulse days={o.growth.days} />
            <p className="mt-2 text-xs text-muted-foreground">
              Solid bars are this week. Every one of them is a race someone can now find.
            </p>
          </CardContent>
        </Card>

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
      </div>

      {/* Silent failures: real, but not the first thing anyone can act on. */}
      <StalledSources initial={o.stalled} />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Coverage by market</CardTitle>
          <CardDescription>Upcoming races with a usable link and a map pin.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-4 pt-6 sm:grid-cols-2">
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

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, RefreshCw, Search } from "lucide-react";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

export type StalledRow = {
  id: string;
  url: string;
  kind: string;
  recordedState: string | null;
  lastError: string | null;
  daysSinceFetch: number | null;
  reason: string;
  liveRaces?: number;
};

const REASON_TONE: Record<string, "destructive" | "secondary" | "outline"> = {
  erroring: "destructive",
  "never read": "destructive",
  "not read recently": "secondary",
  "quiet but listing races": "outline",
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * One line per site, not per URL.
 *
 * A single calendar contributes dozens of rows — sumator.cz alone was 53 of the
 * 70 — and they fail together and are fixed together, so a wall of near
 * identical URLs asks the reader to do the grouping in their head. Worst first:
 * anything provably losing races, then whatever is largest.
 */
function groupByHost(rows: StalledRow[]) {
  const groups = new Map<string, StalledRow[]>();
  for (const row of rows) {
    const host = hostOf(row.url);
    const list = groups.get(host);
    if (list) list.push(row);
    else groups.set(host, [row]);
  }
  return [...groups.entries()]
    .map(([host, list]) => ({
      host,
      rows: list,
      liveRaces: list.reduce((n, r) => n + (r.liveRaces ?? 0), 0),
      neverRead: list.filter((r) => r.reason === "never read").length,
      erroring: list.filter((r) => r.reason === "erroring").length,
    }))
    .sort((a, b) => b.liveRaces - a.liveRaces || b.rows.length - a.rows.length);
}

/**
 * The panel the catalogue was missing.
 *
 * A source that breaks goes quiet, and the old dashboard counted quiet sources
 * as healthy — six were stalled at once while 57% of the Czech calendar went
 * missing. "Check now" asks each one what it really returns; anything that
 * answers with races is losing them.
 */
export function StalledSources({ initial }: { initial: StalledRow[] }) {
  const [rows, setRows] = useState<StalledRow[]>(initial);
  const [checking, setChecking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function checkAll() {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/source-health");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { verified: StalledRow[]; losing: number };
      setRows(data.verified);
      toast[data.losing ? "warning" : "success"](
        data.losing
          ? `${data.losing} source${data.losing === 1 ? "" : "s"} still listing races`
          : "No source is losing races",
      );
    } catch {
      toast.error("Check failed");
    } finally {
      setChecking(false);
    }
  }

  async function rerun(row: StalledRow) {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/source-health", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const data = (await res.json()) as { ok: boolean; upserted: number; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "failed");
      toast.success(`${hostOf(row.url)} — ${data.upserted} races ingested`);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      startTransition(() => {});
    } catch {
      toast.error(`${hostOf(row.url)} still failing`);
    } finally {
      setBusyId(null);
    }
  }

  const losing = rows.filter((r) => (r.liveRaces ?? 0) > 0);

  // A wall of seventy hosts used to be the first thing on the dashboard, above
  // everything that could actually be acted on. It says its size and stays shut
  // until asked.
  const hosts = groupByHost(rows);
  const summaryLine =
    hosts.length === 0
      ? ""
      : `${rows.length} across ${hosts.length} ${hosts.length === 1 ? "site" : "sites"} — ${hosts
          .slice(0, 3)
          .map((h) => h.host)
          .join(", ")}${hosts.length > 3 ? ` and ${hosts.length - 3} more` : ""}`;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600" />
          Stalled sources
          {rows.length > 0 && <Badge variant="secondary">{rows.length}</Badge>}
        </CardTitle>
        <CardDescription>
          Quiet sources look identical to finished seasons. Check what they actually return.
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={checkAll} disabled={checking}>
            {checking ? <Spinner /> : <Search />}
            Check now
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RefreshCw />
              </EmptyMedia>
              <EmptyTitle>Every calendar is being read</EmptyTitle>
              <EmptyDescription>Nothing has gone quiet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Collapsible open={listOpen} onOpenChange={setListOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 border-b px-6 py-3 text-left text-sm hover:bg-accent"
              >
                <ChevronRight
                  className={`size-4 shrink-0 transition-transform ${listOpen ? "rotate-90" : ""}`}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {listOpen ? "Hide the list" : summaryLine}
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
          <div className="divide-y">
            {groupByHost(rows).map((g) => (
              <Collapsible key={g.host} defaultOpen={groupByHost(rows).length <= 3}>
                <div className="flex items-center gap-2 px-6 py-3">
                  <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                    <span className="truncate font-medium">{g.host}</span>
                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                      {g.rows.length}
                    </span>
                    {g.erroring > 0 ? (
                      <Badge variant="destructive">{g.erroring} erroring</Badge>
                    ) : null}
                    {g.neverRead > 0 ? (
                      <Badge variant="secondary">{g.neverRead} never read</Badge>
                    ) : null}
                    {g.liveRaces > 0 ? (
                      <Badge className="bg-amber-600 text-white hover:bg-amber-600/90">
                        {g.liveRaces} races going missing
                      </Badge>
                    ) : null}
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="overflow-x-auto border-t bg-muted/30">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Address</TableHead>
                          <TableHead>Why</TableHead>
                          <TableHead className="text-right">Unread</TableHead>
                          <TableHead className="text-right">Live races</TableHead>
                          <TableHead className="w-px" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className={row.liveRaces ? "bg-amber-50/60 dark:bg-amber-950/20" : undefined}
                          >
                            <TableCell className="max-w-[26rem]">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-xs text-muted-foreground">{row.url}</span>
                                <a
                                  href={row.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 text-muted-foreground hover:text-foreground"
                                  aria-label={`Open ${row.url}`}
                                >
                                  <ExternalLink className="size-3.5" />
                                </a>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={REASON_TONE[row.reason] ?? "outline"}>{row.reason}</Badge>
                              {row.lastError && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="ml-1.5 cursor-help text-xs text-muted-foreground underline decoration-dotted">
                                      error
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">{row.lastError}</TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {row.daysSinceFetch == null ? "never" : `${row.daysSinceFetch}d`}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.liveRaces == null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : row.liveRaces > 0 ? (
                                <span className="font-semibold text-amber-700 dark:text-amber-500">
                                  {row.liveRaces}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant={row.liveRaces ? "default" : "ghost"}
                                onClick={() => rerun(row)}
                                disabled={busyId === row.id}
                              >
                                {busyId === row.id ? <Spinner /> : <RefreshCw />}
                                Re-read
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
      {losing.length > 0 && (
        <div className="border-t px-6 py-3 text-sm">
          <span className="font-medium text-amber-700 dark:text-amber-500">
            {losing.reduce((n, r) => n + (r.liveRaces ?? 0), 0)} races
          </span>{" "}
          <span className="text-muted-foreground">
            are listed by sources the catalogue is not reading.
          </span>
        </div>
      )}
    </Card>
  );
}

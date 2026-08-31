"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ExternalLink,
  Eye,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Source = {
  id: string;
  url: string;
  kind: string;
  status: string;
  http_status: number | null;
  last_fetched_at: string | null;
  last_extract_status: string | null;
  last_error: string | null;
  next_poll_at: string;
};

type Health = "broken" | "quiet" | "ok" | "paused";

/**
 * How worried should someone be about this row?
 *
 * The old table showed `status` — which is "active" for a source that has been
 * failing for a month, because status only records whether we intend to poll
 * it. Health is about whether polling is achieving anything.
 */
function healthOf(s: Source): Health {
  if (s.status !== "active") return "paused";
  if (s.last_error || s.last_extract_status === "error") return "broken";
  if (!s.last_fetched_at) return "quiet";
  const days = (Date.now() - Date.parse(s.last_fetched_at)) / 86_400_000;
  if (days >= 10) return "quiet";
  if (s.last_extract_status === "off_season" || s.last_extract_status === "needs_review") {
    return "quiet";
  }
  return "ok";
}

const HEALTH_RANK: Record<Health, number> = { broken: 0, quiet: 1, ok: 2, paused: 3 };
const HEALTH_LABEL: Record<Health, string> = {
  broken: "Broken",
  quiet: "Quiet",
  ok: "Healthy",
  paused: "Paused",
};
const HEALTH_TONE: Record<Health, "destructive" | "secondary" | "outline"> = {
  broken: "destructive",
  quiet: "secondary",
  ok: "outline",
  paused: "outline",
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ago(iso: string | null) {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export function SourcesManager({ initialSources }: { initialSources: Source[] }) {
  const router = useRouter();
  const [urls, setUrls] = useState("");
  const [kind, setKind] = useState("race");
  const [preview, setPreview] = useState<unknown>(null);
  const [previewTarget, setPreviewTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [rerunning, setRerunning] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Health | "all">("all");

  const counts = useMemo(() => {
    const c: Record<Health, number> = { broken: 0, quiet: 0, ok: 0, paused: 0 };
    for (const s of initialSources) c[healthOf(s)] += 1;
    return c;
  }, [initialSources]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialSources
      .map((s) => ({ s, health: healthOf(s) }))
      .filter(({ s, health }) => {
        if (filter !== "all" && health !== filter) return false;
        if (!q) return true;
        return s.url.toLowerCase().includes(q) || s.kind.toLowerCase().includes(q);
      })
      .sort(
        (a, b) =>
          HEALTH_RANK[a.health] - HEALTH_RANK[b.health] ||
          a.s.url.localeCompare(b.s.url),
      )
      .slice(0, 300);
  }, [initialSources, query, filter]);

  async function addSources() {
    setBusy(true);
    const list = urls.split("\n").map((u) => u.trim()).filter(Boolean);
    const res = await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls: list, kind }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`Watching ${list.length} URL${list.length === 1 ? "" : "s"}`);
      setUrls("");
      router.refresh();
    } else {
      toast.error("Could not add those URLs");
    }
  }

  async function runPreview() {
    setBusy(true);
    const res = await fetch("/api/admin/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: previewTarget }),
    });
    setPreview(await res.json());
    setBusy(false);
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/admin/sources", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    router.refresh();
  }

  /** Re-read now, ignoring the stored content hash. */
  async function rerun(s: Source) {
    setRerunning(s.id);
    try {
      const res = await fetch("/api/admin/source-health", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: s.id }),
      });
      const data = (await res.json()) as { ok: boolean; upserted: number; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "failed");
      toast.success(`${hostOf(s.url)} — ${data.upserted} races`);
      router.refresh();
    } catch {
      toast.error(`${hostOf(s.url)} still failing`);
    } finally {
      setRerunning(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-fit">
            <Plus /> Add sources or preview a URL <ChevronDown />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Watch new URLs</CardTitle>
                <CardDescription>One per line. Calendars beat single races.</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="kind">Kind</FieldLabel>
                    <Select value={kind} onValueChange={setKind}>
                      <SelectTrigger id="kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {["race", "series", "federation", "aggregator", "calendar"].map((k) => (
                            <SelectItem key={k} value={k}>
                              {k}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="urls">URLs</FieldLabel>
                    <Textarea
                      id="urls"
                      value={urls}
                      onChange={(e) => setUrls(e.target.value)}
                      placeholder="https://example.com/kalendar-2026"
                    />
                  </Field>
                  <Button onClick={addSources} disabled={busy || !urls.trim()}>
                    {busy ? <Spinner /> : null}
                    Watch these URLs
                  </Button>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Extraction preview</CardTitle>
                <CardDescription>Parse a URL without adding it.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Input
                    value={previewTarget}
                    onChange={(e) => setPreviewTarget(e.target.value)}
                    placeholder="https://…"
                  />
                  <Button variant="outline" onClick={runPreview} disabled={busy || !previewTarget}>
                    {busy ? <Spinner /> : <Eye />}
                    Preview
                  </Button>
                </div>
                <ScrollArea className="h-64 rounded-lg bg-muted">
                  <pre className="p-3 text-xs">
                    {preview ? JSON.stringify(preview, null, 2) : "Run a preview to see parsed races"}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by host or kind…"
            className="pl-8"
          />
        </div>
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => setFilter((v || "all") as Health | "all")}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all">All {initialSources.length}</ToggleGroupItem>
          <ToggleGroupItem value="broken">Broken {counts.broken}</ToggleGroupItem>
          <ToggleGroupItem value="quiet">Quiet {counts.quiet}</ToggleGroupItem>
          <ToggleGroupItem value="ok">Healthy {counts.ok}</ToggleGroupItem>
          <ToggleGroupItem value="paused">Paused {counts.paused}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {visible.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nothing matches</EmptyTitle>
            <EmptyDescription>Clear the filter or paste new URLs above.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Last read</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map(({ s, health }) => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-[26rem]">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{hostOf(s.url)}</span>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{s.url}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={HEALTH_TONE[health]}>{HEALTH_LABEL[health]}</Badge>
                      {s.last_error && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help text-xs text-muted-foreground underline decoration-dotted">
                              why
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">{s.last_error}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {s.last_extract_status && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.last_extract_status}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{s.kind}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {ago(s.last_fetched_at)}
                    {s.http_status ? <> · {s.http_status}</> : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rerun(s)}
                        disabled={rerunning === s.id}
                      >
                        {rerunning === s.id ? <Spinner /> : <RefreshCw />}
                        Re-read
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus(s.id, s.status === "active" ? "paused" : "active")}
                      >
                        {s.status === "active" ? <Pause /> : <Play />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {visible.length === 300 && (
        <p className="text-xs text-muted-foreground">
          Showing the first 300 — narrow the filter to see more.
        </p>
      )}
    </div>
  );
}

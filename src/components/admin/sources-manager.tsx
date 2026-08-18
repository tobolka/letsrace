"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { firstOpenableUrl, OpenUrlButton, UrlInput } from "@/components/admin/open-url";

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

export function SourcesManager({ initialSources }: { initialSources: Source[] }) {
  const router = useRouter();
  const [urls, setUrls] = useState("");
  const [kind, setKind] = useState("race");
  const [preview, setPreview] = useState<unknown>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function addSources() {
    setBusy(true);
    const list = urls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    const res = await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: list, kind }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Failed to add sources");
      return;
    }
    setUrls("");
    toast.success(`Added ${list.length} URL(s)`);
    router.refresh();
  }

  async function runPreview() {
    if (!previewUrl) return;
    setBusy(true);
    const res = await fetch("/api/admin/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: previewUrl }),
    });
    setPreview(await res.json());
    setBusy(false);
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/admin/sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add URLs</CardTitle>
            <CardDescription>One URL per line. The watcher keeps them fresh.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="kind">Kind</FieldLabel>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger id="kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="federation">Federation</SelectItem>
                      <SelectItem value="aggregator">Aggregator</SelectItem>
                      <SelectItem value="series">Series</SelectItem>
                      <SelectItem value="race">Single race</SelectItem>
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
                  placeholder="https://example.com/race-2026"
                />
              </Field>
              <Button onClick={addSources} disabled={busy || !urls.trim()}>
                {busy ? <Spinner data-icon="inline-start" /> : null}
                Watch these URLs
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Extraction preview</CardTitle>
            <CardDescription>Parse a URL without adding it as a source.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <UrlInput
                value={previewUrl}
                onChange={setPreviewUrl}
                openLabel="Open preview URL"
              />
              <Button variant="outline" onClick={runPreview} disabled={busy}>
                {busy ? <Spinner data-icon="inline-start" /> : null}
                Preview
              </Button>
            </div>
            <ScrollArea className="h-72 rounded-lg bg-muted">
              <pre className="p-3 text-xs">
                {preview ? JSON.stringify(preview, null, 2) : "Run preview to see parsed events"}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {initialSources.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No sources yet</EmptyTitle>
            <EmptyDescription>Paste federation or race URLs above to start watching.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialSources.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-start gap-1">
                    <span className="min-w-0 break-all">{s.url}</span>
                    <OpenUrlButton href={firstOpenableUrl(s.url)} label="Open source URL" />
                  </div>
                  {s.last_error ? (
                    <p className="mt-1 text-xs text-destructive">{s.last_error}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{s.kind}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={s.status === "needs_review" ? "destructive" : "outline"}>
                    {s.status}
                  </Badge>
                  {s.last_extract_status ? (
                    <p className="mt-1 text-xs text-muted-foreground">{s.last_extract_status}</p>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {s.last_fetched_at ? new Date(s.last_fetched_at).toLocaleString() : "never"}
                  {s.http_status ? ` · HTTP ${s.http_status}` : ""}
                </TableCell>
                <TableCell>
                  <ButtonGroup orientation="vertical">
                    <Button size="sm" variant="outline" onClick={() => setStatus(s.id, "paused")}>
                      Pause
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(s.id, "active")}>
                      Resume
                    </Button>
                  </ButtonGroup>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

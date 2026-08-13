"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, Label, Textarea } from "@/components/ui/primitives";

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
  const [message, setMessage] = useState("");

  async function addSources() {
    setBusy(true);
    setMessage("");
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
      setMessage("Failed to add sources");
      return;
    }
    setUrls("");
    setMessage(`Added ${list.length} URL(s)`);
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
    <div className="space-y-6">
      <section className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-medium">Add URLs</h2>
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <select
              className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="federation">Federation</option>
              <option value="aggregator">Aggregator</option>
              <option value="series">Series</option>
              <option value="race">Single race</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>URLs (one per line)</Label>
            <Textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://example.com/race-2026"
            />
          </div>
          <Button onClick={addSources} disabled={busy || !urls.trim()}>
            {busy ? "Saving…" : "Watch these URLs"}
          </Button>
          {message && <p className="text-sm text-stone-900">{message}</p>}
        </div>

        <div className="space-y-3">
          <h2 className="font-medium">Extraction preview</h2>
          <div className="flex gap-2">
            <Input
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              placeholder="https://…"
            />
            <Button variant="outline" onClick={runPreview} disabled={busy}>
              Preview
            </Button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-lg bg-stone-950 p-3 text-xs text-stone-100">
            {preview ? JSON.stringify(preview, null, 2) : "Run preview to see parsed events"}
          </pre>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-stone-500">
            <tr>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialSources.map((s) => (
              <tr key={s.id} className="border-t border-stone-100 align-top">
                <td className="px-3 py-2">
                  <a href={s.url} className="break-all text-stone-900 underline" target="_blank" rel="noreferrer">
                    {s.url}
                  </a>
                  {s.last_error && <p className="mt-1 text-xs text-red-600">{s.last_error}</p>}
                </td>
                <td className="px-3 py-2">{s.kind}</td>
                <td className="px-3 py-2">
                  <Badge>{s.status}</Badge>
                  {s.last_extract_status && (
                    <div className="mt-1 text-xs text-stone-500">{s.last_extract_status}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-stone-500">
                  {s.last_fetched_at ? new Date(s.last_fetched_at).toLocaleString() : "never"}
                  {s.http_status ? ` · HTTP ${s.http_status}` : ""}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => setStatus(s.id, "paused")}>
                      Pause
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(s.id, "active")}>
                      Resume
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

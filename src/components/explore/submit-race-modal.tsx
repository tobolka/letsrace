"use client";

import { useState } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui/primitives";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SubmitRaceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    const supabase = createBrowserSupabase();
    const { data: auth } = await supabase.auth.getUser();
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        note,
        userId: auth.user?.id ?? null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setStatus("Could not submit — try again");
      return;
    }
    setStatus("Thanks! Admins will review this URL.");
    setUrl("");
    setNote("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="font-sans tracking-tight text-xl font-semibold">Report a race</h2>
        <p className="mt-1 text-sm text-stone-500">
          Paste the official race URL. We&apos;ll queue it for admins and start watching it after
          approval.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label>Race URL</Label>
            <Input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kids race near Cheb…" />
          </div>
          {status && <p className="text-sm text-stone-900">{status}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Submit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

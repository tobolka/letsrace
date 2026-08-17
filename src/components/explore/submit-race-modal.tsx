"use client";

import { useState } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui/primitives";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Messages } from "@/lib/i18n/messages";

export function SubmitRaceModal({
  open,
  onClose,
  messages,
}: {
  open: boolean;
  onClose: () => void;
  messages: Messages;
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
        url: url.trim(),
        note: note.trim(),
        userId: auth.user?.id ?? null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setStatus(messages.submitFailed);
      return;
    }
    setStatus(messages.submitThanks);
    setUrl("");
    setNote("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 overscroll-contain">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="font-sans tracking-tight text-xl font-semibold">{messages.reportRace}</h2>
        <p className="mt-1 text-sm text-stone-500">{messages.submitRaceHelp}</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="missing-race-url">{messages.raceUrl}</Label>
            <Input
              id="missing-race-url"
              required
              type="url"
              name="url"
              autoComplete="url"
              inputMode="url"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="missing-race-note">{messages.optionalNote}</Label>
            <Textarea
              id="missing-race-note"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Kids race near Cheb…"
            />
          </div>
          {status ? (
            <p className="text-sm text-stone-900" aria-live="polite">
              {status}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {messages.close}
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {messages.submit}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

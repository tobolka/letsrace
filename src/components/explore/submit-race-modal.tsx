"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url.trim(),
        note: note.trim(),
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="overscroll-contain">
        <DialogHeader>
          <DialogTitle>{messages.reportRace}</DialogTitle>
          <DialogDescription>{messages.submitRaceHelp}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-2">
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
            <p className="text-sm" aria-live="polite">
              {status}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {messages.close}
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {messages.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Trophy, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Messages } from "@/lib/i18n/messages";

type Kind = "race" | "series";

/**
 * Point us at a race we are missing — or a whole series, whose calendar page
 * carries every round at once. The two need different pages and different
 * work on our side, so the form asks which it is first and words the rest to
 * match.
 */
export function SubmitRaceModal({
  open,
  onClose,
  messages,
}: {
  open: boolean;
  onClose: () => void;
  messages: Messages;
}) {
  const [kind, setKind] = useState<Kind>("race");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const series = kind === "series";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, url: url.trim(), note: note.trim() }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setStatus(messages.submitFailed);
      return;
    }
    setStatus(messages.submitThanks);
    setUrl("");
    setNote("");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="overscroll-contain sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{messages.reportRaceOrSeries}</DialogTitle>
          <DialogDescription>{series ? messages.submitRaceHelpSeries : messages.submitRaceHelpRace}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel>{messages.submitKindLabel}</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value={kind}
                onValueChange={(v) => v && setKind(v as Kind)}
                className="w-full"
              >
                <ToggleGroupItem value="race" className="flex-1 data-[state=on]:bg-foreground data-[state=on]:text-background">
                  <Flag data-icon="inline-start" />
                  {messages.submitKindRace}
                </ToggleGroupItem>
                <ToggleGroupItem value="series" className="flex-1 data-[state=on]:bg-foreground data-[state=on]:text-background">
                  <Trophy data-icon="inline-start" />
                  {messages.submitKindSeries}
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="missing-race-url">{series ? messages.raceUrlSeries : messages.raceUrl}</FieldLabel>
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
            </Field>
            <Field>
              <FieldLabel htmlFor="missing-race-note">{messages.optionalNote}</FieldLabel>
              <Textarea
                id="missing-race-note"
                name="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={series ? messages.submitNotePlaceholderSeries : messages.submitNotePlaceholderRace}
              />
            </Field>
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
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Trophy, Flag, PencilLine } from "lucide-react";
import { AuthForm } from "@/components/account/auth-form";
import { RaceForm } from "@/components/race/race-form";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { asLocale } from "@/lib/i18n/messages";
import { organizerCopy } from "@/lib/i18n/organizer-copy";
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
  locale,
}: {
  open: boolean;
  onClose: () => void;
  messages: Messages;
  /** The reader's language, for creating a race in the shared form. */
  locale?: string;
}) {
  const [kind, setKind] = useState<Kind>("race");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const series = kind === "series";
  // Creating a race in the shared form instead of sending its address.
  const [creating, setCreating] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const c = organizerCopy[asLocale(locale ?? "en")];

  async function startCreating() {
    setCreating(true);
    const { data } = await createBrowserSupabase().auth.getUser();
    setSignedIn(Boolean(data.user));
  }

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
      <DialogContent className="max-h-[92dvh] overflow-y-auto overscroll-contain sm:max-w-md">
        {creating ? (
          <>
            <DialogHeader>
              <DialogTitle>{c.formCreate}</DialogTitle>
              <DialogDescription>{c.proposalNote}</DialogDescription>
            </DialogHeader>
            {signedIn === null ? null : signedIn ? (
              <RaceForm locale={locale ?? "en"} onDone={onClose} />
            ) : (
              <AuthForm locale={locale ?? "en"} hideTitle onSuccess={() => setSignedIn(true)} />
            )}
          </>
        ) : (
        <>
        <DialogHeader>
          <DialogTitle>{messages.reportRaceOrSeries}</DialogTitle>
          <DialogDescription>{series ? messages.submitRaceHelpSeries : messages.submitRaceHelpRace}</DialogDescription>
        </DialogHeader>
        {series ? null : (
          <Button type="button" variant="outline" onClick={() => void startCreating()}>
            <PencilLine data-icon="inline-start" />
            {c.createLink}
          </Button>
        )}
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
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

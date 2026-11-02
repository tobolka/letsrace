"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, PencilLine } from "lucide-react";
import { AuthForm } from "@/components/account/auth-form";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { asLocale } from "@/lib/i18n/messages";
import { organizerCopy } from "@/lib/i18n/organizer-copy";
import { localePath } from "@/lib/localized-paths";
import { RaceForm } from "@/components/race/race-form";

/** Set on the address while the dialog is open, so signing in with Google brings the reader back to it. */
const OPEN_PARAM = "edit";

type Access = { id: string; admin: boolean; verified: boolean; pending: boolean };
type Step = "loading" | "signedOut" | "choose" | "claimed" | "suggested";

/**
 * "Edit details" on a race or series. Most people want to fix something, not
 * take a race over, so the dialog first finds out who is asking: the admin
 * and a verified organiser go straight to editing; anyone else either says
 * they organise it (the claim) or sends a correction for the admin to apply.
 */
export function ClaimRaceDialog({ locale, slug, name, kind = "race" }: { locale: string; slug: string; name: string; kind?: "race" | "series" }) {
  const c = organizerCopy[asLocale(locale)];
  // A series gets its own words; the rest of the dialog is the same.
  const w =
    kind === "series"
      ? c.seriesClaim
      : { claimLink: c.claimLink, dialogTitle: c.dialogTitle, dialogIntro: c.dialogIntro, editTitle: c.editTitle, editIntro: c.editIntro, points: c.points, manage: c.manage };
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("loading");
  const [access, setAccess] = useState<Access | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<"suggest" | "organizer">("suggest");
  // On a race, the claim is a step off the form, not a choice beside it.
  const [claimFlow, setClaimFlow] = useState(false);
  const [text, setText] = useState("");
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function check() {
    setStep("loading");
    const { data } = await createBrowserSupabase().auth.getUser();
    if (!data.user) {
      setStep("signedOut");
      return;
    }
    setEmail(data.user.email ?? null);
    const res = await fetch(`/api/organizer/access?${new URLSearchParams({ kind, slug })}`).catch(() => null);
    setAccess(res?.ok ? ((await res.json()) as Access) : null);
    setStep("choose");
  }

  function show(next: boolean) {
    setOpen(next);
    if (next) setClaimFlow(false);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set(OPEN_PARAM, "1");
    else url.searchParams.delete(OPEN_PARAM);
    window.history.replaceState(null, "", url);
    if (next) void check();
  }

  // Back from Google's sign-in with the dialog's marker: open it again where the reader left it.
  useEffect(() => {
    if (new URL(window.location.href).searchParams.has(OPEN_PARAM)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      void check();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A reader whose claim is waiting can still send a correction.
  const claiming = mode === "organizer" && !access?.pending;

  async function send() {
    setBusy(true);
    setFailed(false);
    const res = await fetch(claiming ? "/api/organizer/claims" : "/api/organizer/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(claiming ? { kind, slug, note: text } : { kind, slug, message: text }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setFailed(true);
      return;
    }
    if (claiming) {
      setClaimStatus(((await res.json()) as { status: string }).status);
      setStep("claimed");
    } else {
      setStep("suggested");
    }
  }

  const manage = `${localePath(locale, "account/organizer")}?${kind}=${encodeURIComponent(slug)}`;
  const adminHref = kind === "race" && access ? `/admin/events/${access.id}` : "/admin/series";
  const done = (message: string) => (
    <p className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        <BadgeCheck className="size-3.5" aria-hidden />
      </span>
      {message}
    </p>
  );

  return (
    <>
      <button type="button" onClick={() => show(true)} className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground">
        <PencilLine className="size-3" aria-hidden />
        {c.editLink}
      </button>
      <Dialog open={open} onOpenChange={show}>
        {/* The sign-in dialog's shape: what this is for on the left, what to do on the right. */}
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto overscroll-contain p-0 sm:max-w-3xl md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3 border-b bg-muted/50 px-6 pt-6 pb-5 md:justify-center md:gap-0 md:border-r md:border-b-0 md:p-10">
            <BrandMark size="sm" className="md:mb-8" />
            <DialogTitle className="text-xl leading-tight font-semibold tracking-tight text-balance md:text-3xl">{w.editTitle}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-pretty md:mt-4 md:text-base">
              {w.editIntro.replace("{name}", name)}
            </DialogDescription>
            <p className="mt-8 hidden text-sm font-medium md:block">{c.optionOrganizer}:</p>
            <ul className="mt-3 hidden flex-col gap-3 md:flex">
              {w.points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-6 hidden text-xs leading-relaxed text-muted-foreground md:block">{c.verify}</p>
          </div>

          <div className="flex flex-col gap-4 px-6 py-6 md:justify-center md:p-10">
            {step === "loading" ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : step === "signedOut" ? (
              <AuthForm locale={locale} hideTitle onSuccess={() => void check()} />
            ) : step === "claimed" ? (
              <>
                {done(claimStatus === "verified" ? c.claimVerified : c.claimPending)}
                <Button className="w-full" asChild>
                  <Link href={manage}>{w.manage}</Link>
                </Button>
              </>
            ) : step === "suggested" ? (
              done(c.suggestThanks)
            ) : kind === "race" && !claimFlow ? (
              // A race is edited in the form itself; the admin's and an organiser's
              // changes land at once, anyone else's wait for approval.
              <>
                <RaceForm locale={locale} slug={slug} onDone={() => show(false)} />
                {access && !access.admin && !access.verified && !access.pending ? (
                  <button
                    type="button"
                    className="text-left text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    onClick={() => {
                      setClaimFlow(true);
                      setMode("organizer");
                    }}
                  >
                    {w.claimLink}
                  </button>
                ) : null}
              </>
            ) : access?.admin ? (
              <>
                <p className="text-sm">{c.adminNote}</p>
                <Button className="w-full" asChild>
                  <Link href={adminHref}>{c.adminEdit}</Link>
                </Button>
              </>
            ) : access?.verified ? (
              <>
                {done(c.organizerNote)}
                <Button className="w-full" asChild>
                  <Link href={manage}>{w.manage}</Link>
                </Button>
              </>
            ) : (
              <>
                {access?.pending ? (
                  <p className="text-sm text-muted-foreground">{c.pendingNote}</p>
                ) : (
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    className="w-full"
                    value={mode}
                    onValueChange={(v) => v && setMode(v as "suggest" | "organizer")}
                  >
                    <ToggleGroupItem value="suggest" className="flex-1">
                      {c.optionSuggest}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="organizer" className="flex-1">
                      {c.optionOrganizer}
                    </ToggleGroupItem>
                  </ToggleGroup>
                )}
                {claiming ? (
                  <>
                    <p className="text-sm text-muted-foreground md:hidden">{c.verify}</p>
                    {email ? <p className="text-sm font-medium">{c.account.replace("{email}", email)}</p> : null}
                  </>
                ) : null}
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={claiming ? c.notePlaceholder : c.suggestPlaceholder}
                  rows={5}
                  maxLength={3000}
                />
                {failed ? <p className="text-sm text-destructive">{c.failed}</p> : null}
                <Button className="w-full" onClick={() => void send()} disabled={busy || (!claiming && text.trim().length < 3)}>
                  {busy ? <Spinner data-icon="inline-start" /> : null}
                  {claiming ? (kind === "series" ? c.claimSeries : c.claimRace) : c.suggestSend}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check } from "lucide-react";
import { AuthForm } from "@/components/account/auth-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BrandMark } from "@/components/brand-mark";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { asLocale } from "@/lib/i18n/messages";
import { organizerCopy } from "@/lib/i18n/organizer-copy";
import { localePath } from "@/lib/localized-paths";

/** Set on the address while the dialog is open, so signing in with Google brings the reader back to it. */
const OPEN_PARAM = "claim";

type Step = "loading" | "signedOut" | "ready" | "verified" | "pending";

/**
 * "Organising this race?" — a dialog that says what taking a race over means
 * before it asks for anything, then signs in and sends the claim in place.
 */
export function ClaimRaceDialog({ locale, slug, name }: { locale: string; slug: string; name: string }) {
  const c = organizerCopy[asLocale(locale)];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function check() {
    setStep("loading");
    const { data } = await createBrowserSupabase().auth.getUser();
    setEmail(data.user?.email ?? null);
    setStep(data.user ? "ready" : "signedOut");
  }

  function show(next: boolean) {
    setOpen(next);
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
  }, []);

  async function claim() {
    setBusy(true);
    setFailed(false);
    const res = await fetch("/api/organizer/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "race", slug, note }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setFailed(true);
      return;
    }
    const { status } = (await res.json()) as { status: string };
    setStep(status === "verified" ? "verified" : "pending");
  }

  const manage = `${localePath(locale, "account/organizer")}?race=${encodeURIComponent(slug)}`;

  return (
    <>
      <button type="button" onClick={() => show(true)} className="underline underline-offset-4 hover:text-foreground">
        {c.claimLink}
      </button>
      <Dialog open={open} onOpenChange={show}>
        {/* The sign-in dialog's shape: the promise on the left, the form on the right. */}
        <DialogContent className="gap-0 overscroll-contain p-0 sm:max-w-3xl md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3 border-b bg-muted/50 px-6 pt-6 pb-5 md:justify-center md:gap-0 md:border-r md:border-b-0 md:p-10">
            <BrandMark size="sm" className="md:mb-8" />
            <DialogTitle className="text-xl leading-tight font-semibold tracking-tight text-balance md:text-3xl">
              {c.dialogTitle}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-pretty md:mt-4 md:text-base">
              {c.dialogIntro.replace("{name}", name)}
            </DialogDescription>
            <ul className="mt-8 hidden flex-col gap-3 md:flex">
              {c.points.map((point) => (
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
              <>
                <p className="text-sm text-muted-foreground md:hidden">{c.verify}</p>
                <AuthForm locale={locale} hideTitle onSuccess={() => void check()} />
              </>
            ) : step === "ready" ? (
              <>
                <p className="text-sm text-muted-foreground md:hidden">{c.verify}</p>
                {email ? <p className="text-sm font-medium">{c.account.replace("{email}", email)}</p> : null}
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.notePlaceholder} rows={4} maxLength={2000} />
                {failed ? <p className="text-sm text-destructive">{c.failed}</p> : null}
                <Button className="w-full" onClick={() => void claim()} disabled={busy}>
                  {busy ? <Spinner data-icon="inline-start" /> : <BadgeCheck data-icon="inline-start" />}
                  {c.claimRace}
                </Button>
              </>
            ) : (
              <>
                <p className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <BadgeCheck className="size-3.5" aria-hidden />
                  </span>
                  {step === "verified" ? c.claimVerified : c.claimPending}
                </p>
                <Button className="w-full" asChild>
                  <Link href={manage}>{c.manage}</Link>
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

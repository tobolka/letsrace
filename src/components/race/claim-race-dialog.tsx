"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check } from "lucide-react";
import { AuthForm } from "@/components/account/auth-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
        <DialogContent className="overscroll-contain sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{c.dialogTitle}</DialogTitle>
            <DialogDescription>{c.dialogIntro.replace("{name}", name)}</DialogDescription>
          </DialogHeader>

          {step === "verified" || step === "pending" ? (
            <p className="flex items-start gap-2 text-sm">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
              {step === "verified" ? c.claimVerified : c.claimPending}
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2 text-sm">
                {c.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{c.verify}</p>

              {step === "loading" ? (
                <div className="flex justify-center py-4">
                  <Spinner />
                </div>
              ) : step === "signedOut" ? (
                <div className="flex flex-col gap-2 border-t pt-4">
                  <p className="text-sm font-medium">{c.signIn}</p>
                  <AuthForm locale={locale} hideTitle onSuccess={() => void check()} />
                </div>
              ) : (
                <div className="flex flex-col gap-2 border-t pt-4">
                  {email ? <p className="text-sm text-muted-foreground">{c.account.replace("{email}", email)}</p> : null}
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.notePlaceholder} rows={3} maxLength={2000} />
                  {failed ? <p className="text-sm text-destructive">{c.failed}</p> : null}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            {step === "ready" ? (
              <Button onClick={() => void claim()} disabled={busy}>
                {busy ? <Spinner data-icon="inline-start" /> : <BadgeCheck data-icon="inline-start" />}
                {c.claimRace}
              </Button>
            ) : step === "verified" || step === "pending" ? (
              <Button asChild>
                <Link href={manage}>{c.manage}</Link>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

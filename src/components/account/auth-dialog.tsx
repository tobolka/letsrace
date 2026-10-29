"use client";

import { Check } from "lucide-react";
import { AuthForm } from "@/components/account/auth-form";
import { BrandMark } from "@/components/brand-mark";
import { messagesFor } from "@/lib/i18n/messages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Signing in, with the reason to. The left half says what an account is for —
 * the same promise the profile's pages make to somebody signed out — and the
 * right half is the form. On a phone the promise shrinks to a heading, so the
 * form stays on the first screen.
 */
export function AuthDialog({
  open,
  onClose,
  onSuccess,
  locale,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  locale: string;
  reason?: string;
}) {
  const t = messagesFor(locale);
  const points = [t.teaserPlan, t.teaserAlerts, t.teaserRiders];
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="gap-0 p-0 sm:max-w-3xl md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 border-b bg-muted/50 px-6 pt-6 pb-5 md:justify-center md:gap-0 md:border-r md:border-b-0 md:p-10">
          <BrandMark size="sm" className="md:mb-8" />
          <DialogTitle className="text-xl leading-tight font-semibold tracking-tight text-balance md:text-3xl">
            {t.teaserTitle}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-pretty md:mt-4 md:text-base">
            {reason ?? t.teaserBody}
          </DialogDescription>
          <ul className="mt-8 hidden flex-col gap-3 md:flex">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="px-6 py-6 md:p-10">
          <AuthForm
            locale={locale}
            initialMode="login"
            hideTitle
            onSuccess={() => {
              onSuccess();
              onClose();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { AuthForm } from "@/components/account/auth-form";
import { messagesFor } from "@/lib/i18n/messages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.signIn}</DialogTitle>
          {reason ? <DialogDescription>{reason}</DialogDescription> : (
            <DialogDescription className="sr-only">
              {t.planAuthGoing}
            </DialogDescription>
          )}
        </DialogHeader>
        <AuthForm
          locale={locale}
          initialMode="login"
          hideTitle
          onSuccess={() => {
            onSuccess();
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

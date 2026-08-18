"use client";

import { AuthForm } from "@/components/account/auth-form";
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
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          {reason ? <DialogDescription>{reason}</DialogDescription> : (
            <DialogDescription className="sr-only">
              Sign in to save races and use your calendar.
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

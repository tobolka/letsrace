"use client";

import { X } from "lucide-react";
import { AuthForm } from "@/components/account/auth-form";

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
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div id="auth-dialog-title" className="sr-only">
          Sign in
        </div>
        <AuthForm
          locale={locale}
          initialMode="login"
          reason={reason}
          onSuccess={() => {
            onSuccess();
            onClose();
          }}
        />
      </div>
    </div>
  );
}

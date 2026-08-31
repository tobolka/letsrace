"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { messagesFor } from "@/lib/i18n/messages";

/**
 * Names the failure codes we recognise; everything else stays generic.
 *
 * `validation_failed` is what Supabase sends when the provider is switched off
 * in the dashboard, which reads to a visitor as the button doing nothing.
 */
function describe(code: string, t: ReturnType<typeof messagesFor>): string {
  switch (code) {
    case "access_denied":
      return t.authErrorCancelled;
    case "validation_failed":
    case "provider_disabled":
      return t.authErrorProvider;
    default:
      return t.authErrorGeneric;
  }
}

/**
 * Says out loud when a sign-in came back empty-handed.
 *
 * The callback route parks a code in `?auth_error`. A refusal that never gets
 * that far — Supabase bouncing straight to the site URL — arrives as a plain
 * `?error`, and the implicit flow puts one in the fragment, which never reaches
 * the server at all; all three are read here. Only the code is ever consulted,
 * never the provider's `error_description`, so a crafted link cannot choose the
 * words a visitor sees. The markers are dropped so a reload stays quiet.
 */
export function AuthErrorToast({ locale }: { locale: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
    const code =
      url.searchParams.get("auth_error") ??
      url.searchParams.get("error_code") ??
      url.searchParams.get("error") ??
      fragment.get("error_code") ??
      fragment.get("error");
    if (!code) return;

    const t = messagesFor(locale);
    toast.error(t.authErrorTitle, { description: describe(code, t) });

    for (const key of ["auth_error", "error_code", "error", "error_description"]) {
      url.searchParams.delete(key);
    }
    url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [locale]);

  return null;
}

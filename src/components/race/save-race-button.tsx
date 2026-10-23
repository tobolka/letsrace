"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CalendarCheck, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { messagesFor } from "@/lib/i18n/messages";
import { getSavedRaces, getServerSavedRaces, saveRace, subscribeSavedRaces } from "@/lib/saved-races";
import { cn } from "@/lib/utils";
import { localePath } from "@/lib/localized-paths";

const AuthDialog = dynamic(() => import("@/components/account/auth-dialog").then((m) => ({ default: m.AuthDialog })), { ssr: false });

/**
 * "Add to plan" for one race — on its page, its map card and the browse
 * lists, signed in or not.
 *
 * Signed out, it opens sign-in with the reason; the race waits and is added
 * the moment a session appears. Once in the plan it links to the plan.
 */
export function SaveRaceButton({
  eventId,
  raceName,
  locale,
  variant = "icon",
  className,
}: {
  eventId: string;
  raceName: string;
  locale: string;
  /**
   * `icon` for the map card and browse rows; `full` for the race's own page;
   * `tile` for the phone's race sheet — icon over a one-word label, styled by
   * `className` like the tiles beside it.
   */
  variant?: "icon" | "full" | "tile";
  className?: string;
}) {
  const t = messagesFor(locale);
  const { ids } = useSyncExternalStore(subscribeSavedRaces, getSavedRaces, getServerSavedRaces);
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const added = ids.has(eventId);
  const label = added ? t.suggestAdded : t.suggestAdd;
  const icon = busy ? <Spinner /> : added ? <CalendarCheck /> : <CalendarPlus />;
  const size = variant === "icon" ? "icon-sm" : "default";

  if (variant === "tile") {
    const tileLabel = added ? t.actionSaved : t.actionSave;
    if (added) {
      return (
        <Link href={localePath(locale, `account`)} aria-label={`${label} — ${raceName}`} className={cn(className, "text-primary")}>
          {icon}
          <span>{tileLabel}</span>
        </Link>
      );
    }
    return (
      <>
        <button
          type="button"
          disabled={busy}
          aria-label={`${label} — ${raceName}`}
          className={className}
          onClick={async () => {
            setBusy(true);
            try {
              if ((await saveRace({ eventId, name: raceName, locale })) === "auth") setAuthOpen(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {icon}
          <span>{tileLabel}</span>
        </button>
        {authOpen ? (
          <AuthDialog open locale={locale} reason={t.saveAuthReason} onClose={() => setAuthOpen(false)} onSuccess={() => setAuthOpen(false)} />
        ) : null}
      </>
    );
  }

  if (added) {
    return (
      <Button asChild size={size} variant={variant === "icon" ? "ghost" : "outline"} tooltip={variant === "icon" ? label : false} className={cn(variant === "icon" && "text-primary", className)}>
        <Link href={localePath(locale, `account`)} aria-label={`${label} — ${raceName}`}>
          {icon}
          {variant === "full" ? label : null}
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant === "icon" ? "ghost" : "outline"}
        disabled={busy}
        aria-label={`${label} — ${raceName}`}
        title={label}
        className={className}
        onClick={async (e) => {
          // Never let a surrounding link or card act on the press.
          e.preventDefault();
          e.stopPropagation();
          setBusy(true);
          try {
            if ((await saveRace({ eventId, name: raceName, locale })) === "auth") setAuthOpen(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {icon}
        {variant === "full" ? label : null}
      </Button>
      {authOpen ? (
        <AuthDialog open locale={locale} reason={t.saveAuthReason} onClose={() => setAuthOpen(false)} onSuccess={() => setAuthOpen(false)} />
      ) : null}
    </>
  );
}

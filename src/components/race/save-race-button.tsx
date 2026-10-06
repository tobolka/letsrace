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
 * "Add to plan" for one race, wherever races are listed — signed in or not.
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
  /** `icon` for rows in a list; `full` for a race's own page or panel. */
  variant?: "icon" | "full";
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

  if (added) {
    return (
      <Button asChild size={size} variant={variant === "icon" ? "ghost" : "outline"} className={cn(variant === "icon" && "text-primary", className)}>
        <Link href={localePath(locale, `account`)} aria-label={`${label} — ${raceName}`} title={label}>
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
          // Rows are links: the button sits beside one, but never follows it.
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

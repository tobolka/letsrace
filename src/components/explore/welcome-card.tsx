"use client";

import { useEffect, useState } from "react";
import { MapPin, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const SEEN_KEY = "letsrace.welcome.seen";

/**
 * What this app is, said once.
 *
 * The map opens on a wall of pins with no explanation, and the one thing that
 * makes it more than a calendar — planning a season for a family or a team — is
 * behind a "…" menu nobody opens. This says it once, in the corner, and then
 * never again.
 *
 * Deliberately non-blocking: someone who landed here from a race link wants the
 * race, not a modal.
 */
export function WelcomeCard({
  messages,
  onSignIn,
}: {
  messages: {
    introTitle: string;
    introBody: string;
    introCta: string;
    introDismiss: string;
  };
  onSignIn: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Storage can throw in private windows — a missing flag just shows the card.
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    // Show on next frame so LCP is the card itself, not a delayed mount.
    const t = window.requestAnimationFrame(() => setShow(true));
    return () => window.cancelAnimationFrame(t);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* nothing to remember it with — it will show again, which is survivable */
    }
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label={messages.introTitle}
      /**
       * Bottom-right on desktop, top on mobile. The mobile layout gives the
       * bottom half to the race sheet, and a corner card there covered the
       * entire list — the first thing someone should see.
       */
      className="pointer-events-auto fixed inset-x-3 top-16 z-40 rounded-xl border bg-background/95 p-4 shadow-xl backdrop-blur duration-300 animate-in fade-in slide-in-from-top-4 md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:w-[22rem] md:slide-in-from-bottom-4"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={messages.introDismiss}
        onClick={dismiss}
        className="absolute right-2 top-2 text-muted-foreground"
      >
        <X />
      </Button>
      <p className="pr-7 text-sm font-semibold leading-snug">{messages.introTitle}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{messages.introBody}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            dismiss();
            onSignIn();
          }}
        >
          <Users /> {messages.introCta}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          <MapPin /> {messages.introDismiss}
        </Button>
      </div>
    </div>
  );
}

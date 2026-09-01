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
    // The photograph in this card is the largest thing the page paints, so
    // whatever this timer is, the Largest Contentful Paint cannot beat it. Long
    // enough not to slam in over the map, short enough not to be the metric.
    const t = window.setTimeout(() => setShow(true), 200);
    return () => window.clearTimeout(t);
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
      className="pointer-events-auto fixed inset-x-3 top-16 z-40 overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur duration-300 animate-in fade-in slide-in-from-top-4 md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:w-[22rem] md:slide-in-from-bottom-4"
    >
      {/*
        Decorative, so it carries no alt text — the dialog is already labelled.
        Dimensions are set to keep the card from jumping as it loads.

        A plain img rather than next/image: the file is already cropped and
        encoded to the size it is shown at, 27 KB, and next/image is used
        nowhere else in the app — pulling the component in for one banner would
        cost more than it saves.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/intro-race.webp"
        srcSet="/intro-race.webp 1x, /intro-race@2x.webp 2x"
        alt=""
        width={352}
        height={112}
        className="h-24 w-full object-cover md:h-28"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={messages.introDismiss}
        onClick={dismiss}
        className="absolute right-2 top-2 bg-black/35 text-white hover:bg-black/55 hover:text-white"
      >
        <X />
      </Button>
      <div className="p-4">
        <p className="text-sm font-semibold leading-snug">{messages.introTitle}</p>
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
    </div>
  );
}

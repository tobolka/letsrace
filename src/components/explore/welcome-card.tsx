"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MapPin, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markWelcomeSeen, readWelcomeSeen, subscribeWelcome } from "@/lib/welcome";

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
 *
 * Default-shown in SSR so the photograph is in the first HTML (and can paint
 * before the application hydrates). Returning visitors already dismissed it: a head
 * script sets `data-welcome-seen` before paint and CSS hides `#letsrace-welcome`,
 * so React can unmount on hydrate without a visible flash.
 */
export function WelcomeCard({
  messages,
  onSignIn,
}: {
  messages: {
    introTitle: string;
    introImageAlt: string;
    introBody: string;
    introCta: string;
    introDismiss: string;
  };
  onSignIn: () => void;
}) {
  // The server cannot know, so it and hydration show the card; a returning
  // visitor's render right after hydration takes it away.
  const seen = useSyncExternalStore(subscribeWelcome, readWelcomeSeen, () => false);

  useEffect(() => {
    if (seen) document.documentElement.dataset.welcomeSeen = "1";
  }, [seen]);

  if (seen) return null;

  function dismiss() {
    markWelcomeSeen();
  }

  return (
    <aside
      id="letsrace-welcome"
      aria-labelledby="letsrace-welcome-title"
      /** Hidden on mobile; the map and race sheet should open without an overlay. */
      className="pointer-events-auto fixed z-40 hidden overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur md:bottom-6 md:right-6 md:block md:w-[22rem]"
    >
      {/*
        The photograph describes the sport, with a localized alternative.
        Dimensions are set to keep the card from jumping as it loads.

        A plain img rather than next/image: the file is already cropped and
        encoded to the size it is shown at, and next/image is used
        nowhere else in the app — the browser can pick an AVIF or WebP directly without an image-server round trip.

        No enter animation: show the photograph as soon as it is ready.
      */}
      <picture>
        <source type="image/avif" srcSet="/intro-race-v2.avif 1x, /intro-race-v2@2x.avif 2x" />
        <img
          src="/intro-race-v2.webp"
          srcSet="/intro-race-v2.webp 1x, /intro-race-v2@2x.webp 2x"
          alt={messages.introImageAlt}
          width={352}
          height={112}
          fetchPriority="high"
          decoding="async"
          className="h-24 w-full object-cover outline outline-1 outline-black/10 md:h-28"
        />
      </picture>
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
        <p
          id="letsrace-welcome-title"
          className="text-sm font-semibold leading-snug text-balance"
        >
          {messages.introTitle}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
          {messages.introBody}
        </p>
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
    </aside>
  );
}

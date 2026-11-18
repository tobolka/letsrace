"use client";

import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, ExternalLink, FileText, Globe, Medal, Trophy, Wind } from "lucide-react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** A way off a race: the organiser's pages and documents, the series, the forecast. */
export type RaceLink = { href: string; label: string; kind: string; external: boolean };

const LINK_ICONS: Record<string, ReactNode> = {
  website: <Globe />,
  register: <Globe />,
  regulations: <FileText />,
  instructions: <FileText />,
  series_rules: <FileText />,
  results: <Medal />,
  listing: <CalendarDays />,
  series: <Trophy />,
  weather: <Wind />,
};

/**
 * Every link of a race as one list in one look: an icon, the name, and an
 * arrow that says whether it leaves the site. The map's card and the race page
 * both use it, instead of a mix of buttons, chips and underlined text.
 *
 * `bleed` is kept for callers; the rows sit in one frame inside the card's gutter.
 */
export function RaceLinkRows({
  links,
  onLink,
  analytics,
  className,
}: {
  links: RaceLink[];
  onLink?: (kind: string) => void;
  /** For a page that cannot hand down a handler: what to report on a click. */
  analytics?: { raceId: string; slug: string; location: string; presentation: string };
  /** Kept so callers need not change: the rows sit in a frame inside the gutter now. */
  bleed?: boolean;
  className?: string;
}) {
  if (!links.length) return null;
  function clicked(kind: string) {
    onLink?.(kind);
    if (analytics) {
      track(kind === "register" ? "race_registration_start" : "outbound_click", {
        race_id: analytics.raceId,
        slug: analytics.slug,
        kind,
        location: analytics.location,
        presentation: analytics.presentation,
      });
    }
  }
  // One framed list, the same on the card and the race page: the frame says "these lead somewhere".
  const row =
    "grid min-h-11 grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-x-3 px-4 text-sm font-medium transition-colors hover:bg-accent active:bg-accent focus-visible:bg-accent focus-visible:outline-none";
  return (
    <ul className={cn("divide-y divide-border/60 overflow-hidden rounded-xl border", className)}>
      {links.map((link) => {
        const inner = (
          <>
            <span className="flex size-4 items-center justify-center text-muted-foreground [&_svg]:size-4" aria-hidden>
              {LINK_ICONS[link.kind] ?? <Globe />}
            </span>
            <span className="min-w-0 truncate">{link.label}</span>
            {link.external ? (
              <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
            ) : (
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            )}
          </>
        );
        return (
          <li key={link.href}>
            {link.external ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className={row} onClick={() => clicked(link.kind)}>
                {inner}
              </a>
            ) : (
              <Link href={link.href} className={row} onClick={() => clicked(link.kind)}>
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

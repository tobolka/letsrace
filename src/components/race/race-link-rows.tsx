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
 * `bleed` stretches the rows to the edges of a card whose content is inset by
 * a 1rem gutter, so the hover fills the whole row.
 */
export function RaceLinkRows({
  links,
  onLink,
  analytics,
  bleed = false,
  className,
}: {
  links: RaceLink[];
  onLink?: (kind: string) => void;
  /** For a page that cannot hand down a handler: what to report on a click. */
  analytics?: { raceId: string; slug: string; location: string; presentation: string };
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
  const row = cn(
    "grid min-h-11 grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-x-3 text-sm font-medium transition-colors hover:bg-accent active:bg-accent focus-visible:bg-accent focus-visible:outline-none",
    bleed ? "-mx-4 px-4" : "px-4",
  );
  return (
    <ul className={className}>
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

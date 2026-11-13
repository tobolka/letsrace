"use client";

import { Check, ExternalLink, MapPinned, Maximize2, Navigation, Share } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSwapClass } from "@/hooks/use-swap-class";
import { useShareLink } from "@/components/explore/use-share-link";
import { SaveRaceButton } from "@/components/race/save-race-button";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { carryFilterQuery } from "@/lib/explore-params";
import { eventPagePath } from "@/lib/event-url";
import type { EventListItem } from "@/lib/events";
import { messagesFor } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";
import { cn } from "@/lib/utils";

/** What a race can be asked to do. `show` lists the ones a place wants, in the order it wants them. */
export type RaceAction = "primary" | "plan" | "map" | "directions" | "share" | "detail";

/**
 * How they are laid out:
 * - `row`: the race page's wrapping row of buttons;
 * - `grid`: the desktop card's — the way in across the width, the rest in two columns;
 * - `tiles`: the way in across the width, the rest as round icons with a label
 *   under each — the phone's sheet, the map's card and the race page alike.
 */
export type RaceActionsLayout = "row" | "grid" | "tiles";

const PRESENTATION = { row: "page", grid: "panel", tiles: "sheet" } as const;

// A flat, softly shaded tile, icon over a one-word label, all in one row of
// equal widths — the way Apple Maps lines up what you can do with a place, so
// the actions sit quietly under the race instead of shouting over it. Links,
// buttons and the save button alike get it from this one class.
const TILE =
  "flex h-[3.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-lg bg-foreground/[0.055] px-1 text-[11px] leading-none font-medium text-foreground outline-none touch-manipulation transition-[background-color,scale] duration-150 hover:bg-foreground/10 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 [&_svg]:size-[18px] [&>span:last-child]:max-w-full [&>span:last-child]:truncate [&>span:last-child]:py-px";
const TILE_BAR = "grid gap-1.5";

/**
 * Everything you can do with a race, in one place: go to its entry page, put
 * it in your plan, see it on the map, get directions, share it, open its page.
 * The race page, the map's card and the phone's sheet all use this, so a
 * button looks and works the same wherever it is met; each only says which of
 * them it wants (`show`) and how to lay them out (`layout`).
 */
export function RaceActions({
  event,
  locale,
  show,
  layout,
  location,
  primary = null,
  directionsUrl = null,
  mapHref,
  carryFilters = false,
  className,
}: {
  event: EventListItem;
  locale: string;
  show: RaceAction[];
  layout: RaceActionsLayout;
  /** Where the buttons sit, for analytics: `race_page` or `race_panel`. */
  location: string;
  /** The way in: the registration, else the organiser's page. */
  primary?: { href: string; label: string; kind: string } | null;
  directionsUrl?: string | null;
  /** The race on the map. */
  mapHref: string;
  /** Take the list's filters along to the map, so it shows the same races. */
  carryFilters?: boolean;
  className?: string;
}) {
  const t = messagesFor(locale);
  const router = useRouter();
  const { linkCopied, copyShareLink } = useShareLink(event, locale);
  const shareSwap = useSwapClass(linkCopied ? "copied" : "share");
  const presentation = PRESENTATION[layout];
  const tiles = layout === "tiles";

  const wants = (action: RaceAction) => show.includes(action);
  const hasMap = wants("map") && Boolean(mapHref);

  function onMapClick(e: React.MouseEvent<HTMLAnchorElement>) {
    track("cta_click", { slug: event.slug, location, source: "show_on_map" });
    if (!carryFilters) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const carry = carryFilterQuery(new URLSearchParams(window.location.search));
    if (!carry) return;
    e.preventDefault();
    router.push(`${localePath(locale)}${carry}&e=${encodeURIComponent(event.slug)}`);
  }

  const trackEnter = (kind: string) =>
    track(kind === "register" ? "race_registration_start" : "outbound_click", {
      race_id: event.id,
      slug: event.slug,
      kind,
      location,
      presentation,
    });

  const way = wants("primary") ? (
    primary ? (
      <Button asChild className={layout === "row" ? undefined : cn("w-full", tiles && "rounded-xl")}>
        <a href={primary.href} target="_blank" rel="noopener noreferrer" onClick={() => trackEnter(primary.kind)}>
          <ExternalLink data-icon="inline-start" />
          <span className="truncate">{primary.label}</span>
        </a>
      </Button>
    ) : (
      <p className="text-sm text-muted-foreground">{t.noOnlineEntry}</p>
    )
  ) : null;

  // The rest, in the order the place asked for.
  const rest = show.filter((a) => a !== "primary");
  const fill = layout === "grid" ? "w-full" : undefined;

  function button(action: RaceAction) {
    switch (action) {
      case "plan":
        return tiles ? (
          <SaveRaceButton key={action} eventId={event.id} raceName={event.name} locale={locale} variant="tile" className={TILE} />
        ) : (
          <SaveRaceButton key={action} eventId={event.id} raceName={event.name} locale={locale} variant="full" className={fill} />
        );
      case "map":
        if (!hasMap) return null;
        return tiles ? (
          <Link key={action} href={mapHref} aria-label={t.viewOnMap} title={t.viewOnMap} onClick={onMapClick} className={TILE}>
            <MapPinned aria-hidden />
            <span>{t.navMap}</span>
          </Link>
        ) : (
          <Button key={action} asChild variant="outline" className={fill}>
            <Link href={mapHref} onClick={onMapClick}>
              <MapPinned data-icon="inline-start" />
              {t.viewOnMap}
            </Link>
          </Button>
        );
      case "directions":
        if (!directionsUrl) return tiles ? (
          <span key={action} aria-hidden className={cn(TILE, "opacity-40")}>
            <Navigation />
            <span>{t.directions}</span>
          </span>
        ) : null;
        return tiles ? (
          <a key={action} href={directionsUrl} target="_blank" rel="noopener noreferrer" title={t.directionsHelp} className={TILE} onClick={() => trackEnter("directions")}>
            <Navigation aria-hidden />
            <span>{t.directions}</span>
          </a>
        ) : (
          <Button key={action} asChild variant="outline" className={fill}>
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer" title={t.directionsHelp} onClick={() => trackEnter("directions")}>
              <Navigation data-icon="inline-start" />
              {t.directions}
            </a>
          </Button>
        );
      case "share": {
        const icon = linkCopied ? <Check aria-hidden /> : <Share aria-hidden />;
        const press = () => {
          if (!linkCopied) void copyShareLink();
        };
        return tiles ? (
          <button
            key={action}
            type="button"
            aria-label={linkCopied ? t.linkCopied : t.shareRace}
            aria-pressed={linkCopied}
            className={cn(TILE, linkCopied && "border-primary bg-primary text-primary-foreground hover:bg-primary")}
            onClick={press}
          >
            <span key={linkCopied ? "copied" : "share"} className={cn("inline-flex", shareSwap)}>
              {icon}
            </span>
            <span>{linkCopied ? t.linkCopied : t.actionShare}</span>
          </button>
        ) : (
          <Button
            key={action}
            type="button"
            variant="outline"
            className={fill}
            aria-label={linkCopied ? t.linkCopied : t.shareRace}
            onClick={(e) => {
              // The label stays put so the row does not reflow; the icon and the toast say it worked.
              e.currentTarget.blur();
              press();
            }}
          >
            {linkCopied ? <Check data-icon="inline-start" /> : <Share data-icon="inline-start" />}
            {t.actionShare}
          </Button>
        );
      }
      case "detail":
        return tiles ? (
          <Link
            key={action}
            href={eventPagePath(locale, event.slug)}
            aria-label={t.openRaceDetail}
            onClick={() => track("cta_click", { slug: event.slug, location, source: "full_detail" })}
            className={TILE}
          >
            <Maximize2 aria-hidden />
            <span>{t.actionDetail}</span>
          </Link>
        ) : (
          <Button key={action} asChild variant="outline" className={fill}>
            <Link href={eventPagePath(locale, event.slug)} onClick={() => track("cta_click", { slug: event.slug, location, source: "full_detail" })}>
              <Maximize2 data-icon="inline-start" />
              {t.actionDetail}
            </Link>
          </Button>
        );
      default:
        return null;
    }
  }

  const buttons = rest.map(button).filter(Boolean);

  if (layout === "row") {
    return (
      <div className={className}>
        {way && primary ? null : way}
        <div className="flex flex-wrap gap-2">
          {way && primary ? way : null}
          {buttons}
        </div>
      </div>
    );
  }

  if (tiles) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {way}
        <div className={TILE_BAR} style={{ gridTemplateColumns: `repeat(${buttons.length}, minmax(0, 1fr))` }}>
          {buttons}
        </div>
      </div>
    );
  }

  // Four make an even grid; fewer lead with the first across the width.
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {way}
      <div
        className={cn(
          "grid grid-cols-2 gap-2",
          buttons.length < 4 && "[&>:first-child]:col-span-2 [&>:nth-child(even):last-child]:col-span-2",
        )}
      >
        {buttons}
      </div>
    </div>
  );
}

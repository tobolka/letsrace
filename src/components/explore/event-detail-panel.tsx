"use client";

import { useEffect } from "react";
import { ChevronUp, X } from "lucide-react";
import type { EventListItem } from "@/lib/events";
import { messagesFor } from "@/lib/i18n/messages";
import { disciplineColor } from "@/lib/map-visuals";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { buildDetailModel } from "@/components/explore/event-detail-model";
import { EventDetailBody } from "@/components/explore/event-detail-body";
import { EmbeddedBody } from "@/components/explore/event-detail-embedded";
import { EventTrustRow } from "@/components/explore/event-trust-row";
import { useShareLink } from "@/components/explore/use-share-link";
import { DEFAULT_CARD_X, useDraggableCard } from "@/components/explore/use-draggable-card";


export function EventDetailPanel({
  event,
  onClose,
  locale,
  onSelectSeries,
  embedded = false,
  onExpand,
  anchored = false,
  dockRight = false,
  dockTop = 64,
  leftX = DEFAULT_CARD_X,
}: {
  event: EventListItem;
  onClose: () => void;
  locale: string;
  onSelectSeries?: (slug: string) => void;
  /** Flat layout inside the mobile bottom sheet (no outer card chrome). */
  embedded?: boolean;
  /** The sheet is at its preview height: a button beside the cross raises it. */
  onExpand?: () => void;
  /**
   * The map's card, held by something else — a popover over a calendar day.
   * Same header, close button and footer, but it neither drags nor places
   * itself: whatever holds it decides where it goes.
   */
  anchored?: boolean;
  /** Full-width list mode: sit in the strip reserved at the right edge. */
  dockRight?: boolean;
  /** How far down a right-docked card starts — below whatever header is there. */
  dockTop?: number;
  /** Where the card starts when it sits beside the panel. */
  leftX?: number;
}) {
  const t = messagesFor(locale);
  const { linkCopied, copyShareLink } = useShareLink(event, locale);
  const { cardRef, offset, dragging, headerProps } = useDraggableCard({
    eventId: event.id,
    embedded,
    anchored,
    dockRight,
    dockTop,
    leftX,
  });
  const m = buildDetailModel(event, locale, t);

  useEffect(() => {
    track("race_view", { slug: event.slug, location: "race_panel" });
  }, [event.slug]);

  function trackEnter(kind: string) {
    track(kind === "register" ? "race_registration_start" : "outbound_click", { slug: event.slug, kind, location: "race_panel" });
  }

  return (
    <Card
      ref={cardRef}
      aria-labelledby="race-detail-title"
      className={cn(
        // overflow-x-hidden: long series chips / nowrap buttons used to force a
        // horizontal scrollbar while the card was dragged around the map.
        "pointer-events-auto w-full max-w-[min(320px,calc(100vw-1.5rem))] gap-0 overflow-x-hidden overflow-y-hidden py-0",
        dragging && "select-none",
        embedded
          ? "flex h-full min-h-0 max-w-none flex-col border-0 shadow-none"
          : anchored
            ? "flex w-[320px] max-h-[min(72dvh,36rem)] flex-col border-0 shadow-none"
            : "absolute z-40 w-[320px] max-h-[calc(100dvh-1.5rem)] shadow-lg",
      )}
      style={embedded || anchored ? undefined : { left: offset.x, top: offset.y }}
    >
      <CardHeader
        /*
         * A flex row, centred, not the card's default grid. That grid always lays out
         * two rows and lets the close button span both, so the button centred
         * across a header the title only ever filled the top half of — which
         * is why the name sat visibly above the cross next to it.
         *
         * twMerge drops `grid` for `flex` but keeps grid-rows / grid-cols
         * leftovers; clear them so CardAction's col-start cannot fight the row.
         */
        className={cn(
          "flex shrink-0 flex-row items-center gap-2 border-b px-4 py-3 [.border-b]:pb-3",
          "grid-cols-none grid-rows-none",
          embedded && "px-4 pt-0 pb-2 [.border-b]:pb-2",
          !embedded && !anchored && "cursor-grab touch-none select-none",
          dragging && "cursor-grabbing",
        )}
        {...headerProps}
      >
        <CardTitle
          id="race-detail-title"
          className={cn(
            "flex min-w-0 flex-1 items-stretch gap-2.5 leading-snug",
            embedded ? "text-[17px] font-semibold" : "text-base",
          )}
        >
          {/* The same rule the list card wears, so a race looks like itself
              whether you are reading it in the list or in the panel — but
              stretched, because this is the one place the whole name is
              spelled out and it can run to two lines. */}
          <span
            aria-hidden
            className="my-0.5 w-[3px] shrink-0 self-stretch rounded-full"
            style={{ background: disciplineColor(event.disciplines) }}
          />
          {/* Whole on a phone: the sheet is the one place the name is spelled
              out, and a list row has already cut it short. */}
          <span
            className={cn(
              "min-w-0 flex-1 break-words",
              !embedded && "[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden",
            )}
          >
            {event.name}
          </span>
        </CardTitle>
        {/* Negative margins keep the close target from setting the title row's height. */}
        <CardAction className="col-auto row-auto -my-2 -mr-2 ml-auto flex shrink-0 items-center self-center justify-self-auto">
          {onExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={onExpand}
              aria-label={t.raceExpand}
            >
              <ChevronUp />
            </Button>
          ) : null}
          {/* On a phone the cross is the way out that does not depend on a
              gesture, so it gets a whole thumb's worth of target. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={embedded ? "size-11" : undefined}
            onClick={onClose}
            aria-label={t.close}
          >
            <X />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent
        /*
         * Tighter on a phone. The sheet is half a small screen, and at desktop
         * spacing four facts and a chip row filled all of it — you had to drag
         * the sheet up to find out whether a race had an entry link.
         */
        className={cn(
          "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4",
          embedded
            ? "px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "py-3",
        )}
        inert={dragging || undefined}
      >
        {embedded ? (
          <EmbeddedBody
            event={event}
            locale={locale}
            placeLabel={m.placeLabel}
            directionsUrl={m.directionsUrl}
            primary={m.primary}
            secondaryLinks={m.secondaryLinks}
            whoChips={m.whoChips}
            ageHintFor={m.ageHintFor}
            levelLabel={m.levelLabel}
            levelHelp={m.levelHelp}
            discChips={m.discChips}
            onSelectSeries={onSelectSeries}
            trackEnter={trackEnter}
            linkCopied={linkCopied}
            onShare={() => void copyShareLink()}
            trustText={m.trustText}
            trustLow={m.trust === "low"}
            checkedText={m.checkedText && event.lastSeenAt ? m.checkedText : null}
          />
        ) : (
          <EventDetailBody
            event={event}
            locale={locale}
            placeLabel={m.placeLabel}
            directionsUrl={m.directionsUrl}
            whoChips={m.whoChips}
            ageHintFor={m.ageHintFor}
            levelLabel={m.levelLabel}
            levelHelp={m.levelHelp}
            discChips={m.discChips}
            actionLinks={m.actionLinks}
            onSelectSeries={onSelectSeries}
            trackEnter={trackEnter}
          />
        )}
      </CardContent>

      {embedded ? null : (
        <CardFooter
          className="shrink-0 justify-between gap-2 border-t px-2 py-2 [.border-t]:pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-2"
          inert={dragging || undefined}
        >
          <EventTrustRow
            event={event}
            locale={locale}
            trustLow={m.trust === "low"}
            trustText={m.trustText}
            checkedText={m.checkedText}
            linkCopied={linkCopied}
            onShare={() => void copyShareLink()}
          />
        </CardFooter>
      )}

    </Card>
  );
}

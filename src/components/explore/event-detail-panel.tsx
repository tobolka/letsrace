"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { ArrowRight, ChevronUp, X } from "lucide-react";
import Link from "next/link";
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
import { useMediaQuery } from "@/hooks/use-viewport";
import { cn } from "@/lib/utils";
import { buildDetailModel } from "@/components/explore/event-detail-model";
import { EmbeddedBody } from "@/components/explore/event-detail-embedded";
import { RACE_CARD_W } from "@/components/explore/panel-resize";
import { DEFAULT_CARD_X, useDraggableCard } from "@/components/explore/use-draggable-card";
import { eventPagePath } from "@/lib/event-url";
import { focusKeyboardItem, visibleKeyboardItems } from "@/lib/keyboard-navigation";


export function EventDetailPanel({
  event,
  onClose,
  locale,
  onSelectSeries,
  embedded = false,
  onExpand,
  showOnMap = false,
  anchored = false,
  dockRight = false,
  dockTop = 64,
  leftX = DEFAULT_CARD_X,
  topY,
}: {
  event: EventListItem;
  onClose: () => void;
  locale: string;
  onSelectSeries?: (slug: string) => void;
  /** Flat layout inside the mobile bottom sheet (no outer card chrome). */
  embedded?: boolean;
  /** The sheet is at its preview height: a button beside the cross raises it. */
  onExpand?: () => void;
  /** Opened from the list or the calendar: offer the way to the map. */
  showOnMap?: boolean;
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
  /** How far down it starts there — lower when the list's small bar is above it. */
  topY?: number;
}) {
  const t = messagesFor(locale);
  const { cardRef, offset, dragging, resizing, resizable, size, docked, snapRect, startResize, resetSize, headerProps } = useDraggableCard({
    eventId: event.id,
    embedded,
    anchored,
    dockRight,
    dockTop,
    leftX,
    topY,
  });
  const m = buildDetailModel(event, locale, t);

  // A day's list is replaced by its race card. Its focused button disappears,
  // so hand focus to the newly loaded card, including when it arrives lazily.
  useEffect(() => {
    if (anchored) cardRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [anchored, event.id, cardRef]);

  useLayoutEffect(() => {
    if (embedded || anchored) return;
    const card = cardRef.current;
    return () => {
      // Browser Back also dismisses the card, without going through its cross.
      if (!card?.contains(document.activeElement)) return;
      const row = visibleKeyboardItems(document).find((el) => el.dataset.eventId === card.dataset.eventId);
      if (row) focusKeyboardItem(row);
    };
  }, [embedded, anchored, cardRef]);

  function closePanel() {
    const card = cardRef.current;
    if (!embedded && !anchored && (card?.contains(document.activeElement) || document.activeElement === document.body)) {
      const row = visibleKeyboardItems(document).find((el) => el.dataset.eventId === event.id);
      if (row) focusKeyboardItem(row);
    }
    onClose();
  }

  useEffect(() => {
    if (embedded || anchored) return; // The containing dialog/popover owns Escape.
    function escape(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest("[role=dialog], [data-slot=popover-content], [role=menu], [role=listbox]")) return;
      e.preventDefault();
      closePanel();
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  });

  const panelVisible = useMediaQuery(embedded ? "(max-width: 767px)" : "(min-width: 768px)");
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!panelVisible || !cardRef.current?.getClientRects().length || seen.current === event.id) return;
    seen.current = event.id;
    track("race_view", { race_id: event.id, slug: event.slug, location: "race_panel", presentation: embedded ? "sheet" : "panel", has_registration: Boolean(event.registrationUrl), has_primary_outbound: Boolean(event.registrationUrl || event.websiteUrl || event.listingUrl || event.regulationsUrl), is_past: event.startDate < new Date().toISOString().slice(0, 10) });
  }, [event.id, event.slug, event.registrationUrl, event.websiteUrl, event.listingUrl, event.regulationsUrl, event.startDate, embedded, panelVisible, cardRef]);

  function trackEnter(kind: string) {
    track(kind === "register" ? "race_registration_start" : "outbound_click", { race_id: event.id, slug: event.slug, kind, location: "race_panel", presentation: embedded ? "sheet" : "panel" });
  }

  return (
    <>
    {snapRect ? (
      // Where the card will settle if it is let go here.
      <div
        aria-hidden
        className="pointer-events-none absolute z-30 rounded-xl bg-foreground/10"
        style={{ left: snapRect.x, top: snapRect.y, width: snapRect.w, height: snapRect.h }}
      />
    ) : null}
    <Card
      ref={cardRef}
      role="region"
      data-race-detail={!embedded && !anchored ? "floating" : undefined}
      data-event-id={event.id}
      aria-labelledby="race-detail-title"
      className={cn(
        // overflow-x-hidden: long series chips / nowrap buttons used to force a
        // horizontal scrollbar while the card was dragged around the map.
        "pointer-events-auto w-full gap-0 overflow-x-hidden overflow-y-hidden py-0",
        (dragging || resizing) && "select-none",
        embedded
          ? "flex h-full min-h-0 max-w-none flex-col border-0 shadow-none"
          : anchored
            ? "flex w-[340px] max-w-[calc(100vw-1.5rem)] max-h-[min(72dvh,36rem)] flex-col border-0 shadow-none"
            : "absolute z-40 flex flex-col shadow-lg",
      )}
      style={
        embedded || anchored
          ? undefined
          : {
              left: offset.x,
              top: offset.y,
              width: `min(${(docked ? null : size.w) ?? RACE_CARD_W}px, calc(100% - 1.5rem))`,
              // Snapped to a side: the map's whole height. Stretched: as tall as it was
              // made, no taller than the map. Otherwise as tall as its content.
              height: docked
                ? `calc(100% - ${offset.y + 12}px)`
                : size.h != null
                  ? `min(${size.h}px, calc(100% - ${offset.y + 12}px))`
                  : undefined,
              // Down to the map's foot, never past it: the card scrolls inside.
              maxHeight: `calc(100% - ${offset.y + 12}px)`,
            }
      }
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
            "font-semibold",
            embedded ? "text-[17px]" : "text-base",
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
            onClick={closePanel}
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
            : "pt-3 pb-4",
        )}
        inert={dragging || undefined}
      >
        <EmbeddedBody
          variant={embedded ? "sheet" : "card"}
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
          trustText={m.trustText}
          trustLow={m.trust === "low"}
          checkedText={m.checkedText && event.lastSeenAt ? m.checkedText : null}
          showOnMap={showOnMap}
        />
      </CardContent>

      {embedded ? null : (
        // The way to the race's own page, always in sight at the card's foot
        // however far its facts are scrolled. It used to be a small icon among
        // three others, and people did not know the card had a bigger version.
        <CardFooter className="shrink-0 border-t p-2 [.border-t]:pt-2" inert={dragging || undefined}>
          <Button asChild variant="secondary" className="w-full justify-between">
            <Link
              href={eventPagePath(locale, event.slug)}
              onClick={() => track("cta_click", { slug: event.slug, location: "race_panel", source: "full_detail" })}
            >
              {t.openRaceDetail}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardFooter>
      )}

      {!resizable ? null : (
        // Stretch it from a side or a bottom corner; a double click puts the
        // size back. Thin, so they do not take the scrollbar's place.
        <>
          {(["w", "e"] as const).map((edge) => (
            <div
              key={edge}
              aria-hidden
              onPointerDown={(e) => startResize(edge, e)}
              onDoubleClick={resetSize}
              className={cn("absolute inset-y-3 z-20 w-1 cursor-ew-resize touch-none hover:bg-border", edge === "w" ? "left-0" : "right-0")}
            />
          ))}
          <div
            aria-hidden
            onPointerDown={(e) => startResize("s", e)}
            onDoubleClick={resetSize}
            className="absolute inset-x-3 bottom-0 z-20 h-1 cursor-ns-resize touch-none hover:bg-border"
          />
          {(["sw", "se"] as const).map((edge) => (
            <div
              key={edge}
              aria-hidden
              onPointerDown={(e) => startResize(edge, e)}
              onDoubleClick={resetSize}
              className={cn("absolute bottom-0 z-20 size-3 touch-none", edge === "sw" ? "left-0 cursor-nesw-resize" : "right-0 cursor-nwse-resize")}
            />
          ))}
        </>
      )}
    </Card>
    </>
  );
}

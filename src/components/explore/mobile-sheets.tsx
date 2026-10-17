"use client";

/**
 * The phone layout: a map, a list on top of it, and a race card on top of that.
 *
 * There used to be one sheet doing two jobs. Tapping a race swapped the
 * list out of it and the card in, in the same frame that vaul was animating
 * the sheet to the card's height — the swap and the slide fought, and the
 * list's height and the card's height were two different state variables
 * feeding one `activeSnapPoint`, so every switch between them was a jump.
 * That is where the jerking came from, and "it opens and closes on its own"
 * was the sheet honouring whichever height had been set last.
 *
 * Two sheets, each with one job, and neither knows about the other:
 *
 *   - The list is permanent. It cannot be dismissed, it can be resized, and
 *     only its handle resizes it. Tapping the map does nothing to it.
 *   - The card is a second sheet above the list. It opens at a compact height,
 *     drags up to full, drags down to close, and when it closes the list is
 *     exactly where it was.
 *
 * Not `Drawer.NestedRoot`, deliberately. Nested drawers in vaul rewrite the
 * parent's transform to `scale(.95) translate3d(0,-16px,0)` when the child
 * opens — the parent is assumed to be a fully open sheet. This parent carries
 * its snap height in that same transform, so nesting would fling the list to
 * full screen every time a race was tapped. Two siblings with a z-index
 * between them get the stacking without the fight.
 */
import { useEffect, type ReactNode } from "react";
import { Map as MapIcon } from "lucide-react";
import { Drawer, DrawerContent, DrawerHandle, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const LIST_PEEK = "112px";
export const COMPACT = 0.5;
export const FULL = 0.92;

/**
 * The sheet vaul moves is an invisible frame; the card you see is drawn
 * inside it, exactly as tall as the part on screen.
 *
 * vaul's sheet is the full height of the viewport and slides down to its snap
 * point. Painting the sheet itself white meant that wherever its height and
 * the browser's idea of the viewport disagreed — and on a phone they do, as
 * the toolbar comes and goes — a white slab showed below the content with
 * nothing in it. The frame is transparent now and cannot show; only the
 * sized box has a background, a radius and a shadow, so there is never more
 * white than there is content.
 */
const FRAME = cn(
  "border-0 bg-transparent shadow-none md:hidden",
  // On the tab bar, not on the bottom edge: the tabs stay reachable from the
  // map, the way they are from every other screen.
  "data-[vaul-drawer-direction=bottom]:inset-x-2 data-[vaul-drawer-direction=bottom]:bottom-[calc(var(--mobile-tabbar)+0.5rem)]",
  "data-[vaul-drawer-direction=bottom]:rounded-none data-[vaul-drawer-direction=bottom]:mt-0",
  "data-[vaul-drawer-direction=bottom]:h-[100dvh] data-[vaul-drawer-direction=bottom]:max-h-[100dvh]",
);

const FRAME_STYLE = { height: "100dvh", maxHeight: "100dvh" } as const;

const CARD = cn(
  "relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-card",
  "shadow-[0_-4px_28px_rgba(28,25,23,.16)]",
);

/**
 * The same floating surface for the sheets that open on top — filters,
 * search — so everything that slides up from the bottom of the phone is the
 * same shape. These are modal and sized by their content, so no fixed height.
 */
export const MODAL_SURFACE = cn(
  "border-0 bg-card md:hidden",
  "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
  "shadow-[0_-4px_28px_rgba(28,25,23,.16)]",
  "data-[vaul-drawer-direction=bottom]:inset-x-2 data-[vaul-drawer-direction=bottom]:bottom-2",
  "data-[vaul-drawer-direction=bottom]:rounded-2xl",
);

/**
 * How much of the sheet is on screen at a snap point: the snap's share of
 * the viewport. vaul slides the frame down by the rest, and the frame already
 * sits `bottom-2` up, so the float is inside that share, not on top of it.
 *
 * Sizing the content to this is what puts a card's last row at the bottom of
 * the screen and lets the list scroll to its end. Without it the list's
 * scroll box thought it had twice the height it could show, and the last
 * screenful of rows could never be scrolled into view at the compact stop.
 */
export function visibleContentHeight(snap: number | string, viewportH: number): number {
  const shown = typeof snap === "number" ? snap * viewportH : Number.parseFloat(snap) || 0;
  return Math.max(0, Math.round(shown));
}

/** The card: the grab zone, then whatever the sheet holds, sized to the screen. */
function Visible({
  snap,
  viewportH,
  handleLabel,
  compactHandle = false,
  children,
}: {
  snap: number | string;
  viewportH: number;
  handleLabel: string;
  compactHandle?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={CARD} style={{ height: visibleContentHeight(snap, viewportH) }}>
      <GrabZone label={handleLabel} compact={compactHandle} />
      <div className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}

/**
 * A grab zone a thumb can find, with room around the pill.
 *
 * The grabber is a 40×4 pill. Its hit area spans the full width so the
 * detail sheet remains easy to drag without a tall empty strip above the race.
 */
function GrabZone({ label, compact }: { label: string; compact: boolean }) {
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", compact ? "h-5" : "h-7")}>
      {/* Inline, because vaul ships unlayered CSS for [data-vaul-handle] that
          sets a 5px height, and unlayered rules beat any utility class. */}
      <DrawerHandle
        aria-label={label}
        className="m-0 w-full py-0"
        style={{ width: "100%", height: compact ? 20 : 28, background: "transparent" }}
      />
    </div>
  );
}

/**
 * Give the page its clicks back while a non-modal sheet is open.
 *
 * vaul renders a Radix dialog, which is modal whatever `modal` says, and a
 * modal layer sets `pointer-events: none` on the body. vaul undoes that only
 * when the sheet opens itself; opened from outside — a race picked on the map —
 * the lock stayed, and the tab bar and everything else outside the card went
 * dead until a reload.
 */
function useUnlockBody(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      document.body.style.pointerEvents = "auto";
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
}

export function MobileListSheet({
  snap,
  onSnap,
  viewportH,
  title,
  handleLabel,
  mapLabel,
  children,
}: {
  snap: number | string;
  onSnap: (snap: number | string) => void;
  viewportH: number;
  title: string;
  handleLabel: string;
  mapLabel: string;
  children: ReactNode;
}) {
  useUnlockBody(true);
  return (
    <Drawer
      open
      dismissible={false}
      modal={false}
      shouldScaleBackground={false}
      setBackgroundColorOnScale={false}
      noBodyStyles
      repositionInputs={false}
      // A flick moves one stop, never two. A list that can shoot from peek to
      // full on a hard swipe is a list that ends up somewhere you did not ask.
      snapToSequentialPoint
      /*
       * Only the grab zone moves the sheet. vaul's own rule is that content
       * may scroll only when the sheet sits at translate 0 — the snap point
       * `1` — and at every other snap any movement of the finger is a drag.
       * With snaps at 0.42 and 0.92 the sheet is never at zero, so the list
       * could not be scrolled by touch at all: every attempt resized it.
       * Handle-only is the model Apple Maps uses, and it is unambiguous —
       * the pill resizes, everything else scrolls and taps.
       */
      handleOnly
      snapPoints={[LIST_PEEK, COMPACT, FULL]}
      activeSnapPoint={snap}
      setActiveSnapPoint={(point) => {
        if (point != null) onSnap(point);
      }}
    >
      <DrawerContent showOverlay={false} style={FRAME_STYLE} className={cn(FRAME, "z-20")}>
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <Visible snap={snap} viewportH={viewportH} handleLabel={handleLabel}>
          {children}
          {/*
            With the list at full height the map is a strip at the top of the
            screen, the one place a thumb cannot reach. The way back is where
            the thumb already is — a pill at the bottom, the way Maps does it —
            rather than a drag on a handle at the far end of the phone. Inside
            the visible box, not the sheet: the sheet's own bottom edge is off
            the screen at every snap point.
          */}
          {snap === FULL ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <Button
                type="button"
                size="lg"
                className="pointer-events-auto h-11 rounded-full px-5 shadow-lg touch-manipulation"
                onClick={() => onSnap(COMPACT)}
              >
                <MapIcon data-icon="inline-start" />
                {mapLabel}
              </Button>
            </div>
          ) : null}
        </Visible>
      </DrawerContent>
    </Drawer>
  );
}

export function MobileDetailSheet({
  open,
  snap,
  onSnap,
  viewportH,
  onClose,
  title,
  handleLabel,
  children,
}: {
  open: boolean;
  snap: number;
  onSnap: (snap: number) => void;
  viewportH: number;
  onClose: () => void;
  title: string;
  handleLabel: string;
  children: ReactNode;
}) {
  useUnlockBody(open);
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      // Swiping the card down is how it closes — the same gesture that
      // shrinks the list, doing the one thing a card can do in that direction.
      dismissible
      modal={false}
      shouldScaleBackground={false}
      setBackgroundColorOnScale={false}
      noBodyStyles
      repositionInputs={false}
      snapToSequentialPoint
      // Same rule as the list, for the same reason: the card's content
      // scrolls, the pill resizes or closes.
      handleOnly
      snapPoints={[COMPACT, FULL]}
      activeSnapPoint={snap}
      setActiveSnapPoint={(point) => {
        if (typeof point === "number") onSnap(point);
      }}
    >
      <DrawerContent showOverlay={false} style={FRAME_STYLE} className={cn(FRAME, "z-30")}>
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <Visible snap={snap} viewportH={viewportH} handleLabel={handleLabel} compactHandle>
          {children}
        </Visible>
      </DrawerContent>
    </Drawer>
  );
}

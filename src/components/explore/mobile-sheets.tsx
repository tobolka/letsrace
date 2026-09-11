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
 *   - The card is a second sheet above the list. It opens at half height,
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
import type { ReactNode } from "react";
import { Map as MapIcon } from "lucide-react";
import { Drawer, DrawerContent, DrawerHandle, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const LIST_PEEK = "112px";
export const HALF = 0.5;
export const FULL = 0.92;

/**
 * One surface for both sheets: floated off the edges with the map showing
 * down the sides, one radius on all four corners, full viewport height so a
 * snap point is a fraction of the screen and nothing else.
 */
const SURFACE = cn(
  "overflow-hidden border-0 bg-card md:hidden",
  "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
  "shadow-[0_-4px_28px_rgba(28,25,23,.16)]",
  "data-[vaul-drawer-direction=bottom]:inset-x-2 data-[vaul-drawer-direction=bottom]:bottom-2",
  "data-[vaul-drawer-direction=bottom]:rounded-2xl data-[vaul-drawer-direction=bottom]:mt-0",
  "data-[vaul-drawer-direction=bottom]:h-[100dvh] data-[vaul-drawer-direction=bottom]:max-h-[100dvh]",
);

const SURFACE_STYLE = { height: "100dvh", maxHeight: "100dvh" } as const;

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

/** The grab zone's height, which the visible content sits under. */
const GRAB_PX = 44;
/** The sheet floats `bottom-2` off the edge; that much of it is never on screen. */
const FLOAT_PX = 8;

/**
 * How much of the sheet is actually on screen at a snap point.
 *
 * vaul makes the sheet the full height of the viewport and slides it down, so
 * at half height the bottom half of the sheet is simply below the screen. A
 * card laid out to fill the sheet put its sticky footer — the "Enter" button,
 * the one thing on the card that matters — at y=1081 on an 812px phone, and
 * the list's scroll box thought it had twice the height it could show, so the
 * last screenful of rows could never be scrolled into view at all. Sizing the
 * content to the visible part is what puts the footer at the bottom of the
 * screen and lets the list scroll to its end.
 */
export function visibleContentHeight(snap: number | string, viewportH: number): number {
  const shown = typeof snap === "number" ? snap * viewportH : Number.parseFloat(snap) || 0;
  return Math.max(0, Math.round(shown) - GRAB_PX - FLOAT_PX);
}

function Visible({ snap, viewportH, children }: { snap: number | string; viewportH: number; children: ReactNode }) {
  return (
    <div
      className="relative flex min-h-0 flex-col"
      style={{ height: visibleContentHeight(snap, viewportH) }}
    >
      {children}
    </div>
  );
}

/**
 * A grab zone a thumb can find.
 *
 * The grabber is a 40×4 pill, and its hit area used to be the pill plus six
 * pixels — reach a little low and the finger is on the first filter chip, and
 * the drag becomes a tap. Forty-four points, the whole width, and the pill
 * sits in the middle of it.
 */
function GrabZone({ label }: { label: string }) {
  return (
    <DrawerHandle
      aria-label={label}
      className="mt-0 mb-0 h-11 shrink-0 py-0"
    />
  );
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
      snapPoints={[LIST_PEEK, HALF, FULL]}
      activeSnapPoint={snap}
      setActiveSnapPoint={(point) => {
        if (point != null) onSnap(point);
      }}
    >
      <DrawerContent showOverlay={false} style={SURFACE_STYLE} className={cn(SURFACE, "z-20")}>
        <GrabZone label={handleLabel} />
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <Visible snap={snap} viewportH={viewportH}>
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
                onClick={() => onSnap(HALF)}
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
      snapPoints={[HALF, FULL]}
      activeSnapPoint={snap}
      setActiveSnapPoint={(point) => {
        if (typeof point === "number") onSnap(point);
      }}
    >
      <DrawerContent showOverlay={false} style={SURFACE_STYLE} className={cn(SURFACE, "z-30")}>
        <GrabZone label={handleLabel} />
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <Visible snap={snap} viewportH={viewportH}>
          {children}
        </Visible>
      </DrawerContent>
    </Drawer>
  );
}

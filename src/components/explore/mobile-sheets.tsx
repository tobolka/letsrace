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
import { Drawer, DrawerContent, DrawerHandle, DrawerTitle } from "@/components/ui/drawer";
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
  title,
  handleLabel,
  children,
}: {
  snap: number | string;
  onSnap: (snap: number | string) => void;
  title: string;
  handleLabel: string;
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
        {children}
      </DrawerContent>
    </Drawer>
  );
}

export function MobileDetailSheet({
  open,
  snap,
  onSnap,
  onClose,
  title,
  handleLabel,
  children,
}: {
  open: boolean;
  snap: number;
  onSnap: (snap: number) => void;
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
        {children}
      </DrawerContent>
    </Drawer>
  );
}

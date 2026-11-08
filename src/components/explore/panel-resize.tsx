"use client";

import { useRef, useState, useSyncExternalStore } from "react";

/** A little narrower than it was, so the race card beside it can be wider. */
export const DEFAULT_PANEL_W = 360;
const MIN_PANEL_W = 320;
const MAX_PANEL_W = 560;
/** The race card floating over the map, beside the panel. */
export const RACE_CARD_W = 384;
/** How long the panel takes to slide in or out; the map waits for it. */
export const PANEL_SLIDE_MS = 240;
const COLLAPSED_KEY = "letsrace:map-list-collapsed";
const COLLAPSED_EVENT = "letsrace:map-list-collapsed";
/** The choice made on this page, for a browser that will not store it. */
let collapsedOverride: boolean | null = null;

function readCollapsed(): boolean {
  if (collapsedOverride != null) return collapsedOverride;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSED_EVENT, onChange);
  return () => window.removeEventListener(COLLAPSED_EVENT, onChange);
}

/**
 * How wide the panel may be dragged. The full-width list is its own page now
 * (the rail's second icon), so the panel only ever trades room with the map.
 */
function panelMaxWidth() {
  const stage = document.getElementById("shell-stage");
  const room = (stage?.clientWidth ?? window.innerWidth) - 12 - (RACE_CARD_W + 24);
  return Math.max(DEFAULT_PANEL_W, Math.min(MAX_PANEL_W, room));
}

export type PanelResize = {
  /** The width in force: the live one while the edge is dragged, else the chosen one. */
  width: number;
  dragging: boolean;
  /** The width the panel keeps once a drag or a key press has settled. */
  chosen: number;
  setChosen: (px: number) => void;
  /** The live width while dragging, null otherwise. */
  dragWidth: number | null;
  setDragging: (px: number | null) => void;
  /** The list is put away, leaving a small bar over the map. */
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  /**
   * Whether the map reaches under the panel's place. It follows `collapsed`,
   * except that on the way back it waits for the panel to finish sliding in:
   * the panel slides over a map that is still whole, and only then does the
   * map make room, so no bare strip shows behind the moving edge.
   */
  mapFull: boolean;
};

/** The side panel's width: kept while the page is open, live while its edge is dragged. */
export function usePanelResize(): PanelResize {
  const [chosen, setChosen] = useState(DEFAULT_PANEL_W);
  const [dragWidth, setDragging] = useState<number | null>(null);
  // Remembered per browser: someone who likes the map whole gets it whole.
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  // True for the moment the panel slides back in over a still-whole map.
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef(0);

  function setCollapsed(next: boolean) {
    window.clearTimeout(settleTimer.current);
    const store = () => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {}
      collapsedOverride = next;
      window.dispatchEvent(new Event(COLLAPSED_EVENT));
    };
    // The panel slides; on the way back the map waits for it, so no bare
    // strip shows behind the moving edge.
    if (!next) {
      setSettling(true);
      settleTimer.current = window.setTimeout(() => setSettling(false), PANEL_SLIDE_MS);
    } else setSettling(false);
    store();
  }

  return {
    width: dragWidth ?? chosen,
    dragging: dragWidth != null,
    chosen,
    setChosen,
    dragWidth,
    setDragging,
    collapsed,
    setCollapsed,
    mapFull: collapsed || settling,
  };
}

/** The grab strip on the panel's edge: drag it, or use the arrow keys, Home and End. */
export function PanelResizeHandle({ resize, label }: { resize: PanelResize; label: string }) {
  const { width, chosen, setChosen, dragWidth, setDragging } = resize;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls="race-list"
      aria-valuemin={MIN_PANEL_W}
      aria-valuemax={MAX_PANEL_W}
      aria-valuenow={Math.round(width)}
      aria-valuetext={`${Math.round(width)} px`}
      tabIndex={0}
      className="pointer-events-auto absolute inset-y-0 -right-2 z-10 w-4 cursor-col-resize touch-none outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        // The panel is this strip's parent, so a drag starts from the width it really has.
        setDragging(e.currentTarget.parentElement?.getBoundingClientRect().width ?? chosen);
      }}
      onPointerMove={(e) => {
        if (dragWidth == null) return;
        const left = document.getElementById("shell-stage")?.getBoundingClientRect().left ?? 0;
        setDragging(Math.min(panelMaxWidth(), Math.max(MIN_PANEL_W, e.clientX - left)));
      }}
      onPointerUp={() => {
        if (dragWidth == null) return;
        setChosen(Math.round(dragWidth));
        setDragging(null);
      }}
      onPointerCancel={() => setDragging(null)}
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const next =
          e.key === "Home"
            ? MIN_PANEL_W
            : e.key === "End"
              ? panelMaxWidth()
              : chosen + (e.key === "ArrowRight" ? 24 : -24);
        setChosen(Math.min(panelMaxWidth(), Math.max(MIN_PANEL_W, next)));
      }}
    />
  );
}

"use client";

import { useRef, useState, type RefObject } from "react";

const DEFAULT_PANEL_W = 400;
const MIN_PANEL_W = 340;
const MAX_PANEL_W = 560;

/**
 * How wide the panel may be dragged. The full-width list is its own page now
 * (the rail's second icon), so the panel only ever trades room with the map.
 */
function panelMaxWidth() {
  const stage = document.getElementById("shell-stage");
  const room = (stage?.clientWidth ?? window.innerWidth) - 12 - 344;
  return Math.max(DEFAULT_PANEL_W, Math.min(MAX_PANEL_W, room));
}

export type PanelResize = {
  /** Put on the panel, so a drag starts from the width it really has. */
  panelRef: RefObject<HTMLDivElement | null>;
  /** The width in force: the live one while the edge is dragged, else the chosen one. */
  width: number;
  dragging: boolean;
  /** The width the panel keeps once a drag or a key press has settled. */
  chosen: number;
  setChosen: (px: number) => void;
  /** The live width while dragging, null otherwise. */
  dragWidth: number | null;
  setDragging: (px: number | null) => void;
};

/** The side panel's width: kept while the page is open, live while its edge is dragged. */
export function usePanelResize(): PanelResize {
  const [chosen, setChosen] = useState(DEFAULT_PANEL_W);
  const [dragWidth, setDragging] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  return {
    panelRef,
    width: dragWidth ?? chosen,
    dragging: dragWidth != null,
    chosen,
    setChosen,
    dragWidth,
    setDragging,
  };
}

/** The grab strip on the panel's edge: drag it, or use the arrow keys, Home and End. */
export function PanelResizeHandle({ resize, label }: { resize: PanelResize; label: string }) {
  const { panelRef, width, chosen, setChosen, dragWidth, setDragging } = resize;
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
        setDragging(panelRef.current?.getBoundingClientRect().width ?? chosen);
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

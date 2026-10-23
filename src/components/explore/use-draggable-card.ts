"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

/** Must match the desktop list panel in explore-shell (width + gap). */
export const DEFAULT_CARD_X = 400 + 12;
const DEFAULT_Y = 12;
const DRAG_MARGIN = 12;

/**
 * The room the card floats in — the map's own box, not the window. With a rail
 * down the left edge the map is narrower than the window, and a card placed by
 * window width sat under the map's right edge.
 */
function stageSize(el: HTMLElement | null) {
  const stage = el?.offsetParent as HTMLElement | null;
  return {
    w: stage?.clientWidth || window.innerWidth,
    h: stage?.clientHeight || window.innerHeight,
  };
}

function clampPanelPos(x: number, y: number, el: HTMLElement | null) {
  const w = el?.offsetWidth ?? 320;
  const h = el?.offsetHeight ?? 200;
  const stage = stageSize(el);
  const maxX = Math.max(DRAG_MARGIN, stage.w - w - DRAG_MARGIN);
  const maxY = Math.max(DRAG_MARGIN, stage.h - h - DRAG_MARGIN);
  return {
    x: Math.min(maxX, Math.max(DRAG_MARGIN, x)),
    y: Math.min(maxY, Math.max(DRAG_MARGIN, y)),
  };
}

/**
 * Where the race card sits over the map, and the header you drag it by.
 *
 * Placed beside the list panel (or in the strip a full-width list leaves on
 * the right), kept inside the map's own box when the window changes, and
 * dragged by its header: the card follows the pointer with a transform and
 * settles into state on release. Embedded in the phone sheet, or anchored in a
 * popover, something else places it and none of this applies. A new race gives
 * the card a brief hop, unless the reader asked for less motion.
 */
export function useDraggableCard({
  eventId,
  embedded,
  anchored,
  dockRight,
  dockTop,
  leftX,
}: {
  eventId: string;
  embedded: boolean;
  anchored: boolean;
  dockRight: boolean;
  dockTop: number;
  leftX: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const offsetRef = useRef({ x: DEFAULT_CARD_X, y: DEFAULT_Y });
  const [offset, setOffset] = useState({ x: DEFAULT_CARD_X, y: DEFAULT_Y });
  const [dragging, setDragging] = useState(false);
  const prevEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (embedded || anchored) return;
    // Docked: the list leaves a strip on the right, so start there. Undocked
    // returns to the default beside the 400px panel. Dragging still works.
    const x = dockRight ? Math.max(12, stageSize(cardRef.current).w - 320 - 12) : leftX;
    // Docked, it starts below the account button that floats top-right.
    const next = clampPanelPos(x, dockRight ? dockTop : DEFAULT_Y, cardRef.current);
    offsetRef.current = next;
    setOffset(next);
  }, [dockRight, dockTop, embedded, anchored, leftX]);

  useEffect(() => {
    if (embedded || anchored) return;
    const onResize = () => {
      const next = clampPanelPos(offsetRef.current.x, offsetRef.current.y, cardRef.current);
      offsetRef.current = next;
      setOffset(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [embedded, anchored]);

  // Brief y-axis hop when the selected race changes — same card, new content.
  // Skip in the mobile sheet: Vaul already moved it, and a keyframe hop on
  // every pin tap fights the sheet and restarts from zero mid-browse.
  useEffect(() => {
    if (embedded || anchored) return;
    const el = cardRef.current;
    if (!el) return;
    if (prevEventIdRef.current === eventId) return;
    prevEventIdRef.current = eventId;
    if (dragging || dragRef.current) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    el.classList.remove("event-detail-jump");
    // Restart the keyframes even when the class was already applied.
    void el.offsetWidth;
    el.classList.add("event-detail-jump");
  }, [eventId, dragging, embedded, anchored]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName !== "event-detail-jump") return;
      el.classList.remove("event-detail-jump");
    };
    el.addEventListener("animationend", onEnd);
    return () => el.removeEventListener("animationend", onEnd);
  }, []);

  function onHeaderPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (embedded || anchored || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    const pos = offsetRef.current;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    setDragging(true);
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Don't let a leftover jump transform fight the drag translate.
    cardRef.current?.classList.remove("event-detail-jump");
  }

  function onHeaderPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const next = clampPanelPos(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY),
      cardRef.current,
    );
    const el = cardRef.current;
    if (el) el.style.transform = `translate(${next.x - drag.origX}px, ${next.y - drag.origY}px)`;
  }

  function endHeaderDrag(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const next = clampPanelPos(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY),
      cardRef.current,
    );
    dragRef.current = null;
    offsetRef.current = next;
    setOffset(next);
    setDragging(false);
    const el = cardRef.current;
    if (el) el.style.transform = "";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }
  return {
    cardRef,
    offset,
    dragging,
    headerProps: {
      onPointerDown: onHeaderPointerDown,
      onPointerMove: onHeaderPointerMove,
      onPointerUp: endHeaderDrag,
      onPointerCancel: endHeaderDrag,
      onLostPointerCapture: endHeaderDrag,
    },
  };
}

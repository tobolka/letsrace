"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

import { DEFAULT_PANEL_W, RACE_CARD_W } from "@/components/explore/panel-resize";

/** Beside the desktop list panel at its default width, with a gap. */
export const DEFAULT_CARD_X = DEFAULT_PANEL_W + 12;
const DEFAULT_Y = 12;
const DRAG_MARGIN = 12;

/** The card's own size, kept by the browser: someone who stretched it wants it stretched. */
const SIZE_KEY = "letsrace:race-card-size";
const MIN_W = 320;
const MAX_W = 720;
const MIN_H = 280;
/** How near the map's side the pointer must come for the card to snap to it. */
const SNAP_ZONE = 24;

export type CardSize = { w: number | null; h: number | null };
export type CardEdge = "e" | "w" | "s" | "se" | "sw";
export type CardSide = "left" | "right";
export type SnapRect = { x: number; y: number; w: number; h: number };

function readSize(): CardSize {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SIZE_KEY) ?? "null") as Partial<CardSize> | null;
    const w = typeof raw?.w === "number" ? Math.min(MAX_W, Math.max(MIN_W, raw.w)) : null;
    const h = typeof raw?.h === "number" ? Math.max(MIN_H, raw.h) : null;
    return { w, h };
  } catch {
    return { w: null, h: null };
  }
}

function saveSize(size: CardSize) {
  try {
    if (size.w == null && size.h == null) window.localStorage.removeItem(SIZE_KEY);
    else window.localStorage.setItem(SIZE_KEY, JSON.stringify(size));
  } catch {}
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

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

/** The least of the card that stays on the map; it shortens and scrolls below that. */
const MIN_VISIBLE_H = 240;

function clampPanelPos(x: number, y: number, el: HTMLElement | null) {
  const w = el?.offsetWidth ?? RACE_CARD_W;
  // Not the card's own height: a long card is as tall as the map, and clamping
  // by it pinned the card to the top, over the list's bar. Its height follows
  // where it sits, so only a usable piece of it has to fit below.
  const h = Math.min(el?.offsetHeight ?? 200, MIN_VISIBLE_H);
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
  topY = DEFAULT_Y,
}: {
  eventId: string;
  embedded: boolean;
  anchored: boolean;
  dockRight: boolean;
  dockTop: number;
  leftX: number;
  /** Where the card starts from the top when it sits beside the panel. */
  topY?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    /** It was snapped to a side when picked up; true once it has been pulled away. */
    wasDocked: boolean;
    pulledAway: boolean;
  } | null>(null);
  const offsetRef = useRef({ x: DEFAULT_CARD_X, y: DEFAULT_Y });
  const [offset, setOffset] = useState({ x: DEFAULT_CARD_X, y: DEFAULT_Y });
  const [dragging, setDragging] = useState(false);
  // What the reader stretched the card to; null is the default on that side.
  const [size, setSizeState] = useState<CardSize>({ w: null, h: null });
  const sizeRef = useRef<CardSize>({ w: null, h: null });
  // Snapped to a side of the map: the default width, the map's whole height.
  // The size the reader made is left alone, so pulling the card away gives it back.
  const [docked, setDocked] = useState<CardSide | null>(null);
  const dockedRef = useRef<CardSide | null>(null);
  const [snapRect, setSnapRect] = useState<(SnapRect & { side: CardSide }) | null>(null);
  const [resizing, setResizing] = useState(false);
  const prevEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (embedded || anchored) return;
    // Docked: the list leaves a strip on the right, so start there. Undocked
    // returns to the default beside the list panel. Dragging still works.
    const x = dockRight ? Math.max(12, stageSize(cardRef.current).w - RACE_CARD_W - 12) : leftX;
    // Docked, it starts below the account button that floats top-right.
    const next = clampPanelPos(x, dockRight ? dockTop : topY, cardRef.current);
    offsetRef.current = next;
    setOffset(next);
  }, [dockRight, dockTop, embedded, anchored, leftX, topY]);

  useEffect(() => {
    if (embedded || anchored) return;
    const onResize = () => {
      const side = dockedRef.current;
      if (side) {
        const rect = dockRect(side);
        offsetRef.current = { x: rect.x, y: rect.y };
        setOffset(offsetRef.current);
        return;
      }
      const next = clampPanelPos(offsetRef.current.x, offsetRef.current.y, cardRef.current);
      offsetRef.current = next;
      setOffset(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dockRect reads these props and refs only.
  }, [embedded, anchored, dockRight, dockTop, leftX, topY]);

  // A short fade-in when the selected race changes — same card, new content.
  // Skip in the mobile sheet: Vaul already moved it.
  useEffect(() => {
    if (embedded || anchored) return;
    const el = cardRef.current;
    if (!el) return;
    if (prevEventIdRef.current === eventId) return;
    prevEventIdRef.current = eventId;
    if (dragging || dragRef.current) return;
    el.classList.remove("event-detail-swap");
    // Restart the keyframes even when the class was already applied.
    void el.offsetWidth;
    el.classList.add("event-detail-swap");
  }, [eventId, dragging, embedded, anchored]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName !== "event-detail-swap") return;
      el.classList.remove("event-detail-swap");
    };
    el.addEventListener("animationend", onEnd);
    return () => el.removeEventListener("animationend", onEnd);
  }, []);

  function setSize(next: CardSize, persist = true) {
    sizeRef.current = next;
    setSizeState(next);
    if (persist) saveSize(next);
  }

  function setDock(side: CardSide | null) {
    dockedRef.current = side;
    setDocked(side);
  }

  useEffect(() => {
    if (embedded || anchored) return;
    // The saved size is only known in the browser, after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSize(readSize(), false);
  }, [embedded, anchored]);

  /** Where a card snapped to a side sits and how big it is. */
  function dockRect(side: CardSide): SnapRect {
    const stage = stageSize(cardRef.current);
    const w = Math.min(RACE_CARD_W, stage.w - 2 * DRAG_MARGIN);
    const y = dockRight ? dockTop : topY;
    return {
      x: side === "left" ? leftX : Math.max(DRAG_MARGIN, stage.w - w - DRAG_MARGIN),
      y,
      w,
      h: Math.max(MIN_H, stage.h - y - DRAG_MARGIN),
    };
  }

  /** The side of the map the pointer is at, if it is at one. */
  function sideAt(clientX: number): CardSide | null {
    const el = cardRef.current;
    const stage = el?.offsetParent as HTMLElement | null;
    if (!stage) return null;
    const px = clientX - stage.getBoundingClientRect().left;
    if (px <= leftX + 8) return "left";
    if (px >= stage.clientWidth - SNAP_ZONE) return "right";
    return null;
  }

  function dock(side: CardSide) {
    const rect = dockRect(side);
    setDock(side);
    offsetRef.current = { x: rect.x, y: rect.y };
    setOffset({ x: rect.x, y: rect.y });
  }

  /** The default size back, as when the card was first opened. */
  function resetSize() {
    setDock(null);
    setSize({ w: null, h: null });
    const next = clampPanelPos(offsetRef.current.x, offsetRef.current.y, cardRef.current);
    offsetRef.current = next;
    setOffset(next);
  }

  /** Stretch the card from one of its edges or corners. */
  function startResize(edge: CardEdge, e: PointerEvent<HTMLElement>) {
    const el = cardRef.current;
    if (embedded || anchored || e.button !== 0 || !el) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const stage = stageSize(el);
    const start = {
      x: e.clientX,
      y: e.clientY,
      w: el.offsetWidth,
      h: el.offsetHeight,
      left: offsetRef.current.x,
      top: offsetRef.current.y,
    };
    const live = { w: start.w, h: start.h, x: start.left };
    const stretchesHeight = edge.includes("s");
    // Docked or not, from here on the reader sets the size.
    setDock(null);
    setSnapRect(null);
    setResizing(true);

    const move = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      let w = start.w;
      if (edge.includes("e")) w = start.w + dx;
      if (edge.includes("w")) w = start.w - dx;
      const room = edge.includes("w") ? start.left + start.w - DRAG_MARGIN : stage.w - start.left - DRAG_MARGIN;
      w = clamp(w, MIN_W, Math.max(MIN_W, Math.min(MAX_W, room)));
      live.w = w;
      live.x = edge.includes("w") ? start.left + start.w - w : start.left;
      el.style.width = `${w}px`;
      el.style.left = `${live.x}px`;
      if (stretchesHeight) {
        live.h = clamp(start.h + dy, MIN_H, Math.max(MIN_H, stage.h - start.top - DRAG_MARGIN));
        el.style.height = `${live.h}px`;
      }
    };
    const end = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      if (handle.hasPointerCapture(ev.pointerId)) handle.releasePointerCapture(ev.pointerId);
      offsetRef.current = { x: live.x, y: start.top };
      setOffset(offsetRef.current);
      setSize({ w: Math.round(live.w), h: stretchesHeight ? Math.round(live.h) : sizeRef.current.h });
      setResizing(false);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

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
      wasDocked: dockedRef.current != null,
      pulledAway: false,
    };
    setDragging(true);
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Don't let a leftover jump transform fight the drag translate.
    cardRef.current?.classList.remove("event-detail-swap");
  }

  function onHeaderPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    // A snapped card holds until it is pulled a few pixels. Carried, it keeps
    // the width it had when picked up, and keeps it when let go.
    if (drag.wasDocked && !drag.pulledAway) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.pulledAway = true;
    }
    const next = clampPanelPos(drag.origX + dx, drag.origY + dy, cardRef.current);
    const el = cardRef.current;
    if (el) el.style.transform = `translate(${next.x - drag.origX}px, ${next.y - drag.origY}px)`;
    const side = sideAt(e.clientX);
    if (!side) {
      if (snapRect) setSnapRect(null);
    } else if (snapRect?.side !== side) {
      setSnapRect({ ...dockRect(side), side });
    }
  }

  function endHeaderDrag(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    const el = cardRef.current;
    if (el) el.style.transform = "";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const side = e.type === "pointerup" ? sideAt(e.clientX) : null;
    setSnapRect(null);
    // A click on a snapped card's header is not a move.
    if (drag.wasDocked && !drag.pulledAway) return;
    if (side) {
      dock(side);
      return;
    }
    const next = clampPanelPos(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY),
      cardRef.current,
    );
    if (drag.wasDocked) {
      // Let go away from the side: it keeps the width it had while carried (the
      // snapped one), and its height is its own again.
      setDock(null);
      setSize({ w: null, h: sizeRef.current.h });
    }
    offsetRef.current = next;
    setOffset(next);
  }
  return {
    cardRef,
    offset,
    dragging,
    resizing,
    size,
    docked,
    snapRect,
    startResize,
    resetSize,
    headerProps: {
      onPointerDown: onHeaderPointerDown,
      onPointerMove: onHeaderPointerMove,
      onPointerUp: endHeaderDrag,
      onPointerCancel: endHeaderDrag,
      onLostPointerCapture: endHeaderDrag,
    },
  };
}

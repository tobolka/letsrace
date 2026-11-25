"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type Entry = { isOpen: () => boolean; close: () => void };

/** Every popover and dropdown menu on the page, so that at most one is open. */
const overlays = new Map<string, Entry>();

let handoffUntil = 0;

/**
 * True for a moment after one overlay was closed because another opened.
 * The closing one must not hand focus back to its own button then: the new
 * one would see focus leave it and close too, leaving none open.
 */
export function isOverlayHandoff(): boolean {
  return Date.now() < handoffUntil;
}

/**
 * One standard for all popovers and dropdown menus in the app: opening one
 * closes whichever other one is open, wherever it sits (filter chips, the
 * column picker, the sort menu, the search). Works for controlled and
 * uncontrolled use alike, so call sites keep their own `open` state.
 */
export function useExclusiveOpen({
  open,
  defaultOpen = false,
  onOpenChange,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}): { open: boolean; onOpenChange: (open: boolean) => void } {
  const id = useId();
  const controlled = open !== undefined;
  const [inner, setInner] = useState(defaultOpen);
  const current = controlled ? open : inner;

  const latest = useRef({ controlled, current, onOpenChange });
  useEffect(() => {
    latest.current = { controlled, current, onOpenChange };
  });

  const change = useCallback((next: boolean) => {
    if (!latest.current.controlled) setInner(next);
    latest.current.onOpenChange?.(next);
  }, []);

  useEffect(() => {
    overlays.set(id, { isOpen: () => latest.current.current, close: () => change(false) });
    return () => {
      overlays.delete(id);
    };
  }, [id, change]);

  // Whatever opens it, by a click or by its owner's state, shuts the others.
  useEffect(() => {
    if (!current) return;
    for (const [otherId, other] of overlays) {
      if (otherId === id || !other.isOpen()) continue;
      handoffUntil = Date.now() + 300;
      other.close();
    }
  }, [current, id]);

  return { open: current, onOpenChange: change };
}

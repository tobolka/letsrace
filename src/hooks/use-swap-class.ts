"use client";

import { useState } from "react";

/**
 * A class that plays the icon swap, once the icon has actually changed.
 *
 * Put it on an element keyed by the same `id`: a new id mounts a new element,
 * and the class plays its entrance once. Nothing plays on the first render, so
 * a card that opens with a race already saved shows its tick without a flourish.
 * The state lives here, in the component that persists, because the button and
 * the link it turns into are different elements.
 */
export function useSwapClass(id: string): string | undefined {
  const [prev, setPrev] = useState(id);
  const [swapped, setSwapped] = useState(false);
  if (id !== prev) {
    setPrev(id);
    setSwapped(true);
  }
  return swapped ? "icon-swap-in" : undefined;
}

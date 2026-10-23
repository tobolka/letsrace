import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true after.
 *
 * For state that should read as "not yet" in the server's HTML and become real
 * once the browser has taken over, without an effect to flip it.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

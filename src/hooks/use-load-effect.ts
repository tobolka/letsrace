import { useEffect, type DependencyList } from "react";

/**
 * Start a loader when `deps` change, for loaders that set state as they go.
 *
 * The loader is started after the effect has returned, not inside it: whatever
 * it sets lands in a render of its own instead of cascading out of the commit
 * that scheduled it (react-hooks/set-state-in-effect). Loaders written as
 * `async function load()` keep working unchanged, including for a retry the
 * page calls by hand.
 */
export function useLoadEffect(load: () => Promise<unknown> | void, deps: DependencyList) {
  useEffect(() => {
    void Promise.resolve().then(load);
    // The caller names the inputs; `load` itself is a fresh closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

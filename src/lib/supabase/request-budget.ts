import { AsyncLocalStorage } from "node:async_hooks";

const deadlines = new AsyncLocalStorage<number>();

/** Every nested client in one write shares its deadline; no orphaned write promises. */
export function withDatabaseDeadline<T>(deadline: number, work: () => Promise<T>): Promise<T> {
  return deadlines.run(deadline, work);
}

export function databaseDeadline(): number | undefined { return deadlines.getStore(); }

export const boundedDatabaseFetch: typeof fetch = (input, init) => {
  const remaining = (databaseDeadline() ?? Infinity) - Date.now();
  if (remaining <= 0) return Promise.reject(new Error("write_time_budget_exhausted"));
  const timeout = AbortSignal.timeout(Math.max(1, Math.min(20_000, remaining)));
  const original = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  return fetch(input, { ...init, signal: original ? AbortSignal.any([original, timeout]) : timeout });
};

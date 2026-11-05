import { AsyncLocalStorage } from "node:async_hooks";

const deadlines = new AsyncLocalStorage<number>();

export type DatabaseWorkload = "public-web" | "publication" | "watch" | "discovery" | "monitor" | "weather-history" | "catalogue-maintenance";
type DatabaseRequestCounts = { attempts: number; failed: number };
const workloads = new AsyncLocalStorage<DatabaseWorkload>();
const requestCounts = new AsyncLocalStorage<DatabaseRequestCounts>();

export function withDatabaseWorkload<T>(workload: DatabaseWorkload, work: () => T): T {
  return workloads.run(workload, work);
}

export function withDatabaseRequestCounts<T>(work: (counts: DatabaseRequestCounts) => T): T {
  const counts = { attempts: 0, failed: 0 };
  return requestCounts.run(counts, () => work(counts));
}

/** Every nested client in one write shares its deadline; no orphaned write promises. */
export function withDatabaseDeadline<T>(deadline: number, work: () => Promise<T>): Promise<T> {
  return deadlines.run(deadline, work);
}

export function databaseDeadline(): number | undefined { return deadlines.getStore(); }

export function databaseFetch(defaultWorkload?: DatabaseWorkload): typeof fetch {
  return async (input, init) => {
    const remaining = (databaseDeadline() ?? Infinity) - Date.now();
    if (remaining <= 0) throw new Error("write_time_budget_exhausted");
    const timeout = AbortSignal.timeout(Math.max(1, Math.min(20_000, remaining)));
    const original = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const workload = workloads.getStore() ?? defaultWorkload;
    if (workload) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const client = headers.get("x-client-info");
      headers.set("x-client-info", client ? `${client} letsrace:${workload}` : `letsrace:${workload}`);
      init = { ...init, headers };
    }
    const counts = requestCounts.getStore();
    if (counts) counts.attempts++;
    const started = performance.now();
    try {
      const response = await fetch(input, { ...init, signal: original ? AbortSignal.any([original, timeout]) : timeout });
      if (counts && !response.ok) counts.failed++;
      return response;
    } catch (error) {
      if (counts) counts.failed++;
      if (workload === "public-web") {
        let resource = "unknown";
        try {
          const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
          if (/^\/rest\/v1\/(?:rpc\/)?[a-z0-9_]+$/i.test(path)) resource = path;
        } catch { /* The failing URL is never copied into a log. */ }
        console.warn("public_database_request_failed", {
          resource, elapsedMs: Math.round(performance.now() - started),
          timeoutAborted: timeout.aborted, callerAborted: original?.aborted ?? false,
          errorName: error instanceof Error ? error.name : "unknown",
        });
      }
      throw error;
    }
  };
}

export const boundedDatabaseFetch = databaseFetch();

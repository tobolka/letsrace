/** Simple concurrency + per-host polite gating for scrapers. */

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, concurrency);
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

type GateState = { chain: Promise<unknown>; lastAt: number };

const hostGates = new Map<string, GateState>();

/** Serialize work per host and enforce a minimum gap between starts. */
export async function withHostGate<T>(
  host: string,
  minIntervalMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const key = host.replace(/^www\./, "").toLowerCase();
  const state = hostGates.get(key) ?? { chain: Promise.resolve(), lastAt: 0 };
  let release!: (v: unknown) => void;
  const next = new Promise((r) => {
    release = r;
  });
  const prev = state.chain;
  state.chain = prev.then(() => next);
  hostGates.set(key, state);

  await prev.catch(() => undefined);
  const wait = Math.max(0, minIntervalMs - (Date.now() - state.lastAt));
  if (wait > 0) await sleep(wait);
  state.lastAt = Date.now();
  try {
    return await fn();
  } finally {
    release(undefined);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

/** Host-specific polite intervals (ms) between requests. */
export function hostIntervalMs(host: string): number {
  const h = host.replace(/^www\./, "").toLowerCase();
  if (h.includes("sumator.cz")) return 350;
  if (h.includes("nominatim") || h.includes("openstreetmap")) return 1100;
  if (h.includes("hynekmusil.cz")) return 400;
  if (h.includes("mtbs.cz")) return 400;
  if (h.includes("eventivsport.com")) return 200;
  if (h.includes("radsport-events.de")) return 250;
  if (h.includes("federciclismo.it")) return 220;
  return 200;
}

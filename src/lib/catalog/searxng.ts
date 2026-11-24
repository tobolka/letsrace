/**
 * Local SearXNG JSON search provider ($0 forever when running SearXNG on the
 * Mac, e.g. SEARXNG_URL=http://127.0.0.1:8888). Polite spacing avoids upstream
 * engine throttling.
 */

import type { BraveHit } from "./brave";

export type SearxngHit = BraveHit;

export function searxngAvailable(): boolean {
  return Boolean(process.env.SEARXNG_URL?.trim());
}

export class SearxngUnavailable extends Error {}

const COUNTRY_LANG: Record<string, string> = {
  cz: "cs-CZ",
  sk: "sk-SK",
  pl: "pl-PL",
  de: "de-DE",
  at: "de-AT",
  ch: "de-CH",
  it: "it-IT",
};

let searches = 0;
let last = 0;
let queue: Promise<void> = Promise.resolve();

async function searchSlot(): Promise<void> {
  const slot = queue.then(async () => {
    const wait = last + 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
  });
  queue = slot.catch(() => {});
  await slot;
}

export function resetSearxngProcessCounter() {
  searches = 0;
}

export async function searxngSearch(
  query: string,
  opts?: { count?: number; country?: string | null },
): Promise<SearxngHit[]> {
  const base = process.env.SEARXNG_URL?.trim().replace(/\/+$/, "");
  if (!base) throw new SearxngUnavailable("SEARXNG_URL is not set");
  await searchSlot();
  const limit = Number(process.env.SEARXNG_SEARCH_LIMIT ?? 100);
  if (!Number.isFinite(limit) || limit <= 0 || searches >= limit) {
    throw new SearxngUnavailable(`SearXNG search limit of ${limit} for this process reached`);
  }
  searches += 1;
  const params = new URLSearchParams({ q: query, format: "json", categories: "general" });
  const cc = opts?.country?.toLowerCase();
  if (cc && COUNTRY_LANG[cc]) params.set("language", COUNTRY_LANG[cc]!);
  const res = await fetch(`${base}/search?${params}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new SearxngUnavailable(`SearXNG HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as {
    results?: { url?: string; title?: string; content?: string }[];
  };
  const max = Math.min(30, Math.max(1, opts?.count ?? 10));
  return (body.results ?? [])
    .filter((r): r is { url: string; title?: string; content?: string } => Boolean(r.url))
    .slice(0, max)
    .map((r) => ({
      url: r.url,
      title: (r.title ?? "").trim(),
      description: (r.content ?? "").trim(),
    }));
}

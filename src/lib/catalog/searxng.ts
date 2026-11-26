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
let searxngDown: string | null = null;
let last = 0;
let queue: Promise<void> = Promise.resolve();

function formatError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as { code?: string }).code;
    return code ? `${error.message} (${code})` : `${error.message} (${cause.message})`;
  }
  return error.message;
}

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
  searxngDown = null;
}

export async function checkSearxngHealth(
  timeoutMs = 2000,
): Promise<{ configured: boolean; ok: boolean; error?: string }> {
  const base = process.env.SEARXNG_URL?.trim().replace(/\/+$/, "");
  if (!base) return { configured: false, ok: false };
  const deadline = Date.now() + Math.max(100, timeoutMs);
  const probe = async (url: string): Promise<Response> =>
    fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(Math.max(100, deadline - Date.now())),
    });
  try {
    let res = await probe(`${base}/healthz`);
    if (res.status === 404) {
      await res.body?.cancel().catch(() => {});
      res = await probe(`${base}/search?q=test&format=json`);
    }
    await res.body?.cancel().catch(() => {});
    if (res.ok) return { configured: true, ok: true };
    return { configured: true, ok: false, error: `HTTP ${res.status}` };
  } catch (error) {
    return { configured: true, ok: false, error: formatError(error) };
  }
}

export async function searxngSearch(
  query: string,
  opts?: { count?: number; country?: string | null },
): Promise<SearxngHit[]> {
  const base = process.env.SEARXNG_URL?.trim().replace(/\/+$/, "");
  if (!base) throw new SearxngUnavailable("SEARXNG_URL is not set");
  if (searxngDown) {
    throw new SearxngUnavailable(`SearXNG unavailable in this process: ${searxngDown}`);
  }
  await searchSlot();
  if (searxngDown) {
    throw new SearxngUnavailable(`SearXNG unavailable in this process: ${searxngDown}`);
  }
  const limit = Number(process.env.SEARXNG_SEARCH_LIMIT ?? 100);
  if (!Number.isFinite(limit) || limit <= 0 || searches >= limit) {
    throw new SearxngUnavailable(`SearXNG search limit of ${limit} for this process reached`);
  }
  searches += 1;
  const params = new URLSearchParams({ q: query, format: "json", categories: "general" });
  const cc = opts?.country?.toLowerCase();
  if (cc && COUNTRY_LANG[cc]) params.set("language", COUNTRY_LANG[cc]!);
  let res: Response;
  try {
    res = await fetch(`${base}/search?${params}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const msg = formatError(error);
    searxngDown = msg;
    throw new SearxngUnavailable(`SearXNG unreachable: ${msg}`);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status >= 500) searxngDown = `HTTP ${res.status}`;
    throw new SearxngUnavailable(`SearXNG HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  let body: {
    results?: { url?: string; title?: string; content?: string }[];
  };
  try {
    body = (await res.json()) as {
      results?: { url?: string; title?: string; content?: string }[];
    };
  } catch (error) {
    const msg = formatError(error);
    if (!(error instanceof SyntaxError)) searxngDown = msg;
    throw new SearxngUnavailable(`SearXNG invalid response: ${msg}`);
  }
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

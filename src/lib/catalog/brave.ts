/**
 * Brave's web search API: a list of results (address, title, snippet) for a
 * query, from a real search index, for a fraction of a cent. It does not ask
 * a script to prove it is human, which DuckDuckGo and Google do.
 */

export type BraveHit = { url: string; title: string; description: string };

export function braveAvailable(): boolean {
  return Boolean(process.env.BRAVE_API_KEY);
}

const strip = (s: string | undefined) =>
  (s ?? "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").trim();

export class BraveUnavailable extends Error {}

let searches = 0;
let last = 0;
let queue: Promise<void> = Promise.resolve();

/** Reserve a start time serially, even when several readers search concurrently. */
async function searchSlot(): Promise<void> {
  const slot = queue.then(async () => {
    const wait = last + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
  });
  queue = slot.catch(() => {});
  await slot;
}

export async function braveSearch(query: string, opts?: { count?: number; country?: string | null }): Promise<BraveHit[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error("BRAVE_API_KEY is not set");
  // The free plan answers one query a second.
  await searchSlot();
  const limit = Number(process.env.BRAVE_SEARCH_LIMIT ?? 40);
  if (!Number.isFinite(limit) || limit < 0 || searches >= limit) throw new BraveUnavailable(`Brave search limit of ${limit} for this process reached`);
  searches += 1;
  const params = new URLSearchParams({ q: query, count: String(Math.min(20, Math.max(1, opts?.count ?? 10))), extra_snippets: "true" });
  if (opts?.country) params.set("country", opts.country.toLowerCase());
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: { accept: "application/json", "x-subscription-token": key },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 422 && opts?.country) return braveSearch(query, { ...opts, country: null });
  if (!res.ok) throw new Error(`Brave search HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { web?: { results?: { url?: string; title?: string; description?: string; extra_snippets?: string[] }[] } };
  return (body.web?.results ?? [])
    .filter((r): r is { url: string; title?: string; description?: string; extra_snippets?: string[] } => Boolean(r.url))
    .map((r) => ({ url: r.url, title: strip(r.title), description: [r.description, ...(r.extra_snippets ?? [])].map(strip).filter(Boolean).join(" … ") }));
}

/**
 * Unified web search helper for discovery and organiser website lookup.
 * Prefers local SearXNG ($0 unlimited), then Serper.dev (Google fallback), then Brave.
 */

import { braveAvailable, braveSearch, BraveUnavailable, type BraveHit } from "./brave";
import { serperAvailable, serperSearch, SerperUnavailable } from "./serper";
import { searxngAvailable, searxngSearch, SearxngUnavailable } from "./searxng";

export type FreeSearchProvider = "serper" | "searxng" | "brave";

export function activeSearchProviders(): FreeSearchProvider[] {
  const out: FreeSearchProvider[] = [];
  if (searxngAvailable() && Number(process.env.SEARXNG_SEARCH_LIMIT ?? 100) > 0) out.push("searxng");
  if (serperAvailable() && Number(process.env.SERPER_SEARCH_LIMIT ?? 15) > 0) out.push("serper");
  if (braveAvailable() && Number(process.env.BRAVE_SEARCH_LIMIT ?? 0) > 0) out.push("brave");
  return out;
}

export function webSearchAvailable(): boolean {
  return activeSearchProviders().length > 0;
}

export async function runWebSearch(
  query: string,
  opts?: { count?: number; country?: string | null },
): Promise<{ provider: FreeSearchProvider; hits: BraveHit[] }> {
  const providers = activeSearchProviders();
  let lastError: unknown;
  let emptyFallback: { provider: FreeSearchProvider; hits: BraveHit[] } | null = null;
  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i]!;
    const hasNext = i < providers.length - 1;
    try {
      const hits =
        provider === "searxng"
          ? await searxngSearch(query, opts)
          : provider === "serper"
            ? await serperSearch(query, opts)
            : await braveSearch(query, opts);
      if (hits.length === 0 && hasNext) {
        emptyFallback = { provider, hits };
        continue;
      }
      return { provider, hits };
    } catch (error) {
      lastError = error;
      if (
        error instanceof SerperUnavailable ||
        error instanceof SearxngUnavailable ||
        error instanceof BraveUnavailable
      ) {
        continue;
      }
      throw error;
    }
  }
  if (emptyFallback) return emptyFallback;
  throw lastError instanceof Error ? lastError : new Error("No web search provider configured");
}

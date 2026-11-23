/**
 * Unified web search helper for discovery and organiser website lookup.
 * Prefers Serper.dev (Google index), then local SearXNG ($0), then Brave.
 */

import { braveAvailable, braveSearch, BraveUnavailable, type BraveHit } from "./brave";
import { serperAvailable, serperSearch, SerperUnavailable } from "./serper";
import { searxngAvailable, searxngSearch, SearxngUnavailable } from "./searxng";

export type FreeSearchProvider = "serper" | "searxng" | "brave";

export function activeSearchProviders(): FreeSearchProvider[] {
  const out: FreeSearchProvider[] = [];
  if (serperAvailable() && Number(process.env.SERPER_SEARCH_LIMIT ?? 15) > 0) out.push("serper");
  if (searxngAvailable() && Number(process.env.SEARXNG_SEARCH_LIMIT ?? 25) > 0) out.push("searxng");
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
  for (const provider of providers) {
    try {
      if (provider === "serper") return { provider, hits: await serperSearch(query, opts) };
      if (provider === "searxng") return { provider, hits: await searxngSearch(query, opts) };
      return { provider, hits: await braveSearch(query, opts) };
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
  throw lastError instanceof Error ? lastError : new Error("No web search provider configured");
}

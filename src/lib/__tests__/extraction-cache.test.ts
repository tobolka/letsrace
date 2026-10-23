import { afterEach, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ rows: new Map<string, unknown>(), failRead: false, failWrite: false }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ from: () => {
  let key = "";
  const query = {
    delete() { return this; },
    lt: async () => ({ error: null }),
    select() { return this; },
    eq(_column: string, value: string) { key = value; return this; },
    gt() { return this; },
    maybeSingle: async () => ({ data: storage.rows.get(key) ?? null, error: storage.failRead ? { message: "cache unavailable" } : null }),
    upsert: async (row: { key: string }) => {
      if (storage.failWrite) return { error: { message: "cache unavailable" } };
      storage.rows.set(row.key, row);
      return { error: null };
    },
  };
  return query;
} }) }));
afterEach(() => { vi.unstubAllEnvs(); storage.rows.clear(); storage.failRead = storage.failWrite = false; });
const usage = { tokensIn: 100, tokensOut: 100, costUsd: 0.001 };

it("reuses the private database cache after process memory is reset", async () => {
  vi.stubEnv("LLM_EXTRACTION_CACHE_BACKEND", "supabase");
  vi.resetModules();
  let { cachedExtraction } = await import("@/lib/llm/extraction-cache");
  const run = vi.fn(async () => ({ value: { races: [] }, usage }));
  await cachedExtraction({ source: "persistent" }, run);
  vi.resetModules();
  ({ cachedExtraction } = await import("@/lib/llm/extraction-cache"));
  const replay = await cachedExtraction({ source: "persistent" }, run);
  expect(replay.cached).toBe(true);
  expect(replay.usage.costUsd).toBe(0);
  expect(run).toHaveBeenCalledTimes(1);
});

it("does not pay for a model request when the configured durable cache cannot be read", async () => {
  vi.stubEnv("LLM_EXTRACTION_CACHE_BACKEND", "supabase");
  storage.failRead = true;
  vi.resetModules();
  const { cachedExtraction } = await import("@/lib/llm/extraction-cache");
  const run = vi.fn();
  await expect(cachedExtraction({ source: "failed-read" }, run)).rejects.toThrow("cache unavailable");
  expect(run).not.toHaveBeenCalled();
});

it("preserves billed usage when saving a successful response fails", async () => {
  vi.stubEnv("LLM_EXTRACTION_CACHE_BACKEND", "supabase");
  storage.failWrite = true;
  vi.resetModules();
  const { cachedExtraction } = await import("@/lib/llm/extraction-cache");
  await expect(cachedExtraction({ source: "failed-write" }, async () => ({ value: { races: [] }, usage }))).rejects.toMatchObject({ usage });
});

import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ sourceInserts: [] as unknown[], writes: [] as { table: string; value: Record<string, unknown> }[], fetch: vi.fn(), extract: vi.fn(), hide: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ rpc: async (name: string) => ({ data: name === "pipeline_claim_source" ? [{ key: "source:source", token: "test-lease" }] : true, error: null }), from: (table: string) => {
  let inserted = false;
  const chain: unknown = new Proxy({}, { get: (_target, key) => {
    if (key === "maybeSingle") return async () => ({ data: null, error: null });
    if (key === "then") return (resolve: (value: unknown) => void) => resolve({ data: inserted && table === "ingest_runs" ? { id: "run" } : [], error: null, count: 0 });
    return (...args: unknown[]) => {
      if (key === "insert") { inserted = true; if (table === "watched_urls") state.sourceInserts.push(args[0]); }
      if (key === "update") state.writes.push({ table, value: args[0] as Record<string, unknown> });
      return chain;
    };
  } });
  return chain;
} }) }));
vi.mock("@/lib/watcher/core", async original => ({ ...await original<typeof import("@/lib/watcher/core")>(), fetchPage: state.fetch, extractEvents: state.extract }));
vi.mock("@/lib/catalog/freshness", () => ({ hideDroppedCalendarEvents: state.hide, touchLastSeenForWatchedUrl: vi.fn() }));
import { watchOne } from "@/lib/watcher/run";
import { WATCH_READER_VERSION, canReconcileMissingEvents } from "@/lib/watcher/core";
afterEach(() => { state.writes.length = 0; state.sourceInserts.length = 0; vi.clearAllMocks(); });

it("does not checkpoint or hide missing races after an incomplete read and retries without old HTTP validators", async () => {
  state.fetch.mockResolvedValue({ status: 200, html: "<p>calendar</p>", hash: "new", etag: "new-etag", unchanged: false });
  state.extract.mockResolvedValue({ events: [], childUrls: [], confidence: 0, strategy: "generic+llm", complete: false, issues: ["calendar_budget_exhausted"] });
  const result = await watchOne({ id: "source", url: "https://club.test/calendar", kind: "calendar", last_extract_status: "needs_review", content_hash: "old", etag: "old-etag" });
  expect(result.ok).toBe(false);
  expect(result.extractionComplete).toBe(false);
  expect(state.fetch).toHaveBeenCalledWith("https://club.test/calendar", undefined);
  expect(state.hide).not.toHaveBeenCalled();
  const checkpoint = state.writes.find(w => w.table === "watched_urls" && "content_hash" in w.value)?.value;
  expect(checkpoint).toMatchObject({ content_hash: null, etag: null, last_modified: null, last_extract_status: "needs_review" });
  expect(state.writes.find(w => w.table === "ingest_runs")?.value.ok).toBe(false);
});

it("forces a read after an extractor upgrade, then uses versioned HTTP checkpoints", async () => {
  state.fetch.mockResolvedValue({ status: 304, html: "", hash: "hash", unchanged: true });
  await watchOne({ id: "source", url: "https://club.test/calendar", content_hash: "legacy-hash", etag: "old" });
  expect(state.fetch).toHaveBeenLastCalledWith("https://club.test/calendar", undefined);
  await watchOne({ id: "source", url: "https://club.test/calendar", content_hash: `${WATCH_READER_VERSION}:hash`, etag: "etag" });
  expect(state.fetch).toHaveBeenLastCalledWith("https://club.test/calendar", { etag: "etag", contentHash: "hash", lastModified: undefined });
});

it("does not infer removal from an AI omission even after every chunk was read", () => {
  const read = { events: [], childUrls: [], strategy: "generic+llm", confidence: 0.7, complete: true };
  expect(canReconcileMissingEvents(read)).toBe(false);
  expect(canReconcileMissingEvents({ ...read, strategy: "adapter:tbc", complete: false })).toBe(false);
  expect(canReconcileMissingEvents({ ...read, strategy: "adapter:tbc" })).toBe(true);
});

it("preserves certificate failure diagnostics without accepting an unsafe connection", async () => {
  state.fetch.mockRejectedValue(new Error("fetch failed", { cause: Object.assign(new Error("unable to get local issuer certificate"), { code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" }) }));
  const result = await watchOne({ id: "source", url: "https://club.test/calendar", kind: "calendar" });
  expect(result.ok).toBe(false);
  expect(result.error).toContain("TLS certificate verification failed (UNABLE_TO_GET_ISSUER_CERT_LOCALLY)");
  expect(state.extract).not.toHaveBeenCalled();
  expect(state.hide).not.toHaveBeenCalled();
});

it("does not invent next-season sources by changing the year of a calendar address", async () => {
  state.fetch.mockResolvedValue({ status: 200, html: "<p>calendar</p>", hash: "new", unchanged: false });
  state.extract.mockResolvedValue({ events: [], childUrls: [], confidence: 0, strategy: "adapter:test", complete: true });
  await watchOne({ id: "source", url: `https://club.test/calendar-${new Date().getFullYear()}/`, kind: "calendar" });
  expect(state.sourceInserts).toEqual([]);
});

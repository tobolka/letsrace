import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ known: [] as { external_id: string; event: { updated_at: string } }[], sourceInserts: [] as unknown[], writes: [] as { table: string; value: Record<string, unknown> }[], fetch: vi.fn(), extract: vi.fn(), hide: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ rpc: async (name: string, args: Record<string, unknown>) => {
  if (name === "pipeline_claim_source_read") return { data: [{ key: "source:source", token: "test-lease", payload: { sourceRevision: "2026-11-04" } }], error: null };
  if (name === "pipeline_commit_source_read") {
    state.writes.push({ table: "watched_urls", value: args.p_patch as Record<string, unknown> });
    state.writes.push({ table: "ingest_runs", value: args.p_run_result as Record<string, unknown> });
  }
  return { data: true, error: null };
}, from: (table: string) => {
  let inserted = false;
  const chain: unknown = new Proxy({}, { get: (_target, key) => {
    if (key === "maybeSingle") return async () => ({ data: null, error: null });
    if (key === "then") return (resolve: (value: unknown) => void) => resolve({ data: inserted && table === "ingest_runs" ? { id: "run" } : table === "event_sources" ? state.known : [], error: null, count: 0 });
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
afterEach(() => { state.known.length = 0; state.writes.length = 0; state.sourceInserts.length = 0; vi.clearAllMocks(); });

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

it("keeps a complete calendar checkpoint while a conflicting row waits and skips successful siblings", async () => {
  const { calendarRowHash, calendarRowProgress } = await import("@/lib/watcher/calendar-progress");
  const rows = Array.from({ length: 197 }, (_, i) => ({
    externalId: String(i), name: `Race ${i}`, startDate: "2027-04-20",
    sourceUrl: "https://odjazd.pl/", placeText: "Warszawa", confidence: 0.9,
  }));
  const now = Date.now();
  const version = `${WATCH_READER_VERSION}:`;
  const saved = rows.map((event, i) => {
    const entry = calendarRowProgress(calendarRowHash(event), now, i === 0 ? 4 : 0);
    return [event.externalId, entry.hash, entry.until, entry.conflicts];
  });
  state.known.push(...rows.map(event => ({ external_id: event.externalId, event: { updated_at: "2026-11-04" } })));
  state.fetch.mockResolvedValue({ status: 200, html: "<p>calendar</p>", hash: "stable", etag: "stable-etag" });
  state.extract.mockResolvedValue({ events: rows, childUrls: [], confidence: 0.9, strategy: "adapter:odjazd", complete: true });
  const source = { id: "source", url: "https://odjazd.pl/", kind: "calendar",
    calendar_write_progress: { version: `calendar-v1:${version}calendar:https://odjazd.pl/`, rows: saved } };
  const waiting = await watchOne(source);
  expect(waiting).toMatchObject({ ok: false, eventsUpserted: 0, eventsFailed: 0, eventsDeferred: 1 });
  expect(state.hide).not.toHaveBeenCalled();
  expect(state.writes.find(w => "content_hash" in w.value)?.value).toMatchObject({
    content_hash: `${version}stable`, etag: "stable-etag", last_extract_status: "needs_review",
  });
  expect(state.writes.find(w => w.table === "ingest_runs")?.value.metrics).toMatchObject({
    attempted: 0, pendingWrites: 1, skippedUnchanged: 197,
  });

  // A changed fact behind the unchanged landing page bypasses the old row delay.
  rows[0] = { ...rows[0]!, startDate: "2027-05-20" };
  state.writes.length = 0;
  const changed = await watchOne(source, { deadline: Date.now() });
  expect(changed.issues).toContain("write_failed:0:write_time_budget_exhausted");
  expect(state.writes.find(w => w.table === "ingest_runs")?.value.metrics).toMatchObject({ attempted: 1, skippedUnchanged: 196 });
  expect(state.hide).not.toHaveBeenCalled();
});

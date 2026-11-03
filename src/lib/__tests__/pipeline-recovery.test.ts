import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateEventPreservingKey } from "@/lib/watcher/write-event";
import { summarizeWatches } from "@/lib/watcher/run-summary";
import type { WatchOutcome } from "@/lib/watcher/run";
import { extractGeneric } from "@/lib/watcher/extractors/generic";
import { scoreDuplicate, hasIdentityConflict } from "@/lib/dedup";
import { isArchiveDiscoveryUrl } from "@/lib/watcher/discovery-policy";

const evidence = { revision: "revision", sourceUrl: "https://race.test/" };
it("uses a single protected update and adopts only the confirmed applied fields", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { retainedKey: true, changed: true, applied: { name: "Verified race" } }, error: null });
  const db = { rpc } as unknown as SupabaseClient;
  const payload = { fingerprint: "another-row-key", name: "Verified race" };
  expect(await updateEventPreservingKey(db, "matched-race", payload, evidence)).toEqual({ retainedKey: true, changed: true });
  expect(payload).toEqual({ name: "Verified race" });
  expect(rpc).toHaveBeenCalledOnce();
  expect(rpc).toHaveBeenCalledWith("pipeline_update_watcher_event", expect.objectContaining({ p_event: "matched-race", p_revision: "revision" }));
});

it("does not retry database failures without protection or invent a receipt", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "database unavailable" } });
  const db = { rpc } as unknown as SupabaseClient;
  await expect(updateEventPreservingKey(db, "race", {}, evidence)).rejects.toThrow("database unavailable");
  expect(rpc).toHaveBeenCalledOnce();
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(updateEventPreservingKey(db, "race", {}, evidence)).rejects.toThrow("not confirmed");
});

it("retries a concurrent correction without turning it into an owner decision", () => {
  expect(summarizeWatches([{ watchedUrlId: "a", url: "https://race.test/", ok: false, eventsUpserted: 0, linksDiscovered: 0, error: "concurrent_event_update: race changed before write" }])).toMatchObject({ failed: 0, deferred: 1 });
});

it("reports a budget deferral separately without classifying partial failed writes as success", () => {
  const base: WatchOutcome = { watchedUrlId: "a", url: "https://race.test", ok: false, eventsUpserted: 0, linksDiscovered: 0 };
  expect(summarizeWatches([
    { ...base, error: "LLM budget of $0.1: not enough left" },
    { ...base, error: "LLM budget of $0.1; write failed", eventsFailed: 1 },
    { ...base, ok: true, eventsUpserted: 7, eventsCreated: 2 },
  ])).toMatchObject({ watched: 3, failed: 1, deferred: 1, upserted: 7, created: 2 });
});

it("does not turn archived results, old news, or a live footer date into today's race", () => {
  const oldNews = '<h1>5. Etappe beim RSV Ebringen</h1><article>Ergebnisse vom 12.06.2017</article><footer>23.10.2026</footer>';
  expect(extractGeneric("https://club.test/etappe-2017/", oldNews)).toEqual([]);
  expect(extractGeneric("https://club.test/ergebnisse/", '<h1>Ergebnisse</h1><p>24.10.2026 Perlcross</p>')).toEqual([]);
  expect(extractGeneric("https://club.test/", '<h1>Rozpis</h1><p>24.10.2026</p>')).toEqual([]);
});

it("keeps a road ride separate from the gravel ride at the same venue", () => {
  const base = { startDate: "2027-05-30", placeText: "Wenigumstadt", urls: ["https://club.test/entry"] };
  const verdict = scoreDuplicate({ ...base, name: "RSV Wenigumstadt Gravel Day", disciplines: ["gravel"] }, { ...base, name: "Volksradfahren Wenigumstadt", disciplines: ["road"] });
  expect(verdict.reasons).toContain("discipline_conflict");
  expect(hasIdentityConflict(verdict.reasons)).toBe(true);
});

it("does not rediscover tag listings, old seasons or results as fresh races", () => {
  expect(isArchiveDiscoveryUrl("https://club.test/rennen-2017/", 2026)).toBe(true);
  expect(isArchiveDiscoveryUrl("https://club.test/cykloman-archiv/r2003/babi.html", 2026)).toBe(true);
  expect(isArchiveDiscoveryUrl("https://club.test/r2027/race.html", 2026)).toBe(false);
  expect(isArchiveDiscoveryUrl("https://club.test/tag/rennen/", 2026)).toBe(true);
  expect(isArchiveDiscoveryUrl("https://club.test/ergebnisse_2026.html", 2026)).toBe(true);
  expect(isArchiveDiscoveryUrl("https://club.test/cyclocross-2026-2027/", 2026)).toBe(false);
  expect(isArchiveDiscoveryUrl("https://club.test/rennen-2027/", 2026)).toBe(false);
});

it("separates unsupported reads from failures without hiding failed writes", () => {
  const base: WatchOutcome = { watchedUrlId: "a", url: "https://race.test", ok: false, eventsUpserted: 0, linksDiscovered: 0 };
  expect(summarizeWatches([
    { ...base, error: "unsupported_or_empty_source" },
    { ...base, error: "low confidence or empty extract" },
    { ...base, error: "dynamic_render_unavailable" },
    { ...base, error: "unsupported_or_empty_source", eventsFailed: 1 },
    { ...base, error: "HTTP 401" },
  ])).toMatchObject({ watched: 5, failed: 2, unreadable: 3, deferred: 0 });
});

it("commits normal source enrichment with the protected race update", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { retainedKey: false, changed: true, applied: { name: "Verified race" } }, error: null });
  const db = { rpc } as unknown as SupabaseClient;
  const payload = { name: "Verified race" };
  const source = { watchedUrlId: "watched", kind: "race", event: { externalId: "one", name: "Verified race", startDate: "2027-05-01", placeText: "Town", sourceUrl: "https://race.test/", confidence: 1 } };
  expect(await updateEventPreservingKey(db, "race", payload, { ...evidence, source })).toEqual({ retainedKey: false, changed: true });
  expect(rpc).toHaveBeenCalledWith("pipeline_update_watcher_bundle", expect.objectContaining({ p_source: expect.objectContaining({ watchedUrlId: "watched" }), p_categories: [] }));
});

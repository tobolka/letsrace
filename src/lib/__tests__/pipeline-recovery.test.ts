import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateEventPreservingKey } from "@/lib/watcher/write-event";
import { summarizeWatches } from "@/lib/watcher/run-summary";
import type { WatchOutcome } from "@/lib/watcher/run";
import { extractGeneric } from "@/lib/watcher/extractors/generic";
import { scoreDuplicate, hasIdentityConflict } from "@/lib/dedup";
import { isArchiveDiscoveryUrl } from "@/lib/watcher/discovery-policy";

it("retains the matched event's key on a collision without touching the other event", async () => {
  const values: Record<string, unknown>[] = [];
  const eq = vi.fn().mockResolvedValueOnce({ error: { code: "23505", message: 'duplicate key events_fingerprint_key' } }).mockResolvedValueOnce({ error: null });
  const db = { from: vi.fn(() => ({ update: (payload: Record<string, unknown>) => { values.push({ ...payload }); return { eq }; } })) } as unknown as SupabaseClient;
  const payload = { fingerprint: "another-row-key", name: "Verified race", start_date: "2026-11-01" };
  expect(await updateEventPreservingKey(db, "matched-race", payload)).toEqual({ retainedKey: true });
  expect(values).toEqual([{ fingerprint: "another-row-key", name: "Verified race", start_date: "2026-11-01" }, { name: "Verified race", start_date: "2026-11-01" }]);
  expect(eq.mock.calls).toEqual([["id", "matched-race"], ["id", "matched-race"]]);
});

it("does not hide a failed second update or retry unrelated database errors", async () => {
  for (const errors of [ [{ code: "XX001", message: "database unavailable" }], [{ code: "23505", message: "events_fingerprint_key" }, { message: "update denied" }] ]) {
    const eq = vi.fn(); for (const error of errors) eq.mockResolvedValueOnce({ error });
    const db = { from: () => ({ update: () => ({ eq }) }) } as unknown as SupabaseClient;
    await expect(updateEventPreservingKey(db, "race", { fingerprint: "key" })).rejects.toThrow(errors.at(-1)!.message);
    expect(eq).toHaveBeenCalledTimes(errors.length);
  }
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
  expect(isArchiveDiscoveryUrl("https://club.test/tag/rennen/", 2026)).toBe(true);
  expect(isArchiveDiscoveryUrl("https://club.test/ergebnisse_2026.html", 2026)).toBe(true);
  expect(isArchiveDiscoveryUrl("https://club.test/cyclocross-2026-2027/", 2026)).toBe(false);
  expect(isArchiveDiscoveryUrl("https://club.test/rennen-2027/", 2026)).toBe(false);
});

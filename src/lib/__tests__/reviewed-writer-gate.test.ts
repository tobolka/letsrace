import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { candidateAssertion, type ReviewRow, type ReviewDecision } from "@/lib/discovery/review";
import { ingestReviewedCandidate } from "@/lib/watcher/run";
import type { ParsedEvent } from "@/lib/domain";

const mocks = vi.hoisted(() => ({ read: vi.fn(), db: vi.fn() }));
vi.mock("@/lib/watcher/http", async importOriginal => ({ ...await importOriginal<object>(), fetchPage: mocks.read }));
vi.mock("@/lib/supabase/server", async importOriginal => ({ ...await importOriginal<object>(), createServerSupabase: mocks.db }));

const html = "<body><p>Lesák CUP 28. 8. 2027</p><p>Hronov</p></body>";
const event: ParsedEvent = { externalId: "race", name: "Lesák CUP", startDate: "2027-08-28", placeText: "Hronov", countryHint: "CZ", discipline: ["mtb"], sourceUrl: "https://race.test/", confidence: .9,
  evidence: { sourceUrl: "https://race.test/", quote: "Lesák CUP 28. 8. 2027", method: "llm_calendar", version: "test" } };
const row: ReviewRow = { ...candidateAssertion(event, { sourceUrl: event.sourceUrl, documentHash: createHash("sha256").update(html).digest("hex"), reason: "review" }), id: "candidate", status: "waiting", decision: null, event_id: null, created_at: "now", updated_at: "now" };
const decision: ReviewDecision = { id: row.id, evidenceHash: row.evidence_hash, action: "publish", reason: "Primary source checked", authority: "official", expectedEventId: null,
  checked: { identity: true, date: true, place: true, discipline: true, authority: true } };
const publication = { id: row.id, evidenceHash: row.evidence_hash, token: "claim-token" };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
  mocks.read.mockReset().mockResolvedValue({ html, status: 200, hash: "not-trusted", unchanged: false });
  mocks.db.mockReset().mockImplementation(() => { throw Error("Unexpected database access"); });
});
afterEach(() => vi.useRealTimers());

it("enforces the evidence-bound decision even when called without the review script", async () => {
  await expect(ingestReviewedCandidate(row, { ...decision, evidenceHash: "wrong" }, publication)).rejects.toThrow("evidence changed");
  expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.db).not.toHaveBeenCalled();
});
it("rechecks the source itself before reaching any database write", async () => {
  mocks.read.mockResolvedValue({ html: html.replace("28. 8.", "29. 8."), status: 200, hash: "old-hash-is-not-proof", unchanged: false });
  await expect(ingestReviewedCandidate(row, decision, publication)).rejects.toThrow("changed or unavailable");
  expect(mocks.read).toHaveBeenCalledWith(event.sourceUrl, { fresh: true });
  expect(mocks.db).not.toHaveBeenCalled();
});
it("rejects a fabricated passage before touching source or event records", async () => {
  const invented = { ...row, payload: JSON.parse(JSON.stringify({ ...event, evidence: { ...event.evidence, quote: "Lesák CUP 28. 8. 2027\nA fabricated confirmation" } })) };
  await expect(ingestReviewedCandidate(invented, decision, publication)).rejects.toThrow("not present");
  expect(mocks.db).not.toHaveBeenCalled();
});
it("respects a rejected source inside the writer and never reaches event writes", async () => {
  const eq = vi.fn().mockResolvedValue({ data: [{ status: "rejected" }], error: null });
  const from = vi.fn().mockImplementation(table => {
    expect(table).toBe("discovered_links"); return { select: () => ({ eq }) };
  });
  mocks.db.mockReturnValue({ from });
  await expect(ingestReviewedCandidate(row, decision, publication)).rejects.toThrow("explicitly rejected");
  expect(from).toHaveBeenCalledOnce();
});

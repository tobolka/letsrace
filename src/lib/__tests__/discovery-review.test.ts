import { expect, it, vi } from "vitest";
import { candidateAssertion, sameCandidateFacts, saveCandidate, validateReview, type ReviewRow, type ReviewDecision } from "@/lib/discovery/review";
import { discoveryPlan } from "@/lib/discovery/plan";
import { assessCandidate } from "@/lib/discovery/assessment";
import type { ParsedEvent } from "@/lib/domain";
const event: ParsedEvent = { externalId: "race", name: "Lesák CUP", startDate: "2027-08-28", placeText: "Červený Kostelec", countryHint: "CZ", discipline: ["mtb"], sourceUrl: "https://lesak-cup.cz/", confidence: 0.9,
  evidence: { quote: "Lesák CUP 28. 8. 2027", sourceUrl: "https://lesak-cup.cz/", method: "llm_calendar", version: "v7" } };
const assertion = candidateAssertion(event, { sourceUrl: event.sourceUrl, documentHash: "hash", reason: "review" });
const row: ReviewRow = { ...assertion, id: "candidate", status: "pending", created_at: "now", updated_at: "now", decision: null, event_id: null };
const decision: ReviewDecision = { id: row.id, evidenceHash: row.evidence_hash, action: "publish", reason: "Reviewed official source, date, place and identity", authority: "official", expectedEventId: null,
  checked: { identity: true, date: true, place: true, discipline: true, authority: true } };
it('keeps reviewed facts resolved across changed document decorations, but reopens changed facts', () => {
 const payload = JSON.parse(JSON.stringify(event));
 expect(sameCandidateFacts(payload, { ...payload, confidence: 0.2, evidence: { quote: 'changed navigation and counters' } })).toBe(true);
 for (const change of [{ startDate: '2027-08-29' }, { countryHint: 'SK' }, { placeText: 'Hronov' }, { discipline: ['road'] }, { endDate: '2027-08-29' }]) {
  expect(sameCandidateFacts(payload, { ...payload, ...change })).toBe(false);
 }
});
it('does not requeue an explicitly reviewed unchanged assertion and preserves changed assertions', async () => {
 const upsert = vi.fn().mockResolvedValue({ error: null });
 const not = vi.fn().mockResolvedValue({ data: [{ payload: event }], error: null });
 const chain: Record<string, unknown> = { upsert, not };
 for (const method of ['select','eq','in']) chain[method] = () => chain;
 const db = { from: () => chain } as unknown as Parameters<typeof saveCandidate>[0];
 await saveCandidate(db, { ...event, confidence: 0.3 }, { sourceUrl: event.sourceUrl, documentHash: 'changed-html', reason: 'scan' });
 expect(upsert).not.toHaveBeenCalled();
 expect(not).toHaveBeenCalledWith('decision->>reviewedAt', 'is', null);
 await saveCandidate(db, { ...event, startDate: '2027-08-29' }, { sourceUrl: event.sourceUrl, documentHash: 'changed-date', reason: 'scan' });
 expect(upsert).toHaveBeenCalledOnce();
});
it('does not discard evidence when the review lookup fails', async () => {
 const upsert = vi.fn();
 const chain: Record<string, unknown> = { upsert, not: () => ({ data: null, error: { message: 'database unavailable' } }) };
 for (const method of ['select','eq','in']) chain[method] = () => chain;
 const db = { from: () => chain } as unknown as Parameters<typeof saveCandidate>[0];
 await expect(saveCandidate(db, event, { sourceUrl: event.sourceUrl, documentHash: 'new', reason: 'scan' })).rejects.toThrow('Reading candidate decision');
 expect(upsert).not.toHaveBeenCalled();
});
it("binds decisions to evidence and refuses missing identity or authority approval", () => {
  expect(() => validateReview(row, decision, "2026-10-25")).not.toThrow();
  expect(() => validateReview(row, { ...decision, evidenceHash: "stale" }, "2026-10-25")).toThrow("evidence changed");
  expect(() => validateReview(row, { ...decision, checked: undefined }, "2026-10-25")).toThrow("reviewed");
  expect(() => validateReview(row, { ...decision, expectedEventId: undefined }, "2026-10-25")).toThrow("identity");
  expect(() => validateReview({ ...row, status: "publishing" }, decision, "2026-10-25")).toThrow("publishing");
});
it("stable evidence is idempotent, while changed content needs a new decision", () => {
  expect(candidateAssertion(event, { sourceUrl: event.sourceUrl, documentHash: "hash", reason: "retry" }).evidence_hash).toBe(row.evidence_hash);
  const changed = candidateAssertion(event, { sourceUrl: event.sourceUrl, documentHash: "new", reason: "retry" });
  expect(changed.candidate_key).toBe(row.candidate_key);
  expect(changed.evidence_hash).not.toBe(row.evidence_hash);
});
it("keeps tentative dates in review and rejects the wrong edition", () => {
  const tentative = { ...event, evidence: { ...event.evidence!, quote: "Předběžně Lesák CUP 28. 8. 2027" } };
  expect(() => validateReview({ ...row, payload: JSON.parse(JSON.stringify(tentative)) }, decision, "2026-10-25")).toThrow("tentative");
  expect(() => validateReview({ ...row, season: 2026 }, decision, "2026-10-25")).toThrow("edition");
});
it("searches Slovakia in the local language and retains winter sources", () => {
  const plan = discoveryPlan(2027, ["ai", "brave"], "SK");
  expect(plan.every(p => p.country === "SK")).toBe(true);
  expect(plan.map(p => p.query).join(" ")).toMatch(/Slovensko/);
  expect(plan.map(p => p.query).join(" ")).toContain("2026/2027");
  expect(assessCandidate({ ...event, countryHint: "SK", placeText: "Bratislava" }, "SK").state).toBe("needs_review");
  expect(assessCandidate(event, "SK").state).toBe("out_of_scope");
});
it("does not mistake event preparations for an explicitly provisional date", () => {
  expect(assessCandidate({ ...event, evidence: { ...event.evidence!, quote: 'Pořadatel připravuje Lesák CUP. Závod se koná 28. 8. 2027.' } }).dateStatus).toBe('requires_verification');
  expect(assessCandidate({ ...event, evidence: { ...event.evidence!, quote: 'Termín připravujeme. Lesák CUP 28. 8. 2027.' } }).dateStatus).toBe('tentative');
});
it('does not reopen the same review for changing HTML decoration with identical source text', () => {
  const first = candidateAssertion(event, { sourceUrl: event.sourceUrl, documentHash: 'html-a', textHash: 'same-text', reason: 'read' });
  const second = candidateAssertion(event, { sourceUrl: event.sourceUrl, documentHash: 'html-b', textHash: 'same-text', reason: 'read' });
  expect(first.evidence_hash).toBe(second.evidence_hash);
  expect(candidateAssertion(event, { sourceUrl: event.sourceUrl, documentHash: 'html-b', textHash: 'new-text', reason: 'read' }).evidence_hash).not.toBe(first.evidence_hash);
});
it('supports all seven requested countries, including Italian discovery', () => {
 for (const country of ['SK','DE','AT','CH','IT','PL','CZ'] as const) {
  const plan = discoveryPlan(2027, ['ai','brave'], country);
  expect(plan.length).toBeGreaterThan(1);
  expect(plan.every(p => p.country === country && !p.query.includes('undefined'))).toBe(true);
 }
 expect(discoveryPlan(2027, ['brave'], 'IT').map(p => p.query).join(' ')).toContain('Italia calendario gare ciclismo');
 expect(discoveryPlan(2027, ['ai'], 'IT')[0]?.query).toContain('Itálii');
});

import { describe, expect, it } from "vitest";
import { checkReaderOutput, failuresInARow, isFailure, nextAttempt } from "@/lib/pipeline2/queue";

const H = 3600;
const race = "00000000-0000-4000-8000-000000000001";
const proposal = { event_id: race, field: "regulations_url", value: "https://club.test/propozice.pdf", source_url: "https://club.test/propozice.pdf", quote: "Propozice závodu 2027", reader: "site_documents", version: "2" };
const allowed = { eventIds: [race], fields: ["regulations_url"], reader: "site_documents" };

describe("queue layer", () => {
  it("waits longer after each real failure and stops at the fifth", () => {
    const failed = { outcome: "failed" as const, reason: "http_error" as const };
    expect([0, 1, 2, 3, 4, 5].map(n => nextAttempt(failed, n))).toEqual([
      { delaySeconds: H, failures: 1, stopped: false }, { delaySeconds: 6 * H, failures: 2, stopped: false },
      { delaySeconds: 24 * H, failures: 3, stopped: false }, { delaySeconds: 72 * H, failures: 4, stopped: false },
      { delaySeconds: 168 * H, failures: 5, stopped: true }, { delaySeconds: 168 * H, failures: 6, stopped: true },
    ]);
  });

  it("does not count circumstances as failures", () => {
    for (const ended of [
      { outcome: "blocked", reason: "robot_check" }, { outcome: "waiting", reason: "ai_budget" },
      { outcome: "waiting", reason: "no_document_yet" }, { outcome: "waiting", reason: "capability_missing" }, { outcome: "partial", reason: "partial" },
    ] as const) {
      expect(isFailure(ended)).toBe(false);
      expect(nextAttempt(ended, 2).failures).toBe(2);
    }
    expect(nextAttempt({ outcome: "blocked", reason: "robot_check" }, 0, { usualSeconds: 7 * 24 * H }).delaySeconds).toBe(7 * 24 * H);
    expect(nextAttempt({ outcome: "partial", reason: "partial" }, 0).delaySeconds).toBe(60);
    expect(nextAttempt({ outcome: "waiting", reason: "ai_budget" }, 0, { untilBudgetSeconds: 1234 }).delaySeconds).toBe(1234);
  });

  it("counts failures in a row from the recorded attempts", () => {
    const attempt = (outcome: string, error: string | null = null) => ({ outcome, error });
    expect(failuresInARow([])).toBe(0);
    expect(failuresInARow([attempt("retry", "failed:http_error"), attempt("retry", "timeout:timeout")])).toBe(2);
    // A shut website in between is neither a failure nor a fresh start.
    expect(failuresInARow([attempt("retry", "failed:http_error"), attempt("retry", "blocked:robot_check"), attempt("retry", "failed:crashed")])).toBe(2);
    expect(failuresInARow([attempt("retry", "failed:http_error"), attempt("done"), attempt("retry", "failed:http_error")])).toBe(1);
    expect(failuresInARow([attempt("retry", "failed:http_error"), attempt("retry", "partial:partial")])).toBe(0);
    // An expired lease says the worker vanished, not that the task is broken.
    expect(failuresInARow([attempt("lease_expired"), attempt("lease_expired")])).toBe(0);
  });

  it("accepts a reader's output only in the expected shape", () => {
    const good = checkReaderOutput({ outcome: "done", reason: null, proposals: [proposal], stats: { documents: 3, "bad key!": 1, text: "x" } }, allowed);
    expect(good).toEqual({ ok: true, output: { outcome: "done", reason: null, proposals: [proposal], stats: { documents: 3 } } });
    expect(checkReaderOutput({ outcome: "waiting", reason: "no_document_yet", proposals: [] }, allowed).ok).toBe(true);
  });

  it("refuses everything when one part is out of shape", () => {
    const bad = (change: object, top: object = {}) => checkReaderOutput({ outcome: "done", proposals: [{ ...proposal, ...change }], ...top }, allowed);
    expect(checkReaderOutput("done", allowed).ok).toBe(false);
    expect(bad({}, { outcome: "great" }).ok).toBe(false);
    expect(bad({}, { reason: "because I say so" }).ok).toBe(false);
    // A race the task was not given, or a field it may not fill.
    expect(bad({ event_id: "00000000-0000-4000-8000-000000000002" })).toMatchObject({ ok: false, why: expect.stringContaining("not given") });
    expect(bad({ field: "start_date" })).toMatchObject({ ok: false, why: expect.stringContaining("may not fill") });
    expect(bad({ value: "javascript:alert(1)" }).ok).toBe(false);
    expect(bad({ value: "https://club.test/a b.pdf" }).ok).toBe(false);
    expect(bad({ source_url: "file:///etc/passwd" }).ok).toBe(false);
    expect(bad({ quote: "  " }).ok).toBe(false);
    expect(bad({ reader: "someone_else" }).ok).toBe(false);
    expect(checkReaderOutput({ outcome: "done", proposals: Array(201).fill(proposal) }, allowed).ok).toBe(false);
  });
});

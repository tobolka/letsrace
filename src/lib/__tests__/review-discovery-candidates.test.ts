import { describe, expect, it, vi } from "vitest";
import { ReviewSourceChangedError } from "@/lib/discovery/review-source";
import type { ReviewDecision } from "@/lib/discovery/review";
import {
  classifyCandidatePublishError,
  loadResumeDecisions,
  requeuePreClaimPublishingCandidate,
  settleCandidatePublishError,
} from "../../../scripts/review-discovery-candidates";

const decision: ReviewDecision = {
  id: "cand-1",
  evidenceHash: "hash-1",
  action: "publish",
  reason: "Reviewed primary source",
  expectedEventId: null,
  authority: "official",
  checked: { identity: true, date: true, place: true, discipline: true, authority: true },
};

describe("classifyCandidatePublishError", () => {
  it("classifies permanent review-required and policy-rejection errors as review_required", () => {
    const permanent = [
      new ReviewSourceChangedError("Source changed or unavailable: cand-1; re-read and review"),
      new Error("identity_review_required: multiple matching races; source row deferred"),
      new Error("identity_review_required: catalogue changed since the reviewed identity (expected new race, matched evt-2)"),
      new Error("Publishing candidate: identity_review_required: source belongs to another race"),
      new Error("pipeline_data_review_required:end_before_start"),
      new Error("Reviewed assertion was rejected by ingestion policy"),
      new Error("Source was explicitly rejected/ignored"),
      new Error("Source is paused/dead; explicit source review required"),
      new Error("Publishing candidate: Reviewed identity is no longer public"),
      new Error("Review quote is not present in the source document"),
      new Error("UCI directory competition differs from the current directory"),
      new Error("Candidate is outside its reviewed future edition"),
    ];
    for (const error of permanent) {
      expect(classifyCandidatePublishError(error), error.message).toBe("review_required");
    }
  });

  it("keeps transient network, HTTP, concurrency, and unknown errors as retry", () => {
    const transient = [
      new Error("Source unavailable: cand-1 (HTTP 503)"),
      new Error("fetch failed"),
      new Error("ETIMEDOUT"),
      new Error("Publishing candidate: deadlock detected"),
      new Error("Candidate publication lease lost"),
      new Error("Source changed concurrently"),
      new Error("concurrent_event_update: matching race was created while preparing the import"),
      new Error("Publication interrupted"),
      { message: "connection terminated unexpectedly" },
      null,
    ];
    for (const error of transient) {
      expect(classifyCandidatePublishError(error)).toBe("retry");
    }
  });
});

describe("settleCandidatePublishError", () => {
  it("transitions permanent review/policy failures out of publishing to waiting with needsReview", async () => {
    const filters: Array<[string, unknown[]]> = [];
    let updatedPatch: Record<string, unknown> | undefined;
    const select = vi.fn().mockResolvedValue({ data: [{ id: "cand-1" }], error: null });
    const builder: Record<string, unknown> = { select };
    for (const method of ["eq", "gt"]) {
      builder[method] = (...args: unknown[]) => {
        filters.push([method, args]);
        return builder;
      };
    }
    const update = vi.fn((patch: Record<string, unknown>) => {
      updatedPatch = patch;
      return builder;
    });
    const rpc = vi.fn();
    const db = { from: vi.fn(() => ({ update })), rpc } as unknown as Parameters<typeof settleCandidatePublishError>[0]["db"];

    const now = "2026-11-26T21:10:00.000Z";
    const error = new Error("identity_review_required: multiple matching races; source row deferred");
    const outcome = await settleCandidatePublishError({
      db,
      row: { id: "cand-1", evidence_hash: "hash-1" },
      decision,
      token: "tok-1",
      error,
      now,
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      id: "cand-1",
      status: "review_required",
      error: "identity_review_required: multiple matching races; source row deferred",
    });
    expect(updatedPatch).toEqual({
      status: "waiting",
      publish_token: null,
      publish_lease_until: null,
      publish_error: "identity_review_required: multiple matching races; source row deferred",
      decision: {
        previousPublication: decision,
        followUp: { version: 1, attempts: 0, failures: 0, needsReview: true, nextCheckAt: now, documents: [] },
      },
      updated_at: now,
    });
    expect(filters).toEqual([
      ["eq", ["id", "cand-1"]],
      ["eq", ["status", "publishing"]],
      ["eq", ["publish_token", "tok-1"]],
      ["eq", ["evidence_hash", "hash-1"]],
      ["gt", ["publish_lease_until", now]],
    ]);
  });

  it("throws with cause if the candidate changed concurrently before requeue", async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    const builder: Record<string, unknown> = { select };
    for (const method of ["eq", "gt"]) builder[method] = () => builder;
    const db = {
      from: vi.fn(() => ({ update: () => builder })),
      rpc: vi.fn(),
    } as unknown as Parameters<typeof settleCandidatePublishError>[0]["db"];

    const cause = new Error("Reviewed assertion was rejected by ingestion policy");
    await expect(
      settleCandidatePublishError({
        db,
        row: { id: "cand-1", evidence_hash: "hash-1" },
        decision,
        token: "tok-1",
        error: cause,
        now: "2026-11-26T21:10:00.000Z",
      }),
    ).rejects.toMatchObject({ message: "Candidate changed during review requeue", cause });
  });

  it("calls pipeline_retry_candidate and rethrows for transient errors", async () => {
    const update = vi.fn();
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const db = { from: vi.fn(() => ({ update })), rpc } as unknown as Parameters<typeof settleCandidatePublishError>[0]["db"];

    const transient = new Error("Source unavailable: cand-1 (HTTP 503)");
    await expect(
      settleCandidatePublishError({
        db,
        row: { id: "cand-1", evidence_hash: "hash-1" },
        decision,
        token: "tok-1",
        error: transient,
      }),
    ).rejects.toBe(transient);

    expect(update).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("pipeline_retry_candidate", {
      p_id: "cand-1",
      p_token: "tok-1",
      p_error: "Source unavailable: cand-1 (HTTP 503)",
    });
  });
});

describe("requeuePreClaimPublishingCandidate", () => {
  it("clears stuck publishing rows that fail pre-claim validation during resume", async () => {
    const filters: Array<[string, unknown[]]> = [];
    const select = vi.fn().mockResolvedValue({ data: [{ id: "cand-1" }], error: null });
    const builder: Record<string, unknown> = { select };
    for (const method of ["eq"]) {
      builder[method] = (...args: unknown[]) => {
        filters.push([method, args]);
        return builder;
      };
    }
    const db = {
      from: vi.fn(() => ({ update: () => builder })),
    } as unknown as Parameters<typeof requeuePreClaimPublishingCandidate>[0]["db"];

    const outcome = await requeuePreClaimPublishingCandidate({
      db,
      row: {
        id: "cand-1",
        status: "publishing",
        publish_token: "tok-0",
        evidence_hash: "hash-1",
        updated_at: "2026-11-20T00:00:00.000Z",
      },
      decision,
      error: new Error("Candidate is outside its reviewed future edition"),
      now: "2026-11-26T21:10:00.000Z",
    });

    expect(outcome).toEqual({
      id: "cand-1",
      status: "review_required",
      error: "Candidate is outside its reviewed future edition",
    });
    expect(filters).toEqual([
      ["eq", ["id", "cand-1"]],
      ["eq", ["status", "publishing"]],
      ["eq", ["publish_token", "tok-0"]],
      ["eq", ["evidence_hash", "hash-1"]],
      ["eq", ["updated_at", "2026-11-20T00:00:00.000Z"]],
    ]);
  });
});

describe("loadResumeDecisions", () => {
  it("prioritizes publish_error IS NULL candidates before retrying errored ones and strips reviewedAt", async () => {
    const calls: Array<{ nullFilter: string; limit: number }> = [];
    const db = {
      from: vi.fn(() => {
        let nullFilter = "";
        const chain: Record<string, unknown> = {};
        for (const method of ["select", "eq", "lte", "order"]) chain[method] = () => chain;
        chain.is = (col: string, val: unknown) => {
          if (col === "publish_error" && val === null) nullFilter = "is_null";
          return chain;
        };
        chain.not = (col: string, op: string, val: unknown) => {
          if (col === "publish_error" && op === "is" && val === null) nullFilter = "not_null";
          return chain;
        };
        chain.limit = async (n: number) => {
          calls.push({ nullFilter, limit: n });
          if (nullFilter === "is_null") {
            return {
              data: [{ decision: { ...decision, id: "fresh-1", reviewedAt: "2026-11-26T00:00:00Z" } }],
              error: null,
            };
          }
          return {
            data: [
              { decision: { ...decision, id: "retry-1", reviewedAt: "2026-11-25T00:00:00Z" } },
              { decision: { ...decision, id: "retry-2", reviewedAt: "2026-11-25T01:00:00Z" } },
            ],
            error: null,
          };
        };
        return chain;
      }),
    } as unknown as Parameters<typeof loadResumeDecisions>[0];

    const result = await loadResumeDecisions(db, "2026-11-26T21:10:00.000Z", 3);
    expect(calls).toEqual([
      { nullFilter: "is_null", limit: 3 },
      { nullFilter: "not_null", limit: 2 },
    ]);
    expect(result.map(d => d.id)).toEqual(["fresh-1", "retry-1", "retry-2"]);
    expect(result.every(d => !("reviewedAt" in d))).toBe(true);
  });

  it("skips the errored query when 3 publish_error IS NULL rows are already due", async () => {
    const calls: string[] = [];
    const db = {
      from: vi.fn(() => {
        let nullFilter = "";
        const chain: Record<string, unknown> = {};
        for (const method of ["select", "eq", "lte", "order"]) chain[method] = () => chain;
        chain.is = (col: string, val: unknown) => {
          if (col === "publish_error" && val === null) nullFilter = "is_null";
          return chain;
        };
        chain.not = (col: string, op: string, val: unknown) => {
          if (col === "publish_error" && op === "is" && val === null) nullFilter = "not_null";
          return chain;
        };
        chain.limit = async () => {
          calls.push(nullFilter);
          return {
            data: [
              { decision: { ...decision, id: "fresh-1" } },
              { decision: { ...decision, id: "fresh-2" } },
              { decision: { ...decision, id: "fresh-3" } },
            ],
            error: null,
          };
        };
        return chain;
      }),
    } as unknown as Parameters<typeof loadResumeDecisions>[0];

    const result = await loadResumeDecisions(db, "2026-11-26T21:10:00.000Z", 3);
    expect(calls).toEqual(["is_null"]);
    expect(result.map(d => d.id)).toEqual(["fresh-1", "fresh-2", "fresh-3"]);
  });
});

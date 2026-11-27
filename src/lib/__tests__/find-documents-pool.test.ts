import { describe, expect, it } from "vitest";
import {
  DEADLINE_BUFFER_MS,
  deadlineMsFromEnv,
  parseConcurrency,
  runWorkerPool,
} from "../../../scripts/pipeline2-find-documents";

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

describe("pipeline2-find-documents worker pool", () => {
  it("clamps --concurrency to 1..8 (default 4) and forces 1 when limit <= 1", () => {
    expect(parseConcurrency(undefined, 20)).toBe(4);
    expect(parseConcurrency("", 20)).toBe(4);
    expect(parseConcurrency("not-a-number", 20)).toBe(4);
    expect(parseConcurrency("0", 20)).toBe(1);
    expect(parseConcurrency("-3", 20)).toBe(1);
    expect(parseConcurrency("3", 20)).toBe(3);
    expect(parseConcurrency("8", 20)).toBe(8);
    expect(parseConcurrency("99", 20)).toBe(8);
    expect(parseConcurrency("8", 1)).toBe(1);
    expect(parseConcurrency("4", 0)).toBe(1);
  });

  it("parses SOURCE_RUN_DEADLINE in seconds and treats unset/zero as Infinity", () => {
    expect(deadlineMsFromEnv(undefined)).toBe(Infinity);
    expect(deadlineMsFromEnv("")).toBe(Infinity);
    expect(deadlineMsFromEnv("0")).toBe(Infinity);
    expect(deadlineMsFromEnv("-10")).toBe(Infinity);
    expect(deadlineMsFromEnv("1700000000")).toBe(1_700_000_000_000);
  });

  it("runs tasks concurrently without ever exceeding concurrency or limit", async () => {
    const queue = Array.from({ length: 12 }, (_, index) => `site-${index + 1}.test`);
    let claimCalls = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    const seen: Array<{ task: string; id: number }> = [];

    const result = await runWorkerPool({
      concurrency: 3,
      limit: 7,
      claim: async () => {
        claimCalls += 1;
        await delay(2);
        return queue.shift();
      },
      worker: async (task, id) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(15);
        seen.push({ task, id });
        inFlight -= 1;
      },
    });

    expect(result).toEqual({ claimed: 7, stoppedByDeadline: false });
    expect(claimCalls).toBe(7);
    expect(maxInFlight).toBe(3);
    expect(inFlight).toBe(0);
    expect(seen).toHaveLength(7);
    expect(new Set(seen.map(item => item.id)).size).toBe(7);
    expect(queue).toHaveLength(5);
  });

  it("never claims more than limit even when concurrency > limit", async () => {
    const queue = ["a.test", "b.test", "c.test", "d.test"];
    let claimCalls = 0;

    const result = await runWorkerPool({
      concurrency: 6,
      limit: 2,
      claim: async () => {
        claimCalls += 1;
        return queue.shift();
      },
      worker: async () => {
        await delay(10);
      },
    });

    expect(result).toEqual({ claimed: 2, stoppedByDeadline: false });
    expect(claimCalls).toBe(2);
    expect(queue).toEqual(["c.test", "d.test"]);
  });

  it("stops immediately across all workers when claim returns empty", async () => {
    const queue = ["a.test", "b.test"];
    let claimCalls = 0;
    const handled: string[] = [];

    const result = await runWorkerPool({
      concurrency: 5,
      limit: 100,
      claim: async () => {
        claimCalls += 1;
        return queue.shift();
      },
      worker: async task => {
        await delay(10);
        handled.push(task);
      },
    });

    expect(result).toEqual({ claimed: 2, stoppedByDeadline: false });
    expect(claimCalls).toBe(3); // 2 tasks + 1 empty claim that stops the remaining slots
    expect(handled).toEqual(["a.test", "b.test"]);
  });

  it("stops claiming new tasks when less than 30s remains before SOURCE_RUN_DEADLINE", async () => {
    const queue = ["a.test", "b.test", "c.test", "d.test", "e.test"];
    let currentNow = 100_000;
    const deadlineMs = currentNow + DEADLINE_BUFFER_MS + 10_000; // 40s left initially
    let claimCalls = 0;
    const handled: string[] = [];

    const result = await runWorkerPool({
      concurrency: 2,
      limit: 10,
      deadlineMs,
      now: () => currentNow,
      claim: async () => {
        claimCalls += 1;
        return queue.shift();
      },
      worker: async task => {
        await delay(10);
        handled.push(task);
        // Once the first two tasks finish, advance past the 30s buffer (only 20s left).
        currentNow = deadlineMs - DEADLINE_BUFFER_MS + 10_000;
      },
    });

    expect(result).toEqual({ claimed: 2, stoppedByDeadline: true });
    expect(claimCalls).toBe(2);
    expect(handled).toEqual(["a.test", "b.test"]);
    expect(queue).toEqual(["c.test", "d.test", "e.test"]);
  });

  it("claims zero tasks when deadline buffer is already exhausted before starting", async () => {
    let claimCalls = 0;

    const result = await runWorkerPool({
      concurrency: 4,
      limit: 10,
      deadlineMs: 1_000_000,
      now: () => 1_000_000 - DEADLINE_BUFFER_MS + 1,
      claim: async () => {
        claimCalls += 1;
        return "a.test";
      },
      worker: async () => {},
    });

    expect(result).toEqual({ claimed: 0, stoppedByDeadline: true });
    expect(claimCalls).toBe(0);
  });
});

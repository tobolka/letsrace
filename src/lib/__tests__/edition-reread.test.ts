import { describe, expect, it } from "vitest";
import { editionRereadAt } from "../catalog/edition-reread";

describe("organiser website revisit", () => {
  const at = "2026-11-18T08:00:00Z";
  const hours = (options: Partial<Parameters<typeof editionRereadAt>[0]>, failures = 0, browser = true) =>
    (editionRereadAt({ at, ...options }, failures, browser) - Date.parse(at)) / 3_600_000;

  it("does not turn a thin page into an immediate repeat", () => {
    expect(hours({ needsBrowser: true })).toBe(6);
    expect(hours({ needsBrowser: true }, 0, false)).toBe(120);
    expect(hours({ needsBrowser: true, rendered: true })).toBe(336);
  });

  it("defers a challenge and backs off after repeated failures", () => {
    expect(hours({ needsBrowser: true, asksVerification: true })).toBe(168);
    expect(hours({ requestAttempted: false })).toBe(168);
    expect(hours({ status: 503 }, 1)).toBe(6);
    expect(hours({ status: 503 }, 3)).toBe(24);
    expect(hours({ status: 503 }, 20)).toBe(336);
  });
});

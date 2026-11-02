import { describe, expect, it } from "vitest";
import { candidateAssertion, type ReviewRow } from "@/lib/discovery/review";
import { decisionObject, finishFollowUp, followUpDue, followUpUrls, type FollowUpDocument } from "@/lib/discovery/follow-up";

const now = Date.parse("2026-11-02T10:00:00Z");
const row: ReviewRow = { ...candidateAssertion({ externalId: "race", name: "Race", startDate: "2027-06-05", placeText: "Praha", sourceUrl: "https://race.test/detail", confidence: .9 },
  { sourceUrl: "https://race.test/", documentHash: "old-html", textHash: "old-text", reason: "date needs review" }),
  id: "candidate", status: "waiting", decision: { action: "wait", reason: "Unconfirmed date" }, event_id: null, created_at: "2026-10-25T00:00:00Z", updated_at: "2026-10-25T00:00:00Z" };
const read: FollowUpDocument = { url: row.source_url, outcome: "read", documentHash: "new-html", textHash: "old-text", snapshot: "/archive/new.json" };
const withResult = (result: ReturnType<typeof finishFollowUp>): ReviewRow => ({ ...row, decision: { ...decisionObject(row.decision), followUp: JSON.parse(JSON.stringify(result)) } });

describe("waiting evidence follow-up", () => {
  it("makes old unscheduled waits due, while leaving terminal and in-flight work alone", () => {
    expect(followUpDue(row, now)).toBe(true);
    for (const status of ["published", "rejected", "publishing"]) expect(followUpDue({ ...row, status }, now)).toBe(false);
  });
  it("deduplicates explicit URLs and refuses private or guessed targets", () => {
    expect(followUpUrls({ ...row, decision: { recheckUrls: ["https://race.test/#nav", "http://127.0.0.1/", "file:///secret"] } }))
      .toEqual(["https://race.test/", "https://race.test/detail"]);
    expect(followUpUrls(row).join(" ")).not.toContain("2027");
  });
  it("retains previously followed organizer URLs for the next scheduled attempt", () => {
    const result = finishFollowUp(row, [read, { ...read, url: "https://organizer.test/", linkedFrom: "https://race.test/detail" }], now);
    expect(followUpUrls(withResult(result))).toEqual(["https://race.test/", "https://race.test/detail", "https://organizer.test/"]);
  });
  it("ignores changed HTML decoration when source text is unchanged", () => {
    const result = finishFollowUp(row, [read], now);
    expect(result.outcome).toBe("unchanged");
    expect(result.needsReview).toBe(false);
    expect(result.nextCheckAt).toBe("2026-11-09T10:00:00.000Z");
    expect(followUpDue(withResult(result), now)).toBe(false);
    expect(followUpDue(withResult(result), Date.parse(result.nextCheckAt))).toBe(true);
  });
  it("compares structured calendar documents without ignoring data hidden in HTML", () => {
    const structured = { ...row, payload: { evidence: { method: "structured_calendar" } } };
    expect(finishFollowUp(structured, [read], now).outcome).toBe("changed");
  });
  it("keeps changed evidence visible until a reviewer resolves it", () => {
    const first = finishFollowUp(row, [{ ...read, textHash: "new-date" }], now);
    expect(first.outcome).toBe("changed");
    expect(first.needsReview).toBe(true);
    const second = finishFollowUp(withResult(first), [{ ...read, textHash: "new-date" }], now + 86400000);
    expect(second.outcome).toBe("unchanged");
    expect(second.needsReview).toBe(true);
    expect(second.attempts).toBe(2);
    expect(row.status).toBe("waiting");
    expect(row.decision).toEqual({ action: "wait", reason: "Unconfirmed date" });
  });
  it("does not call a first observation proof that an undocumented source changed", () => {
    expect(finishFollowUp({ ...row, evidence: {} }, [read], now).outcome).toBe("baseline");
  });
  it("backs off failed reads without throwing away the last successful baseline", () => {
    let current = withResult(finishFollowUp(row, [read], now));
    for (const hours of [1, 6, 24, 72, 168, 168]) {
      const result = finishFollowUp(current, [{ url: read.url, outcome: "unavailable", error: "HTTP 500" }], now);
      expect(Date.parse(result.nextCheckAt) - now).toBe(hours * 3600000);
      expect(result.documents[0].textHash).toBe("old-text");
      current = withResult(result);
    }
    const recovered = finishFollowUp(current, [read], now);
    expect(recovered.failures).toBe(0);
    expect(recovered.outcome).toBe("unchanged");
  });
  it("never reports partial or empty reads as a successful check", () => {
    const partial = finishFollowUp(row, [read, { url: "https://race.test/detail", outcome: "unavailable" }], now);
    expect(partial.outcome).toBe("unavailable");
    expect(finishFollowUp(row, [], now).outcome).toBe("unavailable");
  });
  it("leaves paused or rejected sources blocked and schedules no rapid retry", () => {
    const result = finishFollowUp(row, [{ url: read.url, outcome: "blocked" }], now);
    expect(result.outcome).toBe("blocked");
    expect(result.nextCheckAt).toBe("2026-11-09T10:00:00.000Z");
  });
  it("allows recovery after a worker crash, but respects a live lease", () => {
    const result = finishFollowUp(row, [read], now);
    const claimed = withResult({ ...result, nextCheckAt: new Date(now).toISOString(), leaseUntil: new Date(now + 300000).toISOString() });
    expect(followUpDue(claimed, now)).toBe(false);
    expect(followUpDue(claimed, now + 300000)).toBe(true);
  });
});

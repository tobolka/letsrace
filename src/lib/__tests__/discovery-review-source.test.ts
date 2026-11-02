import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { candidateAssertion, type ReviewDecision, type ReviewRow } from "@/lib/discovery/review";
import { validateReviewSource } from "@/lib/discovery/review-source";
import { pageAsText } from "@/lib/watcher/extractors/llm-calendar";
import type { ParsedEvent } from "@/lib/domain";
import type { fetchPage } from "@/lib/watcher/http";

const url = "https://race.test/2027";
const event: ParsedEvent = { externalId: "race", name: "Lesák CUP", startDate: "2027-08-28", placeText: "Hronov", countryHint: "CZ", discipline: ["mtb"], sourceUrl: url, confidence: .9,
  evidence: { sourceUrl: url, quote: "Lesák CUP\n28. 8. 2027", method: "llm_calendar", version: "v7" } };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const html = "<html><head><title>Lesák CUP</title></head><body><h1>Lesák CUP</h1><p>28. 8. 2027</p><p>Hronov</p></body></html>";
function setup(payload = event, document = html, structured = false) {
  const assertion = candidateAssertion(payload, { sourceUrl: url, documentHash: hash(document), textHash: structured ? undefined : hash(pageAsText(document, url).text), reason: "review" });
  const row: ReviewRow = { ...assertion, id: "candidate", status: "waiting", decision: null, event_id: null, created_at: "now", updated_at: "now" };
  const decision: ReviewDecision = { id: row.id, evidenceHash: row.evidence_hash, action: "publish", reason: "Reviewed primary source", authority: "official", expectedEventId: null,
    checked: { identity: true, date: true, place: true, discipline: true, authority: true } };
  const read = vi.fn().mockResolvedValue({ html: document, status: 200, hash: hash(document), unchanged: false });
  return { row, decision, read };
}
async function check(fixture: ReturnType<typeof setup>) { return validateReviewSource(fixture.row, fixture.decision, "2026-11-02", fixture.read as typeof fetchPage); }

it("accepts literal title and date fragments and requests a fresh source", async () => {
  const fixture = setup(); await expect(check(fixture)).resolves.toBeUndefined();
  expect(fixture.read).toHaveBeenCalledWith(url, { fresh: true });
});
it("refuses a model's invented quote even when the document hash is genuine", async () => {
  const fixture = setup({ ...event, evidence: { ...event.evidence!, quote: "Lesák CUP\n28. 8. 2027\nPořadatel potvrzuje nový závod" } });
  await expect(check(fixture)).rejects.toThrow("not present");
});
it("rejects a year inferred from the date field instead of explicit edition evidence", async () => {
  const fixture = setup({ ...event, evidence: { ...event.evidence!, quote: "Lesák CUP 28. 8." } });
  await expect(check(fixture)).rejects.toThrow("year must be explicitly");
  expect(fixture.read).not.toHaveBeenCalled();
});
it("refuses changed facts and unavailable sources despite an old approval", async () => {
  for (const response of [{ html: html.replace("28. 8.", "29. 8."), status: 200 }, { html, status: 503 }]) {
    const fixture = setup(); fixture.read.mockResolvedValue({ ...response, hash: hash(html), unchanged: false });
    await expect(check(fixture)).rejects.toThrow("changed or unavailable");
  }
});
it("accepts irrelevant HTML decoration changes when reviewed source text stays identical", async () => {
  const fixture = setup(); fixture.read.mockResolvedValue({ html: html.replace("<h1>", '<h1 class="new-style">'), status: 200, hash: "changed", unchanged: false });
  await expect(check(fixture)).resolves.toBeUndefined();
});
it("does not accept a hidden or script-only literal passage as visible model evidence", async () => {
  for (const hidden of ['<div hidden>Lesák CUP 28. 8. 2027</div>', '<script>Lesák CUP 28. 8. 2027</script>']) {
    const fixture = setup({ ...event, evidence: { ...event.evidence!, quote: "Lesák CUP 28. 8. 2027" } }, `<body>${hidden}<p>No race date announced</p></body>`);
    await expect(check(fixture)).rejects.toThrow("not present");
  }
});
it("validates actual structured card markup, including the explicit machine-readable year", async () => {
  const card = '<div data-rt-calendar-event="1"><h3>Lesák CUP</h3><time datetime="2027-08-28">28. 8. 2027</time><p>Hronov</p></div>';
  const payload = { ...event, evidence: { ...event.evidence!, quote: card, method: "structured_calendar" } };
  await expect(check(setup(payload, `<body>${card}</body>`, true))).resolves.toBeUndefined();
  const invented = setup({ ...payload, evidence: { ...payload.evidence, quote: card.replace("Hronov", "Praha") } }, `<body>${card}</body>`, true);
  await expect(check(invented)).rejects.toThrow("not present");
});
it("does not let non-publication decisions or missing reviews reach source reading", async () => {
  const fixture = setup(); fixture.decision.action = "wait";
  await expect(check(fixture)).rejects.toThrow("publish decision");
  expect(fixture.read).not.toHaveBeenCalled();
});

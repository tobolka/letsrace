import { expect, it } from "vitest";
import { publicationPayload, verifyPublicRevision, type Publication } from "@/lib/pipeline/publication";
const publication: Publication = { revision: "revision-2", slug: "race-2027", expected: { id: "race", name: "Race 2027", start_date: "2027-08-28", end_date: null, status: "scheduled", registration_url: "https://entries.test/2027" } };
function page(change: Record<string, unknown> = {}, revision = publication.revision) {
  return `<article data-race-id="race" data-race-revision="${revision}"><a href="https://entries.test/2027">Enter</a></article><script type="application/ld+json">${JSON.stringify({ "@type": "SportsEvent", name: "Race 2027", startDate: "2027-08-28", endDate: "2027-08-28", eventStatus: "https://schema.org/EventScheduled", ...change })}</script>`;
}
it("requires the actual revision and the displayed race facts", () => {
  expect(() => verifyPublicRevision(page(), 200, publication, true)).not.toThrow();
  expect(() => verifyPublicRevision(page({}, "old-revision"), 200, publication, true)).toThrow("revision");
  for (const patch of [{ startDate: "2027-08-29" }, { endDate: "2027-08-30" }, { name: "Different race" }]) expect(() => verifyPublicRevision(page(patch), 200, publication, true)).toThrow("name or dates");
});
it("detects a missing actual registration link even when metadata is current", () => {
  expect(() => verifyPublicRevision(page().replace('<a href="https://entries.test/2027">Enter</a>', ""), 200, publication, true)).toThrow("registration link");
});
it("requires cancelled and postponed status to be published truthfully", () => {
  for (const [status, schema] of [["cancelled", "EventCancelled"], ["postponed", "EventPostponed"]]) {
    const target = { ...publication, expected: { ...publication.expected, status } };
    expect(() => verifyPublicRevision(page(), 200, target, true)).toThrow("status");
    expect(() => verifyPublicRevision(page({ eventStatus: `https://schema.org/${schema}` }), 200, target, true)).not.toThrow();
  }
});
it("does not confuse a soft 200 with a hidden or removed race", () => {
  for (const status of [404, 410]) expect(() => verifyPublicRevision("", status, publication, false)).not.toThrow();
  expect(() => verifyPublicRevision("Not found", 200, publication, false)).toThrow("still publicly available");
  expect(() => verifyPublicRevision("Not found", 404, publication, true)).toThrow("HTTP 404");
});
it("does not accept malformed metadata or an unrelated schema block", () => {
  expect(() => verifyPublicRevision(page().replace('"SportsEvent"', '"BreadcrumbList"'), 200, publication, true)).toThrow("name or dates");
  expect(() => verifyPublicRevision(page().replace('"startDate"', 'invalid-json'), 200, publication, true)).toThrow("name or dates");
});
it("refuses task payloads without a revision and expected race", () => {
  expect(() => publicationPayload({ slug: "race" })).toThrow("Invalid publication");
  expect(publicationPayload(publication as never)).toEqual(publication);
});

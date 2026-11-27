import { expect, it } from "vitest";
import { publicationPayload, publicationIsVisible, verifyPublicRevision, type Publication } from "@/lib/pipeline/publication";
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

it("checks location and address in metadata and visible content independently", () => {
  const target = { ...publication, expected: { ...publication.expected, public_location: { name: "Areál Dobrá Voda", streetAddress: "Turnovská 40", postalCode: "466 01" } } };
  const json = { name: "Areál Dobrá Voda", address: { streetAddress: "Turnovská 40", postalCode: "466 01" } };
  const html = page({ location: json }).replace("</article>", "<p>Areál Dobrá Voda, Turnovská 40, 466 01</p></article>");
  expect(() => verifyPublicRevision(html, 200, target, true)).not.toThrow();
  expect(() => verifyPublicRevision(page({ location: json }), 200, target, true)).toThrow("visible page");
  expect(() => verifyPublicRevision(html.replace('"streetAddress":"Turnovská 40"', '"streetAddress":"Wrong 1"'), 200, target, true)).toThrow("address");
  expect(() => verifyPublicRevision(html.replace('"name":"Areál Dobrá Voda"', '"name":"Other venue"'), 200, target, true)).toThrow("location");
});

it("checks the canonical target's country after a merge, rather than assuming every public row has a page", () => {
  const expected = { ...publication.expected, visibility: "public" };
  expect(publicationIsVisible(expected, "CZ")).toBe(true);
  expect(publicationIsVisible(expected, "ZZ")).toBe(false);
  expect(publicationIsVisible({ ...expected, visibility: "hidden" }, "CZ")).toBe(false);
  expect(publicationIsVisible({ ...expected, status: "tbc" }, "CZ")).toBe(false);
  expect(publicationIsVisible({ ...expected, status: "cancelled" }, "CZ")).toBe(true);
});

it("verifies races without a location when SportsEvent JSON-LD is intentionally omitted", () => {
  const noPlace: Publication = {
    revision: "rev-no-place",
    slug: "women-s-cycling-grand-prix-region-stuttgart-2027",
    expected: {
      id: "race-no-place",
      name: "Women’s Cycling Grand Prix Region Stuttgart",
      start_date: "2027-09-19",
      end_date: "2027-09-19",
      status: "scheduled",
      public_location: null,
    },
  };
  const noPlaceHtml = (name = "Women’s Cycling Grand Prix Region Stuttgart", startDate = "2027-09-19", cancelled = false) =>
    `<article data-race-id="race-no-place" data-race-revision="rev-no-place">${cancelled ? '<p role="status">This race is cancelled.</p>' : ""}<header><h1 data-page-title="true">${name}</h1><p><time dateTime="${startDate}">Sunday</time></p></header></article><script type="application/ld+json">${JSON.stringify({ "@type": "BreadcrumbList" })}</script>`;

  expect(() => verifyPublicRevision(noPlaceHtml(), 200, noPlace, true)).not.toThrow();
  expect(() => verifyPublicRevision(noPlaceHtml("Old Name"), 200, noPlace, true)).toThrow("name or dates");
  expect(() => verifyPublicRevision(noPlaceHtml(undefined, "2027-09-20"), 200, noPlace, true)).toThrow("name or dates");
  expect(() => verifyPublicRevision(noPlaceHtml(undefined, undefined, true), 200, noPlace, true)).toThrow("status");
  expect(() => verifyPublicRevision(noPlaceHtml().replace('"BreadcrumbList"', 'invalid-json'), 200, noPlace, true)).toThrow("name or dates");
  expect(() => verifyPublicRevision(noPlaceHtml(), 200, { ...noPlace, expected: { ...noPlace.expected, public_location: { name: "Stuttgart" } } }, true)).toThrow("name or dates");

  const cancelledNoPlace: Publication = { ...noPlace, expected: { ...noPlace.expected, status: "cancelled" } };
  expect(() => verifyPublicRevision(noPlaceHtml(undefined, undefined, true), 200, cancelledNoPlace, true)).not.toThrow();
  expect(() => verifyPublicRevision(noPlaceHtml(undefined, undefined, false), 200, cancelledNoPlace, true)).toThrow("status");

  const shouted: Publication = { ...noPlace, expected: { ...noPlace.expected, name: "WOMEN'S CYCLING GRAND PRIX" } };
  expect(() => verifyPublicRevision(noPlaceHtml("Women's Cycling Grand Prix"), 200, shouted, true)).not.toThrow();
});

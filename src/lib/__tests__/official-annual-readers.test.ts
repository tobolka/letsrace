import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { parseFullgazHomepage } from "@/lib/watcher/extractors/fullgaz";
import { parseUciCompetition } from "@/lib/watcher/extractors/uci-competition";
import { candidateAssertion, type ReviewDecision, type ReviewRow } from "@/lib/discovery/review";
import { validateReviewSource } from "@/lib/discovery/review-source";
import { isOrganisationPlace } from "@/lib/catalog/overview-quality";
import { canReconcileMissingEvents, watchReaderVersion } from "@/lib/watcher/core";
import { quoteStatesDate } from "@/lib/catalog/quoted-date";
import { inferAgeCategories } from "@/lib/taxonomy";
import { preferLevel } from "@/lib/dedup";
import { geocodeFromGazetteer } from "@/lib/geocode";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const home = (year = "2027") => `<h3>15. Fullgaz Race ${year}</h3><nav><a href="/race-${year}-03-04-04-${year}/">Race ${year} (03. &amp; 04.04.${year})</a></nav><h3>14. Fullgaz Race 2026</h3><p>Registration 2026: €40. Old route: 4.2 km.</p>`;
const track = "<h3>Renngelände Obergessertshausen</h3><h1>XCO Track</h1><p>Streckenplan 2026: 4.2 km. Training: 20.03.2026</p>";
const reply = (html: string) => ({ html, status: 200, hash: digest(html), unchanged: false });
const read = vi.fn(async () => reply(track));
function reviewed(event: ReturnType<typeof parseUciCompetition>[number], html: string) {
  const row: ReviewRow = { ...candidateAssertion(event, { sourceUrl: event.sourceUrl, documentHash: digest(html), country: "DE", reason: "checked" }), id: "candidate", status: "pending", decision: null, event_id: null, created_at: "now", updated_at: "now" };
  const decision: ReviewDecision = { id: row.id, evidenceHash: row.evidence_hash, action: "publish", reason: "Official sources checked", expectedEventId: null, authority: "official", checked: { identity: true, date: true, place: true, discipline: true, authority: true } };
  return { row, decision };
}
const uciUrl = "https://www.uci.org/competition-details/2027/MTB/12345";
const component = { competitionDetails: { name: "Sample MTB 2027", dates: "03 Apr - 04 Apr 2027", venue: "Sample Club e.V.", country: "Germany", competitionClass: "CS - Continental Series", website: { url: "https://fullgazrace.de/" } }, schedule: { items: [{ races: [{ raceType: "Cross-country Olympic", category: "Men Elite" }, { raceType: "Cross-country short circuit", category: "Women Elite" }] }] } };
const uciHtml = `<div data-props='${JSON.stringify(component)}'></div>`;
function supportedEvent() {
  return { ...parseUciCompetition(uciUrl, uciHtml)[0], placeText: "Obergessertshausen", fieldEvidence: [{ field: "placeText" as const, value: "Obergessertshausen", sourceUrl: "https://fullgazrace.de/race-2027/racetracks/", quote: "Renngelände Obergessertshausen", documentHash: digest(track) }] };
}
it("reads an explicitly announced future edition even while route data still describe the old year", async () => {
  const [event] = await parseFullgazHomepage("https://fullgazrace.de", home(), read);
  expect(event).toMatchObject({ name: "15. Fullgaz Race 2027", startDate: "2027-04-03", endDate: "2027-04-04", placeText: "Obergessertshausen", sourceUrl: "https://fullgazrace.de/" });
  expect(event.categories).toBeUndefined(); expect(event.registrationUrl).toBeUndefined(); expect(event.registrationClosesAt).toBeUndefined();
  expect(quoteStatesDate(event.evidence!.quote, event.startDate)).toBe(true);
  expect(quoteStatesDate(event.evidence!.quote, event.endDate!, { role: "end" })).toBe(true);
  expect((await parseFullgazHomepage("https://fullgazrace.de/", home("2028"), read))[0].startDate).toBe("2028-04-03");
});
it("does not invent next year from an old heading, conflicting links or an unavailable venue document", async () => {
  expect(await parseFullgazHomepage("https://fullgazrace.de/history/2026/", home(), read)).toEqual([]);
  expect(await parseFullgazHomepage("https://fullgazrace.de/", home().replace("15. Fullgaz Race 2027", "14. Fullgaz Race 2026"), read)).toEqual([]);
  await expect(parseFullgazHomepage("https://fullgazrace.de/", home()+`<a href="/race-2027-other/">Race 2027 (10. &amp; 11.04.2027)</a>`, read)).rejects.toThrow("conflicting");
  await expect(parseFullgazHomepage("https://fullgazrace.de/", home(), vi.fn(async () => ({...reply(""), status: 404})))).rejects.toThrow("unavailable");
});
it("revalidates the annual declaration and its separate venue source before a reviewed write", async () => {
  const [event] = await parseFullgazHomepage("https://fullgazrace.de/", home(), read);
  const { row, decision } = reviewed(event, home());
  await expect(validateReviewSource(row, decision, "2026-11-03", vi.fn(async url => reply(url === row.source_url ? home() : track)))).resolves.toBeUndefined();
});
it("reads XCC and validates actual UCI component data rather than requiring JSON to appear as visible prose", async () => {
  const event = supportedEvent(); expect(event.discipline).toEqual(["xco", "xcc"]);
  const { row, decision } = reviewed(event, uciHtml);
  await expect(validateReviewSource(row, decision, "2026-11-03", vi.fn(async url => reply(url === uciUrl ? uciHtml : track)))).resolves.toBeUndefined();
});
it("rejects changed assertions and unrelated or changed supporting place evidence", async () => {
  for (const change of [{ discipline: ["road"] }, { uciClass: "c1" }, { fieldEvidence: [{ ...supportedEvent().fieldEvidence[0], sourceUrl: "https://unrelated.test/place" }] }, { fieldEvidence: [{ ...supportedEvent().fieldEvidence[0], documentHash: "f".repeat(64) }] }]) {
    const event = { ...supportedEvent(), ...change } as ReturnType<typeof supportedEvent>;
    const { row, decision } = reviewed(event, uciHtml);
    await expect(validateReviewSource(row, decision, "2026-11-03", vi.fn(async url => reply(url === uciUrl ? uciHtml : track)))).rejects.toThrow();
  }
});
it("never treats an association name as a town, and rechecks only changed reader versions", async () => {
  expect(isOrganisationPlace("MSC Wiesenbach e.V.")).toBe(true); expect(isOrganisationPlace("Bikepark Wiesenbach")).toBe(false);
  const { row, decision } = reviewed(parseUciCompetition(uciUrl, uciHtml)[0], uciHtml);
  await expect(validateReviewSource(row, decision, "2026-11-03", read)).rejects.toThrow("Missing place");
  expect(watchReaderVersion(uciUrl)).not.toBe(watchReaderVersion("https://other.test/"));
  expect(canReconcileMissingEvents({ events: [], strategy: "adapter:fullgaz", childUrls: [], confidence: 1 })).toBe(false);
  expect(geocodeFromGazetteer("Obergessertshausen", "DE")).toMatchObject({ lat: 48.2146894, lng: 10.5527877, countryCode: "DE" });
});

it("accepts changed page decoration only after deterministic rechecking, and refuses changed competition facts", async () => {
  const event = supportedEvent(), { row, decision } = reviewed(event, uciHtml);
  const decoration = `<nav>New navigation</nav>${uciHtml}`;
  await expect(validateReviewSource(row, decision, "2026-11-03", vi.fn(async url => reply(url === uciUrl ? decoration : track)))).resolves.toBeUndefined();
  const changed = uciHtml.replace("03 Apr - 04 Apr 2027", "10 Apr - 11 Apr 2027");
  await expect(validateReviewSource(row, decision, "2026-11-03", vi.fn(async url => reply(url === uciUrl ? changed : track)))).rejects.toThrow("UCI component evidence changed");
});

it("keeps the class and label of the explicitly selected classification", () => {
  expect(preferLevel({ level: "local", classLabel: "Local", uciClass: null }, { level: "continental", classLabel: "UCI Continental Series", uciClass: "cs" }, true))
    .toEqual({ level: "continental", classLabel: "UCI Continental Series", uciClass: "cs" });
  expect(preferLevel({ level: "continental", classLabel: "UCI Continental Series", uciClass: "cs" }, { level: "local", classLabel: "Local", uciClass: null }, false))
    .toEqual({ level: "continental", classLabel: "UCI Continental Series", uciClass: "cs" });
});

it("recognises the same race with a UCI classification prefix while retaining round and discipline conflicts", async () => {
  const { scoreDuplicate, isLikelyDuplicate } = await import("@/lib/dedup");
  const { editionKey } = await import("@/lib/catalog/edition-identity");
  const official = { name: "UCI Mountain Bike Continental Series - Fullgaz Race + UCI XCO Junior Series", startDate: "2027-04-03", endDate: "2027-04-04", placeText: "Obergessertshausen", countryCode: "DE", disciplines: ["xco", "xcc"] };
  const organiser = { ...official, name: "15. Fullgaz Race 2027", disciplines: ["mtb"] };
  expect(isLikelyDuplicate(official, organiser)).toBe(true);
  expect(editionKey(official.name)).toBe(editionKey("14. Fullgaz Race 2026"));
  expect(scoreDuplicate({ ...official, name: "UCI Mountain Bike Continental Series - Fullgaz Round 2" }, { ...organiser, name: "Fullgaz Round 3" }).reasons).toContain("round_conflict");
  expect(scoreDuplicate(official, { ...organiser, disciplines: ["road"] }).reasons).toContain("discipline_conflict");
});

it("treats an individual UCI competition as a race and preserves its stated Under 23 category", () => {
  expect(parseUciCompetition(uciUrl, uciHtml)[0].eventType).toBe("race");
  expect(inferAgeCategories("", ["Men Under 23", "Women Under 23"])).toContain("u23");
});

it("keeps the junior series scope separate from elite and U23 races on the same programme", () => {
  const mixed = { ...component, competitionDetails: { ...component.competitionDetails, name: "UCI Mountain Bike Continental Series - Sample Race + UCI XCO Junior Series" } };
  const html = `<div data-props='${JSON.stringify(mixed)}'></div>`;
  expect(parseUciCompetition(uciUrl, html)[0].seriesAgeCategories).toEqual(["junior"]);
  expect(parseUciCompetition(uciUrl, html)[0].categories?.some(c => c.name === "Men Elite")).toBe(true);
});

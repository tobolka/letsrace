import { expect, it } from "vitest";
import { verifyPracticalExtraction } from "@/lib/catalog/practical-extraction";
import { practicalDetailsForEvent, readPracticalDetails } from "@/lib/practical-details";
const url = "https://club.test/race-2027";
const identity = "JBC 4X Revelations";
const venueQuote = "Where is the race? Areál Dobrá Voda Turnovská 40 466 01, Jablonec nad Nisou 6";
const edition = "JBC 4X Revelations 2027";
const text = `${edition}\n${venueQuote}\nOrganiser: Revelations Club\n9 July 2027 Elite start 09:30\n2027 Entry Elite 500 Kč\n2027 Main route 40 km gravel`;
const context = { name: "4X Pro Tour - JBC 4X Revelations", startDate: "2027-07-09", endDate: "2027-07-10", knownVenue: "Areál Dobrá Voda", documents: [{ url, text, links: [url, "https://club.test/route.gpx"] }], now: "2026-11-03T08:00:00Z" };
const fact = (value: unknown, quote: string, status = "current") => ({ value, quote, source_url: url, identity_quote: identity, edition_quote: edition, status });
it("keeps actual venue/address and organiser facts with independent evidence", () => {
  const result = verifyPracticalExtraction({ facts: { venue: fact({ name: "Areál Dobrá Voda", streetAddress: "Turnovská 40", postalCode: "466 01", locality: "Jablonec nad Nisou 6", precision: "venue" }, venueQuote, "year_neutral"), organizer: fact({ name: "Revelations Club", url }, "Organiser: Revelations Club", "year_neutral") } }, context);
  expect(result.rejected).toEqual([]);
  expect(result.details.venue?.value.streetAddress).toBe("Turnovská 40");
  expect(result.details.organizer?.sourceUrl).toBe(url);
});
it("rejects a real quotation used to support invented values or links", () => {
  const result = verifyPracticalExtraction({ facts: { venue: fact({ name: "Areál Dobrá Voda", streetAddress: "Invented 99", precision: "start" }, venueQuote), routes: fact([{ name: "Main route", distanceKm: 40, gpxUrl: "https://club.test/invented.gpx" }], "2027 Main route 40 km gravel") } }, context);
  expect(result.details).toEqual({}); expect(result.rejected).toEqual(["venue", "routes"]);
});
it("does not let a new edition heading reconfirm an explicitly old programme", () => {
  const quote = "Programme 2026: 9 July 2027 Elite start 09:30";
  const result = verifyPracticalExtraction({ facts: { schedule: fact([{ label: "Elite start", date: "2027-07-09", time: "09:30" }], quote) } }, { ...context, documents: [{ url, text: `${text}\n${quote}`, links: [] }] });
  expect(result.details).toEqual({});
});
it("rejects old fees/routes and unrelated race identity", () => {
  const result = verifyPracticalExtraction({ facts: { fees: fact([{ label: "Elite", amount: 500, currency: "CZK" }], "2027 Entry Elite 500 Kč", "year_neutral"), routes: { ...fact([{ name: "Main route", distanceKm: 40 }], "2027 Main route 40 km gravel"), identity_quote: "Race Across Czechia" } } }, context);
  expect(result.details).toEqual({});
});
it("extracts a precise stated time and leaves unstated prices out", () => {
  const result = verifyPracticalExtraction({ facts: { schedule: fact([{ label: "Elite start", date: "2027-07-09", time: "09:30" }], "9 July 2027 Elite start 09:30") } }, context);
  expect(result.details.schedule?.value[0].time).toBe("09:30");
  expect(result.details.fees).toBeUndefined();
});
it("does not lose a valid field when another stored field is malformed", () => {
  const result = verifyPracticalExtraction({ facts: { venue: fact({ name: "Areál Dobrá Voda", precision: "venue" }, venueQuote, "year_neutral") } }, context);
  expect(readPracticalDetails({ ...result.details, fees: { value: "invalid" } })).toEqual(result.details);
});

it("hides stale programme dates after rescheduling and facts from a different edition", () => {
  const result = verifyPracticalExtraction({ facts: { schedule: fact([{ label: "Elite start", date: "2027-07-09", time: "09:30" }], "9 July 2027 Elite start 09:30") } }, context);
  expect(practicalDetailsForEvent(result.details, "2027-07-09").schedule).toBeDefined();
  expect(practicalDetailsForEvent(result.details, "2027-07-16").schedule).toBeUndefined();
  expect(practicalDetailsForEvent(result.details, "2028-07-09")).toEqual({});
});

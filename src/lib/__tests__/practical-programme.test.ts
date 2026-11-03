import { expect, it } from "vitest";
import { practicalProgramme } from "@/lib/catalog/practical-programme";
import { feeQuoteSupports } from "@/lib/catalog/practical-extraction";
import { mergePracticalDetails, type PracticalDetails } from "@/lib/practical-details";
const doc = { url: "https://club.test/race/2027/propozice", links: [] as string[], text: "Alfa Grand Prix 2027\n31.07.2027 Town\ntrať | start | startovné | ročníky narození\n50 km MTB | ~09:30:18 | 600,- Kč, online termín cena splatnost 27.02.2027 600,- Kč online 29.06.2027 750,- Kč online | 2014 a starší\n20 km MTB | ~10:15:00 | 350,- Kč online termín cena splatnost 27.02.2027 350,- Kč online | 2017 a starší" };
const context = { name: "Alfa Grand Prix", startDate: "2027-07-31" };
it("extracts programme rows without a model, retaining seconds, uncertainty, route identity and price tiers", () => {
  const facts = practicalProgramme(doc, context);
  expect(facts.schedule?.value).toHaveLength(2);
  expect(facts.schedule?.value[0]).toMatchObject({ time: "09:30:18", approximate: true, sourceUrl: doc.url });
  expect(facts.fees?.value).toHaveLength(3);
  expect(facts.routes?.value.map(route => route.distanceKm)).toEqual([50, 20]);
  expect(facts.organizer).toBeUndefined();
});
it("does not associate a real fee with the wrong deadline in the same row", () => {
  const quote = "27.02.2027 600,- Kč online 29.06.2027 750,- Kč online";
  expect(feeQuoteSupports(quote, 750, "CZK", "2027-06-29")).toBe(true);
  expect(feeQuoteSupports(quote, 750, "CZK", "2027-02-27")).toBe(false);
});
it("does not interpret last year's table or a multi-day event as a known single-day programme", () => {
  expect(practicalProgramme({ ...doc, url: doc.url.replace("2027", "2026") }, context)).toEqual({});
  expect(practicalProgramme(doc, { ...context, endDate: "2027-08-01" }).schedule).toBeUndefined();
});
it("merges positive variants while preserving each source and avoiding reread timestamp churn", () => {
  const old = practicalProgramme(doc, context);
  const replay = practicalProgramme(doc, context);
  for (const field of ["schedule", "fees", "routes"] as const) if (replay[field]) {
    replay[field]!.checkedAt = "2026-12-01T08:00:00Z";
    for (const item of replay[field]!.value) item.checkedAt = "2026-12-01T08:00:00Z";
  }
  const merged = mergePracticalDetails(old, replay);
  expect(merged.routes?.value).toEqual(old.routes?.value);
  const extra: PracticalDetails = { routes: { ...old.routes!, sourceUrl: "https://club.test/gpx", quote: "The 70 km route is called Ultra", value: [{ name: "Ultra", distanceKm: 70, sourceQuote: "The 70 km route is called Ultra", sourceUrl: "https://club.test/gpx" }] } };
  const combined = mergePracticalDetails(old, extra);
  expect(combined.routes?.value).toHaveLength(3);
  expect(combined.routes?.value[0].sourceUrl).toBe(doc.url);
  expect(combined.routes?.value[2].sourceUrl).toBe("https://club.test/gpx");
});

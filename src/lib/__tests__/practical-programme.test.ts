import { expect, it } from "vitest";
import { combinePracticalFindings, practicalProgramme } from "@/lib/catalog/practical-programme";
import { entryPrices, feeQuoteSupports } from "@/lib/catalog/practical-extraction";
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
  expect(feeQuoteSupports("od 29.06.2027 750,- Kč online", 750, "CZK", "2027-06-29")).toBe(false);
});
it("retains decimal prices and does not pair one amount with a different currency", () => {
  const quote = "1200 Kč tandem, 25,50 EUR pro zahraniční účastníky";
  expect(feeQuoteSupports(quote, 25.5, "EUR")).toBe(true);
  expect(feeQuoteSupports(quote, 25, "EUR")).toBe(false);
  expect(feeQuoteSupports(quote, 1200, "EUR")).toBe(false);
  expect(feeQuoteSupports("120\u202fzł", 120, "PLN")).toBe(true);
  expect(feeQuoteSupports("900.50 CHF", 900.5, "CHF")).toBe(true);
  expect(feeQuoteSupports("£25 / €25.50", 25.5, "EUR")).toBe(true);
  const priced = { ...doc, text: doc.text.replace("750,- Kč", "1\u202f250,50 Kč") };
  expect(practicalProgramme(priced, context).fees?.value).toContainEqual(expect.objectContaining({ amount: 1250.5, currency: "CZK", validUntil: "2027-06-29" }));
  const ambiguous = { ...doc, text: doc.text.replace("750,- Kč online", "750,- Kč členové, 850,- Kč ostatní") };
  expect(practicalProgramme(ambiguous, context).fees?.value.some(fee => fee.validUntil === "2027-06-29")).toBe(false);
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

const keyValueDoc = { url: "https://club.test/propozice/", links: [], text: "Club navigation\nZávod | RAAB FORCE Rohálovská 50ka 2027 - 18. ročník\nPořadatel | Sportovní klub Vesani.cz, z.s.\nTermín | 1.5.2027\nPrezence | Kulturní dům\nStart | Start hlavního závodu 1.5.2027 ve 12:30 v Prusinovicích. Start dětských závodů od 8:30\nStartovné | 1200 Kč tandemy 25 EUR pro zahraniční účastníky" };
const keyValueContext = { name: "RAAB FORCE Rohálovská 50ka 2027 - 18. ročník", startDate: "2027-05-01" };
it("reads an edition-bound label/value table at a year-neutral URL", () => {
  const details = practicalProgramme(keyValueDoc, keyValueContext);
  expect(details.organizer?.value.name).toBe("Sportovní klub Vesani.cz, z.s.");
  expect(details.schedule?.value).toMatchObject([{ label: "Start hlavního závodu", date: "2027-05-01", time: "12:30" }]);
  expect(details.schedule?.value).toHaveLength(1);
  expect(details.fees).toBeUndefined();
  expect(details.venue).toBeUndefined();
});
it("keeps verbatim evidence for labelled prose without taking the children's time", () => {
  const plain = { ...keyValueDoc, text: keyValueDoc.text.replaceAll(" | ", ": ") };
  const details = practicalProgramme(plain, keyValueContext);
  expect(details.organizer?.value.name).toBe("Sportovní klub Vesani.cz, z.s.");
  expect(details.schedule?.value).toMatchObject([{ time: "12:30", sourceQuote: expect.stringMatching(/^Start: /) }]);
  expect(practicalProgramme({ ...plain, text: plain.text.replaceAll("2027", "2026") + "\n© 2027" }, keyValueContext)).toEqual({});
});
it("does not confirm an old table using a footer year or a nearby second race", () => {
  expect(practicalProgramme({ ...keyValueDoc, text: keyValueDoc.text.replaceAll("2027", "2026") + "\n© 2027" }, keyValueContext)).toEqual({});
  expect(practicalProgramme({ ...keyValueDoc, text: keyValueDoc.text.replace("Termín | 1.5.2027", "Závod | Another race 2027\nTermín | 1.5.2027") }, keyValueContext)).toEqual({});
});
it("does not take a preceding day's time or an unrelated identity", () => {
  expect(practicalProgramme(keyValueDoc, { name: "Other unrelated race", startDate: "2027-05-01" })).toEqual({});
  expect(practicalProgramme({ ...keyValueDoc, text: keyValueDoc.text.replace("Start hlavního závodu 1.5.2027", "Start hlavního závodu 30.4.2027") }, keyValueContext).schedule).toBeUndefined();
});
it("keeps fields and route variants across independently read documents", () => {
  const programme = practicalProgramme(doc, context);
  const venue: PracticalDetails = { venue: { value: { name: "Race venue", precision: "venue" }, sourceUrl: "https://club.test/contact", quote: "Race venue is here", status: "year_neutral", editionYear: 2027, checkedAt: "2026-11-03T10:00:00Z" } };
  const combined = combinePracticalFindings(programme, venue);
  expect(combined.schedule).toEqual(programme.schedule);
  expect(combined.venue).toEqual(venue.venue);
  const additional: PracticalDetails = { routes: { ...programme.routes!, value: [{ name: "Short", distanceKm: 10 }] } };
  expect(combinePracticalFindings(combined, additional).routes?.value.map(row => row.distanceKm)).toEqual([50, 20, 10]);
});

it("reads the currency spellings organisers write in full or without diacritics", () => {
  for (const [quote, amount, currency] of [["Startgeld 25 Euro", 25, "EUR"], ["Startgeld: 25,- Euro", 25, "EUR"], ["500 Kc", 500, "CZK"], ["60 zl", 60, "PLN"], ["Fr. 40", 40, "CHF"], ["40 SFr.", 40, "CHF"]] as const) {
    expect(entryPrices(quote).map(({ amount, currency }) => ({ amount, currency }))).toEqual([{ amount, currency }]);
    expect(feeQuoteSupports(quote, amount, currency)).toBe(true);
  }
  expect(feeQuoteSupports("Startgeld 25 Euro", 25, "CHF")).toBe(false);
  expect(entryPrices("Europa 25 Europameister 3 Frauen 40 Fr")).toEqual([]);
});

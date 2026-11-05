import { expect, it } from "vitest";
import { resolvePracticalEvidence, verifyPracticalExtraction } from "@/lib/catalog/practical-extraction";
const url = "https://club.test/guide.pdf";
const text = 'Forest Cross 2027\nDate: 1. 5. 2027\nV E R A N S T A L T E R\nForest Club\nProgram\n09:30 Elite start\nOffice: Other Street';
const documents = [{ url, text, links: [] }];
const context = { name: "Forest Cross", startDate: "2027-05-01", documents };
const raw = { facts: {
  organizer: { value: { name: "Forest Club" }, source_url: url, quote_lines: { first: 3, last: 4 }, identity_lines: { first: 1, last: 1 }, edition_lines: { first: 1, last: 2 }, status: "current" },
  schedule: { value: [{ label: "Elite start", date: "2027-05-01", time: "09:30", sourceLines: { first: 6, last: 6 }, sourceUrl: url }], source_url: url, quote_lines: { first: 5, last: 6 }, identity_lines: { first: 1, last: 1 }, edition_lines: { first: 1, last: 2 }, status: "current" },
} };
it("copies exact source lines including PDF typography and verifies the values independently", () => {
  const checked = verifyPracticalExtraction(resolvePracticalEvidence(raw, documents), context);
  expect(checked.rejected).toEqual([]);
  expect(checked.details.organizer?.quote).toBe('V E R A N S T A L T E R\nForest Club');
  expect(checked.details.schedule?.value[0].sourceQuote).toBe('09:30 Elite start');
});
it("does not accept an invented value even when its line references exist", () => {
  const checked = verifyPracticalExtraction(resolvePracticalEvidence({ facts: { organizer: { ...raw.facts.organizer, value: { name: "Invented Club" } } } }, documents), context);
  expect(checked.details).toEqual({});
});
for (const range of [{first:0,last:1},{first:6,last:2},{first:1,last:100},{first:1.5,last:2},[]]) {
  it(`rejects invalid line references ${JSON.stringify(range)} without throwing`, () => {
    const checked = verifyPracticalExtraction(resolvePracticalEvidence({ facts: { organizer: { ...raw.facts.organizer, quote_lines: range } } }, documents), context);
    expect(checked.details).toEqual({});
  });
}
it("cannot borrow a quotation from an unknown document", () => {
  const checked = verifyPracticalExtraction(resolvePracticalEvidence({ facts: { organizer: { ...raw.facts.organizer, source_url: "https://invented.test/" } } }, documents), context);
  expect(checked.details).toEqual({});
});

it("parses compact value strings independently, retaining a good fact when another is malformed", () => {
  const facts = Object.entries(raw.facts).map(([field, fact]) => ({ ...fact, field, value_json: JSON.stringify(fact.value) }));
  facts[1].value_json = "not JSON";
  const checked = verifyPracticalExtraction(resolvePracticalEvidence({ facts }, documents), context);
  expect(checked.details.organizer?.value.name).toBe("Forest Club");
  expect(checked.rejected).toEqual(["schedule"]);
});

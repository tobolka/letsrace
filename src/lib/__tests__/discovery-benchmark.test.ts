import { describe, expect, it } from "vitest";
import { verifyBenchmarkAssertion } from "@/lib/discovery/benchmark";
const row = { name: "Rusavská 50", dateText: "12. 6.", url: "https://rusavska50.cz/propozice", place: "Rusava", discipline: "MTB" };
const html = "<title>Propozice</title><table><tr><td>Závod</td><td>Rusavská 50</td></tr><tr><td>Termín</td><td>12. 6. 2027</td></tr></table>";
describe("targeted benchmark verification", () => {
  it("requires source evidence even when the model agrees with the CSV", () => {
    const result = verifyBenchmarkAssertion({ is_this_event: true, verdict: "stated", race: { name: "Rusavská 50", start_date: "2027-06-12", quote: "Invented 12. 6. 2027 Rusavská 50" } }, row, html, 2027);
    expect(result.status).toBe("unverified"); expect(result.rejections).toContain("quote_not_on_page");
  });
  it("accepts separate literal name/date fields without making a publication decision", () => {
    const result = verifyBenchmarkAssertion({ is_this_event: true, verdict: "stated", race: { name: "Rusavská 50", start_date: "2027-06-12", name_quote: "Závod | Rusavská 50", quote: "Termín | 12. 6. 2027" } }, row, html, 2027);
    expect(result.status).toBe("date_supported"); expect(result.identityNeedsReview).toBe(false);
    expect(result.event?.evidence?.quote).toContain("Závod | Rusavská 50");
  });
  it("keeps a source-supported conflicting date instead of copying the input date", () => {
    const result = verifyBenchmarkAssertion({ is_this_event: true, verdict: "stated", race: { name: "Rusavská 50", start_date: "2027-06-12", quote: "Termín | 12. 6. 2027" } }, { ...row, dateText: "13. 6." }, html, 2027);
    expect(result.status).toBe("different_date"); expect(result.event?.startDate).toBe("2027-06-12");
  });
  it("does not promote a provisional date even when its literal day is present", () => {
    const result = verifyBenchmarkAssertion({ is_this_event: true, verdict: "tentative", race: { name: "Rusavská 50", start_date: "2027-06-12", quote: "Termín | 12. 6. 2027" } }, row, html, 2027);
    expect(result.status).toBe("tentative");
  });
});

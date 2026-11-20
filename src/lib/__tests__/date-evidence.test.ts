import { describe, expect, it } from "vitest";
import { attachDateEvidence, dateQuote } from "@/lib/watcher/date-evidence";
import type { ParsedEvent } from "@/lib/domain";

const page = "Kalendář 2027 Pinguin Žernovský bajk — 5. června 2027, Žernovka. Další: Hornoměcholupský crossmajstr 12.–13. 6. 2027 Praha.";
const event = (over: Partial<ParsedEvent>) => ({ name: "Pinguin Žernovský bajk", startDate: "2027-06-05", sourceUrl: "https://organizer.test/", ...over }) as ParsedEvent;

describe("date quote from the page text", () => {
  it("is the page's own words around the race name, with the full date", () => {
    const quote = dateQuote(page, event({}));
    expect(quote).toContain("5. června 2027");
    expect(page.replace(/\s+/g, " ")).toContain(quote!);
  });

  it("needs the race's name in the text, not only a date", () => {
    expect(dateQuote(page, event({ name: "Zcela jiný závod" }))).toBeNull();
    expect(dateQuote("Termín 5. června 2027.", event({}))).toBeNull();
  });

  it("needs the year, so another year's date does not count", () => {
    expect(dateQuote("Pinguin Žernovský bajk — 5. června 2026, Žernovka", event({}))).toBeNull();
  });

  it("needs the end date too when the race has one", () => {
    const multi = event({ name: "Hornoměcholupský crossmajstr", startDate: "2027-06-12", endDate: "2027-06-13" });
    expect(dateQuote(page, multi)).toContain("12.–13. 6. 2027");
    expect(dateQuote(page, { ...multi, endDate: "2027-06-20" })).toBeNull();
  });

  it("does not replace a quote a reader already has, and marks its own method", () => {
    const own = event({ evidence: { quote: "x", sourceUrl: "u", method: "llm_calendar", version: "1" } });
    const [kept, added] = attachDateEvidence("https://organizer.test/", page, [own, event({})]);
    expect(kept.evidence?.method).toBe("llm_calendar");
    expect(added.evidence).toMatchObject({ method: "page_text_near_name", sourceUrl: "https://organizer.test/" });
  });
});

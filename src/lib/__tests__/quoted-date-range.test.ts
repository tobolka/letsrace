import { expect, it } from "vitest";
import { quoteStatesDate } from "@/lib/catalog/quoted-date";
it("verifies the opening and closing dates of full and shared-month numeric ranges", () => {
  for (const quote of ["11. 6. - 13. 6. 2027 DoKola!", "11.–13. 6. 2027 DoKola!"]) {
    expect(quoteStatesDate(quote, "2027-06-11")).toBe(true);
    expect(quoteStatesDate(quote, "2027-06-13")).toBe(false);
    expect(quoteStatesDate(quote, "2027-06-13", { role: "end" })).toBe(true);
    expect(quoteStatesDate(quote, "2026-06-11")).toBe(false);
  }
});
it("reads Czech nominative month ranges without substituting the closing day", () => {
  expect(quoteStatesDate("21. – 23. květen 2027", "2027-05-21")).toBe(true);
  expect(quoteStatesDate("21. – 23. květen 2027", "2027-05-23", { role: "end" })).toBe(true);
  expect(quoteStatesDate("16. – 18. červenec 2027", "2027-07-16")).toBe(true);
  expect(quoteStatesDate("16. – 18. červenec 2027", "2027-07-18", { role: "end" })).toBe(true);
  expect(quoteStatesDate("12.-15.srpna2027", "2027-08-12")).toBe(true);
  expect(quoteStatesDate("12.-15.srpna2027", "2027-08-15", { role: "end" })).toBe(true);
  expect(quoteStatesDate("30. – 31. únor 2027", "2027-02-28")).toBe(false);
});

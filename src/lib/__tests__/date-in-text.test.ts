import { describe, expect, it } from "vitest";
import { textNamesDate, textNamesEdition } from "@/lib/date-in-text";

describe("textNamesDate", () => {
  it("reads the common ways a race page writes its date", () => {
    expect(textNamesDate("Termín: 3.10.2026", "2026-10-03")).toBe(true);
    expect(textNamesDate("sobota 3. 10. 2026", "2026-10-03")).toBe(true);
    expect(textNamesDate("Sa, 03.10.", "2026-10-03")).toBe(true);
    expect(textNamesDate("3. října 2026", "2026-10-03")).toBe(true);
    expect(textNamesDate("domenica 4 ottobre", "2026-10-04")).toBe(true);
    expect(textNamesDate("October 3rd, 2026", "2026-10-03")).toBe(true);
    expect(textNamesDate("13.10.2026", "2026-10-03")).toBe(false);
    expect(textNamesDate("3.11.2026", "2026-10-03")).toBe(false);
  });
  it("knows last year's page from this year's", () => {
    expect(textNamesEdition("Rennen am 3.10.2025", "2026-10-03")).toBe(false);
    expect(textNamesEdition("Rennen am 3.10.2026", "2026-10-03")).toBe(true);
  });
});

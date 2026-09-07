import { describe, expect, it } from "vitest";
import { repairText } from "@/lib/text";

/**
 * A German organiser writes "Pott’s Leeze Tour" on a Windows-1252 page, where
 * the apostrophe is byte 0x92. Something upstream read the page as Latin-1, so
 * it arrives as U+0092 — a control character with no glyph — and the name shows
 * an empty box. The bytes were never lost, only mislabelled.
 */
describe("repairText", () => {
  it("turns a mis-decoded Windows-1252 apostrophe back into one", () => {
    expect(repairText("Pott\u0092s Leeze Tour")).toBe("Pott\u2019s Leeze Tour");
    expect(repairText("Trail\u0092N Gravel")).toBe("Trail\u2019N Gravel");
  });

  it("handles the rest of the block the same way", () => {
    expect(repairText("\u0093Quoted\u0094")).toBe("\u201cQuoted\u201d");
    expect(repairText("Rund\u0096um")).toBe("Rund\u2013um");
    expect(repairText("Caf\u0092s \u0085")).toBe("Caf\u2019s \u2026");
  });

  it("drops the positions Windows-1252 leaves empty rather than showing a hole", () => {
    expect(repairText("A\u0081B")).toBe("AB");
    expect(repairText("A\u008dB")).toBe("AB");
  });

  it("strips control characters that are not text", () => {
    expect(repairText("Race\u0000 name")).toBe("Race name");
    expect(repairText("Race\u001fname")).toBe("Racename");
  });

  it("leaves clean text and empty values exactly as they are", () => {
    expect(repairText("Pott\u2019s Leeze Tour")).toBe("Pott\u2019s Leeze Tour");
    expect(repairText("\u0160umavsk\u00fd marat\u00f3n \u2014 2026")).toBe(
      "\u0160umavsk\u00fd marat\u00f3n \u2014 2026",
    );
    expect(repairText("")).toBe("");
    expect(repairText(null)).toBeNull();
    expect(repairText(undefined)).toBeUndefined();
  });

  it("keeps the tabs and newlines a description may legitimately carry", () => {
    expect(repairText("a\tb\nc")).toBe("a\tb\nc");
  });
});

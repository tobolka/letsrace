import { describe, expect, it } from "vitest";
import { pluralForm, pluralize } from "@/lib/i18n/plural";

describe("pluralForm", () => {
  it("uses one vs many in English", () => {
    expect(pluralForm(1, "en")).toBe("one");
    expect(pluralForm(2, "en")).toBe("many");
    expect(pluralForm(5, "en")).toBe("many");
  });

  it("uses Czech 1 / 2–4 / 5+", () => {
    expect(pluralForm(1, "cs")).toBe("one");
    expect(pluralForm(2, "cs")).toBe("few");
    expect(pluralForm(4, "cs")).toBe("few");
    expect(pluralForm(5, "cs")).toBe("many");
    expect(pluralForm(22, "cs")).toBe("few");
    expect(pluralForm(12, "cs")).toBe("many");
  });
});

describe("pluralize", () => {
  it("fills the count", () => {
    expect(
      pluralize(3, "cs", { one: "{n} závod", few: "{n} závody", many: "{n} závodů" }),
    ).toBe("3 závody");
  });
});

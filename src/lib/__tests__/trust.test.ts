import { describe, expect, it } from "vitest";
import { lastCheckedLabel, lastCheckedWhen } from "@/lib/trust";

const noon = new Date(2026, 7, 18, 12, 0, 0);

describe("lastCheckedWhen", () => {
  it("uses calendar days for today and yesterday", () => {
    expect(lastCheckedWhen(new Date(2026, 7, 18, 8).toISOString(), "en", noon)).toBe("today");
    expect(lastCheckedWhen(new Date(2026, 7, 17, 18).toISOString(), "en", noon)).toBe("yesterday");
  });

  it("uses relative days, then weeks", () => {
    expect(lastCheckedWhen(new Date(2026, 7, 15).toISOString(), "en", noon)).toBe("3 days ago");
    expect(lastCheckedWhen(new Date(2026, 6, 28).toISOString(), "en", noon)).toMatch(/week/);
  });

  it("localizes Czech", () => {
    expect(lastCheckedWhen(new Date(2026, 7, 18).toISOString(), "cs", noon)).toBe("dnes");
    expect(lastCheckedWhen(new Date(2026, 7, 15).toISOString(), "cs", noon)).toMatch(/3/);
  });
});

describe("lastCheckedLabel", () => {
  it("fills the checked template", () => {
    expect(
      lastCheckedLabel(new Date(2026, 7, 18).toISOString(), "en", "Checked {when}", noon),
    ).toBe("Checked today");
    expect(
      lastCheckedLabel(new Date(2026, 7, 15).toISOString(), "cs", "Zkontrolováno {when}", noon),
    ).toMatch(/^Zkontrolováno /);
  });

  it("returns null without a timestamp", () => {
    expect(lastCheckedLabel(null, "en", "Checked {when}", noon)).toBeNull();
  });
});

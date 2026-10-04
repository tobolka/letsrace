import { describe, expect, it } from "vitest";
import { preferredLocale } from "@/proxy";

describe("preferredLocale", () => {
  it("takes the reader's first language we have", () => {
    expect(preferredLocale("cs-CZ,cs;q=0.9,en;q=0.8")).toBe("cs");
    expect(preferredLocale("de-DE,de;q=0.9,pl;q=0.5")).toBe("pl");
    expect(preferredLocale("en-US,en;q=0.9,cs;q=0.8")).toBe("en");
    expect(preferredLocale("sk;q=0.4, pl;q=0.9")).toBe("pl");
  });
  it("has nothing to say without a match or a header", () => {
    expect(preferredLocale(null)).toBeNull();
    expect(preferredLocale("fr-FR,fr;q=0.9")).toBeNull();
  });
});

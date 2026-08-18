import { describe, expect, it } from "vitest";
import { firstOpenableUrl, openableUrl } from "@/lib/admin/urls";

describe("admin URL helpers", () => {
  it("opens http(s) and rejects junk", () => {
    expect(openableUrl("https://mtbtrilogy.com")).toBe("https://mtbtrilogy.com/");
    expect(openableUrl("  http://example.com/race  ")).toBe("http://example.com/race");
    expect(openableUrl("javascript:alert(1)")).toBeNull();
    expect(openableUrl("nisekoclassic.com")).toBeNull();
    expect(firstOpenableUrl(null, "", "https://sport-base.eu/competitions/kujebike-26")).toBe(
      "https://sport-base.eu/competitions/kujebike-26",
    );
  });
});

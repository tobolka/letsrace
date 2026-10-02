import { describe, expect, it } from "vitest";

describe("organiser site over a calendar page", () => {
  it("keeps the organiser's site when a calendar is read again", async () => {
    const { preferDeeperOfficialUrl } = await import("@/lib/watcher/public-url");
    expect(preferDeeperOfficialUrl("https://odjazd.pl/wydarzenie/abc", "https://wanogagravel.pl/")).toBe("https://wanogagravel.pl/");
    expect(preferDeeperOfficialUrl("https://wanogagravel.pl/", "https://kalendarzrowerowy.pl/wydarzenie/x/")).toBe("https://wanogagravel.pl/");
  });
});

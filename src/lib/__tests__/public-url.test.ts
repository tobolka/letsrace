import { describe, expect, it } from "vitest";

describe("organiser site over a calendar page", () => {
  it("keeps the organiser's site when a calendar is read again", async () => {
    const { preferDeeperOfficialUrl } = await import("@/lib/watcher/public-url");
    expect(preferDeeperOfficialUrl("https://odjazd.pl/wydarzenie/abc", "https://wanogagravel.pl/")).toBe("https://wanogagravel.pl/");
    expect(preferDeeperOfficialUrl("https://wanogagravel.pl/", "https://kalendarzrowerowy.pl/wydarzenie/x/")).toBe("https://wanogagravel.pl/");
  });
});

describe("which page stays as a race's website", () => {
  const racePage = "https://tbcserie.cz/kalendar-2026/zavod-203/";
  it("a homepage of another site never replaces a race's own page", async () => {
    const { preferDeeperOfficialUrl } = await import("@/lib/watcher/public-url");
    expect(preferDeeperOfficialUrl("http://www.sumator.cz/", racePage)).toBe(racePage);
    expect(preferDeeperOfficialUrl("http://www.tbcserie.cz/", "https://spsvd.cz/hurecky-krpal-2026")).toBe("https://spsvd.cz/hurecky-krpal-2026");
  });
  it("a race's own page replaces a homepage", async () => {
    const { preferDeeperOfficialUrl } = await import("@/lib/watcher/public-url");
    expect(preferDeeperOfficialUrl(racePage, "http://www.tbcserie.cz/")).toBe(racePage);
    expect(preferDeeperOfficialUrl(racePage, "https://www.ckjihoceskenadeje.cz/")).toBe(racePage);
  });
  it("two pages of different sites do not take turns", async () => {
    const { preferDeeperOfficialUrl } = await import("@/lib/watcher/public-url");
    const other = "https://spsvd.cz/hurecky-krpal-2026";
    expect(preferDeeperOfficialUrl(other, racePage)).toBe(racePage);
    expect(preferDeeperOfficialUrl(racePage, other)).toBe(other);
  });
  it("a calendar's page gives way to any page of the race's own", async () => {
    const { preferDeeperOfficialUrl } = await import("@/lib/watcher/public-url");
    const calendar = "https://kalendar.winspace.cz/kalendar/2026-tbc-serie-2026-1a27d1e2";
    expect(preferDeeperOfficialUrl(calendar, racePage)).toBe(racePage);
    expect(preferDeeperOfficialUrl(racePage, calendar)).toBe(racePage);
  });
});

describe("the website button of a race page", () => {
  const sources = ["https://kalendar.winspace.cz/kalendar/2026-tbc-serie-2026-a6164f39", "https://tbcserie.cz/kalendar-2026/zavod-217/", "https://maraton.cz/terminovka"];
  it("keeps the race's own stored page, whatever its sources are", async () => {
    const { resolveEventOutboundUrls } = await import("@/lib/watcher/public-url");
    expect(resolveEventOutboundUrls({ websiteUrl: "https://tbcserie.cz/kalendar-2026/zavod-216/", sourceUrls: sources }).websiteUrl).toBe("https://tbcserie.cz/kalendar-2026/zavod-216/");
  });
  it("never lands on a calendar when a source is the race's own page", async () => {
    const { resolveEventOutboundUrls } = await import("@/lib/watcher/public-url");
    expect(resolveEventOutboundUrls({ websiteUrl: "http://www.tbcserie.cz/", sourceUrls: ["https://kalendar.winspace.cz/kalendar/x", "https://tbcserie.cz/kalendar-2026/zavod-203/"] }).websiteUrl).toBe("https://tbcserie.cz/kalendar-2026/zavod-203/");
  });
  it("replaces a calendar's page with a known race page", async () => {
    const { resolveEventOutboundUrls } = await import("@/lib/watcher/public-url");
    expect(resolveEventOutboundUrls({ websiteUrl: "https://kalendar.winspace.cz/kalendar/x", sourceUrls: ["https://tbcserie.cz/kalendar-2026/zavod-203/"] }).websiteUrl).toBe("https://tbcserie.cz/kalendar-2026/zavod-203/");
  });
  it("leaves an organiser's homepage rather than sending riders to a price list, an FAQ or another site", async () => {
    const { resolveEventOutboundUrls } = await import("@/lib/watcher/public-url");
    expect(resolveEventOutboundUrls({ websiteUrl: "https://szutrypremium.pl/", sourceUrls: ["https://szutrypremium.pl/ceny/"] }).websiteUrl).toBe("https://szutrypremium.pl/");
    expect(resolveEventOutboundUrls({ websiteUrl: "https://www.ostalbgravel.de/", sourceUrls: ["https://www.ostalbgravel.de/alle-infos/faq-s/"] }).websiteUrl).toBe("https://www.ostalbgravel.de/");
    expect(resolveEventOutboundUrls({ websiteUrl: "https://zavod.cz/", sourceUrls: ["https://jiny-kalendar.cz/zavod/123"] }).websiteUrl).toBe("https://zavod.cz/");
  });
});

describe("the results link", () => {
  it("points at the timing server once the race has started, and not before", async () => {
    const { resolveEventOutboundUrls } = await import("@/lib/watcher/public-url");
    const race = { registrationUrl: "https://maraton.cz/terminovka/entry/571" };
    expect(resolveEventOutboundUrls({ ...race, startDate: "2026-11-07", today: "2026-11-07" }).resultsUrl).toBe("https://maraton.cz/");
    expect(resolveEventOutboundUrls({ ...race, startDate: "2026-11-07", today: "2026-11-06" }).resultsUrl).toBeNull();
    expect(resolveEventOutboundUrls({ registrationUrl: "https://my.raceresult.com/386744/", startDate: "2026-01-01", today: "2026-11-06" }).resultsUrl).toBe("https://my.raceresult.com/386744/");
  });
  it("prefers the race's own results and guesses nothing for an unknown entry page", async () => {
    const { resolveEventOutboundUrls } = await import("@/lib/watcher/public-url");
    expect(resolveEventOutboundUrls({ registrationUrl: "https://maraton.cz/x", resultsUrl: "https://a.cz/vysledky", startDate: "2026-01-01", today: "2026-11-06" }).resultsUrl).toBe("https://a.cz/vysledky");
    expect(resolveEventOutboundUrls({ registrationUrl: "https://klub.cz/prihlaska", startDate: "2026-01-01", today: "2026-11-06" }).resultsUrl).toBeNull();
  });
});

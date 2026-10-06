import { describe, expect, it } from "vitest";
import { collectionPath, hubPath, localePath, routePath, SECTION_SLUGS, translatePathname } from "@/lib/localized-paths";
import { locales } from "@/lib/i18n/messages";
import { COLLECTION_SLUGS } from "@/lib/race-collections";

describe("localized addresses", () => {
  it("builds addresses in the page's language", () => {
    expect(localePath("cs", "e/ct-author-cup-2026")).toBe("/cs/zavod/ct-author-cup-2026");
    expect(localePath("de", "series/x?y=1")).toBe("/de/serie/x?y=1");
    expect(localePath("cs", "account/riders")).toBe("/cs/muj-plan/jezdci");
    expect(localePath("en", "account")).toBe("/en/my-plan");
    expect(localePath("sk", "")).toBe("/sk");
    expect(localePath("pl", "privacy")).toBe("/pl/privacy");
    expect(hubPath("cs", "CZ", "mtb")).toBe("zavody/cz/mtb");
    expect(hubPath("de", "AT")).toBe("radrennen/at");
    expect(collectionPath("cs", "kids-weekend")).toBe("zavody/deti-tento-vikend");
    expect(collectionPath("en", "kids", "SK")).toBe("races/kids/sk");
  });

  it("serves each public address from its route", () => {
    expect(routePath("/cs/zavod/ct-author-cup-2026")).toEqual({ rewrite: "/cs/e/ct-author-cup-2026" });
    expect(routePath("/cs/zavody/cz/mtb")).toEqual({ rewrite: "/cs/c/cz/mtb" });
    expect(routePath("/cs/zavody/deti/cz")).toEqual({ rewrite: "/cs/collections/kids/cz" });
    expect(routePath("/de/mein-plan/einstellungen")).toEqual({ rewrite: "/de/account/settings" });
    expect(routePath("/en/series/x")).toBeNull();
    expect(routePath("/en/list")).toBeNull();
    expect(routePath("/cs")).toBeNull();
    expect(routePath("/cs/auth")).toBeNull();
    for (const l of locales) {
      for (const slug of COLLECTION_SLUGS) {
        expect(routePath(`/${l}/${collectionPath(l, slug, "PL")}`)).toEqual({ rewrite: `/${l}/collections/${slug}/pl` });
      }
    }
  });

  it("redirects route addresses and other languages' addresses permanently", () => {
    expect(routePath("/cs/e/ct-author-2026-10-10")).toEqual({ redirect: "/cs/zavod/ct-author-2026-10-10" });
    expect(routePath("/cs/c")).toEqual({ redirect: "/cs/zavody" });
    expect(routePath("/en/collections/kids-weekend/de")).toEqual({ redirect: "/en/races/kids-this-weekend/de" });
    expect(routePath("/cs/races/this-weekend")).toEqual({ redirect: "/cs/zavody/tento-vikend" });
    expect(routePath("/cs/account/settings")).toEqual({ redirect: "/cs/muj-plan/nastaveni" });
    expect(routePath("/pl/zavod/x-2026")).toEqual({ redirect: "/pl/wyscig/x-2026" });
    expect(routePath("/en/schedule")).toEqual({ redirect: "/en/calendar" });
  });

  it("translates the current page into another language", () => {
    expect(translatePathname("/cs/zavod/ct-author-cup-2026", "en")).toBe("/en/race/ct-author-cup-2026");
    expect(translatePathname("/cs/zavody/deti-tento-vikend/cz", "de")).toBe("/de/radrennen/kinder-dieses-wochenende/cz");
    expect(translatePathname("/en/my-plan/riders", "cs")).toBe("/cs/muj-plan/jezdci");
    expect(translatePathname("/en", "pl")).toBe("/pl");
    expect(translatePathname("/en/auth", "cs")).toBe("/cs/auth");
  });

  it("never gives two sections the same word, in any language", () => {
    const owner = new Map<string, string>();
    for (const l of locales) {
      for (const [section, word] of Object.entries(SECTION_SLUGS[l])) {
        expect(owner.get(word) ?? section, `${l}:${word}`).toBe(section);
        owner.set(word, section);
      }
    }
  });
});

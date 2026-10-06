import { describe, expect, it } from "vitest";
import { collectionPath, hubPath, translateBrowsePath } from "@/lib/browse-paths";
import { locales } from "@/lib/i18n/messages";
import { COLLECTION_SLUGS } from "@/lib/race-collections";
import { browseRouting } from "@/proxy";

describe("browse addresses", () => {
  it("builds addresses in the page's language", () => {
    expect(hubPath("cs")).toBe("zavody");
    expect(hubPath("cs", "CZ", "mtb")).toBe("zavody/cz/mtb");
    expect(hubPath("de", "AT")).toBe("rennen/at");
    expect(collectionPath("cs", "kids-weekend")).toBe("zavody/deti-tento-vikend");
    expect(collectionPath("en", "kids", "SK")).toBe("races/kids/sk");
  });

  it("serves every public address from its route and back", () => {
    expect(browseRouting("/cs/zavody")).toEqual({ rewrite: "/cs/c" });
    expect(browseRouting("/cs/zavody/cz/mtb")).toEqual({ rewrite: "/cs/c/cz/mtb" });
    expect(browseRouting("/cs/zavody/deti/cz")).toEqual({ rewrite: "/cs/collections/kids/cz" });
    for (const l of locales) {
      for (const slug of COLLECTION_SLUGS) {
        expect(browseRouting(`/${l}/${collectionPath(l, slug, "PL")}`)).toEqual({ rewrite: `/${l}/collections/${slug}/pl` });
      }
    }
  });

  it("redirects the old addresses permanently to the new ones", () => {
    expect(browseRouting("/cs/c")).toEqual({ redirect: "/cs/zavody" });
    expect(browseRouting("/pl/c/cz/cx")).toEqual({ redirect: "/pl/wyscigi/cz/cx" });
    expect(browseRouting("/en/collections/kids-weekend/de")).toEqual({ redirect: "/en/races/kids-this-weekend/de" });
    expect(browseRouting("/cs/races")).toEqual({ redirect: "/cs/zavody" });
    expect(browseRouting("/cs/e/some-race")).toBeNull();
  });

  it("translates an address between languages and repairs a mismatched one", () => {
    expect(translateBrowsePath(["zavody", "deti-tento-vikend", "cz"], "en")).toBe("races/kids-this-weekend/cz");
    expect(translateBrowsePath(["races", "cz", "mtb"], "de")).toBe("rennen/cz/mtb");
    expect(translateBrowsePath(["e", "some-race"], "cs")).toBeNull();
    expect(browseRouting("/cs/races/this-weekend")).toEqual({ redirect: "/cs/zavody/tento-vikend" });
    expect(browseRouting("/pl/zavody/cz")).toEqual({ redirect: "/pl/wyscigi/cz" });
  });

  it("keeps collection slugs apart from two-letter country codes", () => {
    for (const l of locales) for (const slug of COLLECTION_SLUGS) expect(collectionPath(l, slug).split("/")[1]!.length).toBeGreaterThan(2);
  });
});

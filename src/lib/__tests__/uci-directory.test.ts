import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { uciDirectoryClass, uciDirectoryEvent, uciDirectoryId, uciDirectoryLevel, uciDirectoryWebsite } from "@/lib/catalog/uci-directory";
import { quoteStatesDate } from "@/lib/catalog/quoted-date";

const fixture = (id: string) => JSON.parse(readFileSync(`src/lib/__tests__/fixtures/uci-directory/${id}.json`, "utf8"));

describe("UCI Competition Directory", () => {
  it("reads a junior stage race with its class, website, category and both dates", () => {
    const event = uciDirectoryEvent(fixture("4fa9f103-5886-47e0-9ccd-a43ecebb4f5e"))!;
    expect(event).toMatchObject({ name: "Grand Prix West Bohemia", startDate: "2027-05-01", endDate: "2027-05-02", countryHint: "CZ", uciClass: "2.1", websiteUrl: "https://gpwb.cz/", ageCategories: ["junior"] });
    expect(event.categories?.map((c) => c.name)).toEqual(["Men Junior"]);
    expect(quoteStatesDate(event.evidence!.quote, event.startDate)).toBe(true);
    expect(quoteStatesDate(event.evidence!.quote, event.endDate!, { role: "end" })).toBe(true);
  });

  it("reads a cyclo-cross C2 with the race of each category", () => {
    const event = uciDirectoryEvent(fixture("24c0c847-659b-4162-9cd5-2f625e0b232d"))!;
    expect(event).toMatchObject({ discipline: ["cx"], uciClass: "c2", countryHint: "DE", ageCategories: ["junior", "elite"] });
    expect(event.categories?.map((c) => c.name)).toEqual(["Men Elite", "Women Elite", "Men Junior", "Women Junior"]);
    expect(uciDirectoryId(event.sourceUrl)).toBe("24c0c847-659b-4162-9cd5-2f625e0b232d");
  });

  it("leaves out disciplines the catalogue does not carry", () => {
    expect(uciDirectoryEvent(fixture("c890f55c-8978-4401-9513-69dc60f2f557"))).toBeNull(); // indoor
    expect(uciDirectoryEvent(fixture("f3d74699-71d5-4d80-9cc2-269af731f82e"))).toBeNull(); // trials
  });

  it("maps UCI class codes and levels", () => {
    expect(uciDirectoryClass("1", "MTB")).toBe("c1");
    expect(uciDirectoryClass("1", "ROA")).toBeNull();
    expect(uciDirectoryClass("1.UWT", "ROA")).toBe("worldtour");
    expect(uciDirectoryClass("2.Pro", "ROA")).toBe("proseries");
    expect(uciDirectoryClass("1.2U", "ROA")).toBe("1.2");
    expect(uciDirectoryLevel("CN")).toBe("national");
    expect(uciDirectoryLevel("CDM")).toBe("world_cup");
    expect(uciDirectoryLevel("C2")).toBe("international");
  });

  it("writes a bare host as a website and refuses anything else", () => {
    expect(uciDirectoryWebsite("www.cyklokros.cz")).toBe("https://www.cyklokros.cz/");
    expect(uciDirectoryWebsite("Gpwb.cz")).toBe("https://gpwb.cz/");
    expect(uciDirectoryWebsite("info@gpwb.cz")).toBeNull();
    expect(uciDirectoryWebsite("TBC")).toBeNull();
  });
});

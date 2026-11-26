import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  enrichUciCatalogRow,
  fetchUciJson,
  listUciDirectory,
  uciDirectoryCategoryState,
  uciDirectoryClass,
  uciDirectoryEvent,
  uciDirectoryId,
  uciDirectoryLevel,
  uciDirectoryWebsite,
  type UciCatalogRow,
  type UciDirectoryCompetition,
  type UciEnrichDeps,
} from "@/lib/catalog/uci-directory";
import { quoteStatesDate } from "@/lib/catalog/quoted-date";

const fixture = (id: string) => JSON.parse(readFileSync(`src/lib/__tests__/fixtures/uci-directory/${id}.json`, "utf8"));

describe("UCI Competition Directory", () => {
  it("identifies BMX racing when the UCI championship title omits its discipline", () => {
    const c = fixture("4fa9f103-5886-47e0-9ccd-a43ecebb4f5e");
    expect(uciDirectoryEvent({ ...c, name: "German National Championships", disciplineCode: "BMX" })?.name).toBe("German National Championships - BMX Racing");
  });
  it("replaces last year's youth category with this year's confirmed juniors", () => {
    const event = uciDirectoryEvent(fixture("4fa9f103-5886-47e0-9ccd-a43ecebb4f5e"))!;
    const current = { name: event.name, age_categories: ["junior", "youth"], age_confidence: "previous", practical_details: null };
    expect(uciDirectoryCategoryState(event, current)).toEqual({ ages: ["junior"], confidence: "explicit" });
    expect(uciDirectoryCategoryState(event, { ...current, age_confidence: "default", age_categories: ["junior", "u23", "elite"] })).toEqual({ ages: ["junior"], confidence: "explicit" });
  });

  it("preserves additional categories explicitly confirmed by current regulations", () => {
    const event = uciDirectoryEvent(fixture("4fa9f103-5886-47e0-9ccd-a43ecebb4f5e"))!;
    const current = { name: event.name, age_categories: ["junior", "youth"], age_confidence: "explicit", practical_details: { categories: { status: "current", editionYear: 2027, sourceUrl: "https://gpwb.cz/rules.pdf", quote: "Youth and junior races" } } };
    expect(uciDirectoryCategoryState(event, current)).toEqual({ ages: ["youth", "junior"], confidence: "explicit" });
    expect(uciDirectoryCategoryState(event, { ...current, age_confidence: "previous", practical_details: { categories: { ...current.practical_details.categories, editionYear: 2026 } } })).toEqual({ ages: ["junior"], confidence: "explicit" });
  });

  it("does not replace a whole weekend's categories from a differently named UCI race", () => {
    const event = uciDirectoryEvent(fixture("4fa9f103-5886-47e0-9ccd-a43ecebb4f5e"))!;
    expect(uciDirectoryCategoryState(event, { name: "World Cup weekend", age_categories: ["junior", "u23", "elite"], age_confidence: "previous", practical_details: null }))
      .toEqual({ ages: ["junior", "u23", "elite"], confidence: "previous" });
  });
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

  it("retries transient HTTP 429/5xx and network errors in fetchUciJson, but does not retry 404", async () => {
    let calls = 0;
    const waits: number[] = [];
    const okAfterRetries = await fetchUciJson("https://uci-competition.tech.uci.ch/api/competitions", {
      retries: 3,
      wait: async (ms) => { waits.push(ms); },
      fetch: async () => {
        calls++;
        if (calls === 1) return new Response("rate limited", { status: 429, headers: { "Retry-After": "1" } });
        if (calls === 2) throw new TypeError("fetch failed");
        if (calls === 3) return new Response("bad gateway", { status: 502 });
        return new Response(JSON.stringify({ count: 0, items: [] }), { status: 200 });
      },
    });
    expect(okAfterRetries).toEqual({ count: 0, items: [] });
    expect(calls).toBe(4);
    expect(waits).toHaveLength(3);
    expect(waits[0]).toBe(1000);

    let notFoundCalls = 0;
    await expect(fetchUciJson("https://uci-competition.tech.uci.ch/api/competitions/missing", {
      retries: 3,
      wait: async () => {},
      fetch: async () => {
        notFoundCalls++;
        return new Response("not found", { status: 404 });
      },
    })).rejects.toThrow("UCI directory HTTP 404");
    expect(notFoundCalls).toBe(1);
  });

  it("paginates listUciDirectory cleanly across pages", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: `id-${i}` }));
    const page2 = [{ id: "id-100" }];
    const items = await listUciDirectory(2027, "CZE", async (url) => {
      if (url.includes("offset=0")) return { count: 101, items: page1 };
      if (url.includes("offset=100")) return { count: 101, items: page2 };
      throw Error(`unexpected url: ${url}`);
    });
    expect(items).toHaveLength(101);
  });

  it("keeps row state and public_revision synchronized when multiple UCI entries match one race", async () => {
    const base = fixture("4fa9f103-5886-47e0-9ccd-a43ecebb4f5e") as UciDirectoryCompetition;
    const womenEntry: UciDirectoryCompetition = {
      ...base,
      id: "10c5a94a-f622-4253-9d00-fb024f185227",
      name: "VIVI ZURICRIT",
      countryCode: "SUI",
      venue: "Anny-Klawa-Platz",
      classCode: "CRTP",
      disciplineCode: "ROA",
      startDate: "2027-08-21",
      endDate: "2027-08-21",
      website: "www.zuricrit.ch",
      email: "tim@zuricrit.ch",
      categoryCodes: ["WE"],
      races: [{ categoryCode: "WE", categoryName: "Women Elite", raceTypeCode: "IRR" }],
    };
    const menEntry: UciDirectoryCompetition = {
      ...womenEntry,
      id: "4be146af-2f87-4c6d-a911-e0f8c12d0633",
      categoryCodes: ["ME"],
      races: [{ categoryCode: "ME", categoryName: "Men Elite", raceTypeCode: "IRR" }],
    };
    const juniorEntry: UciDirectoryCompetition = {
      ...womenEntry,
      id: "99999999-2f87-4c6d-a911-e0f8c12d0633",
      classCode: "1.1",
      categoryCodes: ["MJ"],
      races: [{ categoryCode: "MJ", categoryName: "Men Junior", raceTypeCode: "IRR" }],
    };

    const dbState = {
      revision: "rev-1",
      age_categories: ["u11", "u13", "u15", "kids", "youth", "u23"] as string[],
      age_confidence: "explicit",
      uci_class: null as string | null,
      website_url: null as string | null,
      practical_details: {} as Record<string, unknown>,
      sources: [
        { source_url: "https://uci-competition.tech.uci.ch/competitions/10c5a94a-f622-4253-9d00-fb024f185227", external_id: "uci-dir:10c5a94a-f622-4253-9d00-fb024f185227" },
        { source_url: "https://uci-competition.tech.uci.ch/competitions/4be146af-2f87-4c6d-a911-e0f8c12d0633", external_id: "uci-dir:4be146af-2f87-4c6d-a911-e0f8c12d0633" },
        { source_url: "https://uci-competition.tech.uci.ch/competitions/99999999-2f87-4c6d-a911-e0f8c12d0633", external_id: "uci-dir:99999999-2f87-4c6d-a911-e0f8c12d0633" },
      ],
    };
    let revCounter = 1;
    const bump = () => { revCounter++; dbState.revision = `rev-${revCounter}`; return dbState.revision; };

    const row: UciCatalogRow = {
      id: "event-vivi",
      slug: "vivi-zuricrit-2027",
      name: "VIVI ZURICRIT",
      start_date: "2027-08-21",
      end_date: "2027-08-21",
      visibility: "public",
      status: "scheduled",
      merged_into_id: null,
      level: "international",
      uci_class: null,
      website_url: null,
      registration_url: null,
      regulations_url: null,
      results_url: null,
      age_categories: [...dbState.age_categories],
      age_confidence: dbState.age_confidence,
      audience: "all",
      public_revision: dbState.revision,
      practical_details: null,
      disciplines: ["road"],
      location: { municipality: "Zürich", country_code: "CH" },
      sources: [...dbState.sources],
      overrides: null,
    };

    let updateCalls = 0;
    const deps: UciEnrichDeps = {
      apply: true,
      async updateEvent(_id, revision, patch) {
        updateCalls++;
        if (revision !== dbState.revision) throw Error("Catalogue changed while enriching the UCI competition");
        if (patch.age_categories) dbState.age_categories = patch.age_categories;
        if (patch.age_confidence) dbState.age_confidence = patch.age_confidence;
        if (patch.uci_class) dbState.uci_class = patch.uci_class;
        return bump();
      },
      async insertSource() {},
      async saveWebsite(_row, website) {
        if (dbState.website_url) return false;
        dbState.website_url = website;
        bump();
        return true;
      },
      async readRevision() {
        return dbState.revision;
      },
      async savePracticalDetails(_id, revision, details) {
        if (revision !== dbState.revision) return { status: "changed" };
        dbState.practical_details = { ...dbState.practical_details, ...details };
        bump();
        return { status: "saved" };
      },
    };

    const changes1 = await enrichUciCatalogRow(row, { competition: womenEntry, event: uciDirectoryEvent(womenEntry)! }, deps);
    const changes2 = await enrichUciCatalogRow(row, { competition: menEntry, event: uciDirectoryEvent(menEntry)! }, deps);
    const changes3 = await enrichUciCatalogRow(row, { competition: juniorEntry, event: uciDirectoryEvent(juniorEntry)! }, deps);

    expect(changes1).toContain("kategorie u11/u13/u15/kids/youth/u23 → u11/u13/u15/kids/youth/u23/elite");
    expect(changes1).toContain("web");
    expect(changes2).toEqual([]);
    expect(changes3).toEqual(["třída 1.1", "kategorie u11/u13/u15/kids/youth/u23/elite → u11/u13/u15/kids/youth/junior/u23/elite"]);
    expect(updateCalls).toBe(2);
    expect(row.public_revision).toBe(dbState.revision);
    expect(dbState.age_categories).toEqual(["u11", "u13", "u15", "kids", "youth", "junior", "u23", "elite"]);
    expect(dbState.uci_class).toBe("1.1");
  });

  it("still throws when an external writer changed the catalogue revision before enrich", async () => {
    const c = fixture("4fa9f103-5886-47e0-9ccd-a43ecebb4f5e") as UciDirectoryCompetition;
    const row: UciCatalogRow = {
      id: "event-1",
      slug: "gpwb-2027",
      name: "Grand Prix West Bohemia",
      start_date: "2027-05-01",
      end_date: "2027-05-02",
      visibility: "public",
      status: "scheduled",
      merged_into_id: null,
      level: "international",
      uci_class: null,
      website_url: null,
      registration_url: null,
      regulations_url: null,
      results_url: null,
      age_categories: ["youth"],
      age_confidence: "previous",
      audience: "youth",
      public_revision: "stale-rev",
      practical_details: null,
      disciplines: ["road"],
      location: { municipality: "Plzeň", country_code: "CZ" },
      sources: [],
      overrides: null,
    };
    await expect(enrichUciCatalogRow(row, { competition: c, event: uciDirectoryEvent(c)! }, {
      apply: true,
      async updateEvent() { throw Error("Catalogue changed while enriching the UCI competition"); },
      async insertSource() {},
      async saveWebsite() { return false; },
      async readRevision() { return "new-rev"; },
      async savePracticalDetails() { return { status: "saved" }; },
    })).rejects.toThrow("Catalogue changed while enriching the UCI competition");
  });
});

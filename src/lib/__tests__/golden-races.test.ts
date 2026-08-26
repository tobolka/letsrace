import { describe, expect, it } from "vitest";
import {
  canonicalEventDisciplines,
  eventDisciplineFamily,
  formatEventCategoryLabel,
  inferClassification,
  matchesAgeCategoryFilter,
  matchesDisciplineFilter,
} from "@/lib/taxonomy";
import { scoreDuplicate } from "@/lib/dedup";

describe("golden races — age categories", () => {
  it("Český pohár XCO covers kids through elite", () => {
    const c = inferClassification({
      name: "Český pohár XCO Ostrava",
      seriesName: "Český pohár MTB",
      disciplines: ["xco"],
    });
    expect(c.ageCategories).toEqual(
      expect.arrayContaining(["kids", "youth", "junior", "u23", "elite"]),
    );
    expect(matchesAgeCategoryFilter(c, ["kids"])).toBe(true);
  });

  it("UCI CX World Cup is junior–elite, not kids", () => {
    const c = inferClassification({
      name: "2026-2027 UCI Cyclo-cross World Cup #1, Ostrava",
      seriesName: "UCI Cyclo-cross World Cup",
      disciplines: ["cx"],
      existingLevel: "world_cup",
    });
    expect(c.ageCategories).toEqual(
      expect.arrayContaining(["junior", "u23", "elite"]),
    );
    expect(c.ageCategories).not.toContain("kids");
    expect(matchesAgeCategoryFilter(c, ["kids"])).toBe(false);
  });

  it("Kolo pro život is family (kids + adults)", () => {
    const c = inferClassification({
      name: "Manitou Železné hory",
      seriesName: "Kolo pro život",
      disciplines: ["xcm"],
    });
    expect(c.ageCategories).toEqual(
      expect.arrayContaining(["kids", "youth", "amateur", "masters"]),
    );
  });

  it("Talent Cup is kids-primary", () => {
    const c = inferClassification({
      name: "Talent Cup Blovice",
      seriesName: "Talent Cup",
      disciplines: ["xco"],
    });
    expect(c.ageCategories).toEqual(expect.arrayContaining(["kids", "youth"]));
    expect(c.audience).toBe("kids");
  });

  it("Ötztal Cycling Marathon is amateur/masters road", () => {
    const c = inferClassification({
      name: "Ötztal Cycling Marathon",
      disciplines: ["road"],
    });
    expect(c.ageCategories).toEqual(expect.arrayContaining(["amateur", "masters"]));
    expect(c.ageCategories).not.toContain("kids");
  });

  it("Sugar Gravel is amateur/masters", () => {
    const c = inferClassification({
      name: "Sugar Gravel",
      disciplines: ["gravel"],
    });
    expect(c.ageCategories).toEqual(["amateur", "masters"]);
  });

  it("Amstel Gold Race is junior–elite", () => {
    const c = inferClassification({
      name: "Amstel Gold Race",
      disciplines: ["road"],
    });
    expect(c.ageCategories).toEqual(
      expect.arrayContaining(["junior", "u23", "elite"]),
    );
  });

  it("UCI C2 cup is junior–elite", () => {
    const c = inferClassification({
      name: "JANEV CUP UCI C2",
      disciplines: ["xco"],
    });
    expect(c.ageCategories).toEqual(
      expect.arrayContaining(["junior", "u23", "elite"]),
    );
  });

  it("unnamed local MTB stays unknown (honest empty)", () => {
    const c = inferClassification({
      name: "Morkovské bajk",
      disciplines: ["xco"],
    });
    expect(c.ageCategories).toEqual([]);
    expect(formatEventCategoryLabel(c, { kids: "Kids", youth: "Youth", adults: "Adults" })).toBe(
      "",
    );
  });

  it("generic road GP is adult amateur, not unknown", () => {
    const c = inferClassification({
      name: "GP Lucien Van Impe",
      disciplines: ["road"],
    });
    expect(c.ageCategories).toEqual(expect.arrayContaining(["amateur", "masters"]));
    expect(c.ageCategories).not.toContain("kids");
    expect(c.audience).toBe("adults");
  });

  it("empty mixed never matches Kids filter", () => {
    expect(
      matchesAgeCategoryFilter({ audience: "mixed", ageCategories: [] }, ["kids"]),
    ).toBe(false);
  });

  it("Van Gillern Cup is family (kids + adults)", () => {
    const c = inferClassification({
      name: "Van Gillern Cup 2026",
      seriesName: "Van Gillern Cup",
      disciplines: ["xcm"],
    });
    expect(c.ageCategories).toEqual(
      expect.arrayContaining(["kids", "youth", "amateur", "masters"]),
    );
    expect(c.audience).toBe("mixed");
    expect(matchesAgeCategoryFilter(c, ["kids"])).toBe(true);
  });

  it("Konárovický kořen is family (kids + adults)", () => {
    const c = inferClassification({
      name: "Konárovický kořen 2026",
      seriesName: "Konárovický kořen",
      disciplines: ["xco"],
    });
    expect(c.ageCategories).toEqual(
      expect.arrayContaining(["kids", "youth", "amateur", "masters"]),
    );
    expect(c.audience).toBe("mixed");
    expect(matchesAgeCategoryFilter(c, ["kids"])).toBe(true);
  });
});

describe("golden races — discipline family + filter", () => {
  it("road + fake xcm from marathon is road, not MTB", () => {
    expect(canonicalEventDisciplines(["road", "xcm"])).toEqual(["road"]);
    expect(eventDisciplineFamily(["road", "xcm"])).toBe("road");
    expect(matchesDisciplineFilter(["road", "xcm"], ["mtb"])).toBe(false);
    expect(matchesDisciplineFilter(["road", "xcm"], ["road"])).toBe(true);
  });

  it("gravel + xcm is gravel, not MTB", () => {
    expect(matchesDisciplineFilter(["gravel", "xcm"], ["mtb"])).toBe(false);
    expect(matchesDisciplineFilter(["gravel", "xcm"], ["gravel"])).toBe(true);
  });

  it("road + dh keeps MTB family for filter", () => {
    expect(eventDisciplineFamily(["road", "dh"])).toBe("mtb");
    expect(matchesDisciplineFilter(["road", "dh"], ["mtb"])).toBe(true);
  });

  it("pure xco matches MTB", () => {
    expect(matchesDisciplineFilter(["xco"], ["mtb"])).toBe(true);
    expect(eventDisciplineFamily(["xco"])).toBe("mtb");
  });

  it("inferDisciplines does not tag radmarathon as xcm", () => {
    const c = inferClassification({
      name: "Ötztaler Radmarathon",
      disciplines: ["road"],
    });
    expect(c.disciplines).not.toContain("xcm");
    expect(c.disciplines).toContain("road");
  });
});

describe("golden races — dedup", () => {
  it("same day + place + similar name scores as duplicate", () => {
    const { score, reasons } = scoreDuplicate(
      {
        startDate: "2026-08-30",
        name: "Ötztal Cycling Marathon",
        lat: 46.97,
        lng: 11.01,
        placeText: "Sölden",
        urls: ["https://oetztaler.at"],
      },
      {
        startDate: "2026-08-30",
        name: "Ötztaler Radmarathon",
        lat: 46.97,
        lng: 11.01,
        placeText: "Sölden",
        urls: ["https://oetztaler.at/en"],
      },
    );
    expect(score).toBeGreaterThanOrEqual(50);
    expect(reasons).toEqual(expect.arrayContaining(["same_day"]));
  });

  it("kids series vs adult DH does not merge", () => {
    const { score } = scoreDuplicate(
      {
        startDate: "2026-06-14",
        name: "Kids Cup Semmering",
        seriesName: "Kids Cup",
        lat: 47.63,
        lng: 15.83,
        placeText: "Semmering",
      },
      {
        startDate: "2026-06-14",
        name: "iXS DHC #3 - Semmering",
        seriesName: "iXS Downhill Cup",
        lat: 47.63,
        lng: 15.83,
        placeText: "Semmering",
      },
    );
    expect(score).toBe(0);
  });

  it("Kamptal youngsters stay separate from MLA and Sportklasse", () => {
    const kids = {
      startDate: "2026-03-28",
      name: "KTM Kamptal Trophy — Youngsters",
      lat: 48.495,
      lng: 15.7,
      placeText: "Langenlois / Zöbing",
    };
    const liga = {
      startDate: "2026-03-29",
      name: "34. Internationale KTM Kamptal Trophy",
      seriesName: "Mountainbike Liga",
      lat: 48.495,
      lng: 15.7,
      placeText: "Langenlois / Zöbing",
    };
    const sportklasse = {
      startDate: "2026-03-29",
      name: "KTM Kamptal Trophy — Sportklasse",
      seriesName: "Sportklasse Cup",
      lat: 48.495,
      lng: 15.7,
      placeText: "Langenlois / Zöbing",
    };
    expect(scoreDuplicate(kids, liga).reasons).toContain("series_conflict");
    expect(scoreDuplicate(kids, sportklasse).reasons).toContain("series_conflict");
    expect(scoreDuplicate(liga, sportklasse).reasons).toContain("series_conflict");
  });

  it("XCO vs XCM same venue weekend does not merge", () => {
    const { score, reasons } = scoreDuplicate(
      {
        startDate: "2026-05-10",
        name: "Nova Pacov XCO",
        lat: 49.47,
        lng: 15.0,
        placeText: "Pacov",
      },
      {
        startDate: "2026-05-10",
        name: "Nova Pacov XCM",
        lat: 49.47,
        lng: 15.0,
        placeText: "Pacov",
      },
    );
    expect(score).toBe(0);
    expect(reasons).toContain("format_conflict");
  });

  it("Kolo pro život Ralsko sponsor title merges with short listing", () => {
    const { score, reasons } = scoreDuplicate(
      {
        startDate: "2026-09-26",
        name: "RALSKO MTB TOUR ŠKODA AUTO",
        lat: 50.61,
        lng: 14.8,
        placeText: "Ralsko",
        seriesName: "Kolo pro život",
      },
      {
        startDate: "2026-09-26",
        name: "Ralsko MTB Tour",
        lat: 50.61,
        lng: 14.8,
        placeText: "Ralsko",
        seriesName: "Kolo pro život",
      },
    );
    expect(score).toBeGreaterThanOrEqual(50);
    expect(reasons).toEqual(
      expect.arrayContaining(["same_day", "same_place"]),
    );
    expect(
      reasons.includes("same_canonical_name") ||
        reasons.includes("name_sim_mid") ||
        reasons.includes("name_sim_high"),
    ).toBe(true);
  });

  it("Kolo pro život Znojmo multi-day listing merges with Sunday mirror", () => {
    const { score, reasons } = scoreDuplicate(
      {
        startDate: "2026-09-05",
        endDate: "2026-09-06",
        name: "DIRECT ZNOJMO BURČÁK TOUR",
        lat: 48.83,
        lng: 16.06,
        placeText: "Znojmo",
        seriesName: "Kolo pro život",
      },
      {
        startDate: "2026-09-06",
        name: "ZNOJMO BURČÁK TOUR",
        lat: 48.83,
        lng: 16.06,
        placeText: "Znojmo",
        seriesName: "Kolo pro život",
      },
    );
    expect(score).toBeGreaterThanOrEqual(50);
    expect(reasons).toEqual(expect.arrayContaining(["same_place", "weekend"]));
  });
});

describe("golden races — display honesty", () => {
  it("formatEventCategoryLabel shows chips when ages known", () => {
    expect(
      formatEventCategoryLabel(
        { ageCategories: ["kids", "youth", "junior", "u23", "elite"] },
        { kids: "Kids", youth: "Youth", adults: "Adults" },
      ),
    ).toBe("Kids · Youth · Junior · U23 · Elite");
  });

  it("formatEventCategoryLabel is empty for unknown mixed", () => {
    expect(
      formatEventCategoryLabel(
        { audience: "mixed", ageCategories: [] },
        { kids: "Kids", youth: "Youth", adults: "Adults" },
      ),
    ).toBe("");
  });
});

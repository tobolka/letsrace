import { describe, expect, it } from "vitest";
import { ageCategoryMatch, ageMatchRank } from "@/lib/taxonomy";

describe("ageCategoryMatch", () => {
  it("rules a race out only on stated categories", () => {
    expect(ageCategoryMatch({ ageCategories: ["amateur", "masters"], ageConfidence: "explicit" }, ["kids"])).toBe("no");
    expect(ageCategoryMatch({ ageCategories: ["u11", "kids"], ageConfidence: "explicit" }, ["kids"])).toBe("match");
  });

  it("keeps a race we know nothing about, as unconfirmed", () => {
    expect(ageCategoryMatch({ ageCategories: [], ageConfidence: null }, ["kids"])).toBe("possible");
    expect(ageCategoryMatch({ ageCategories: null }, ["masters"])).toBe("possible");
  });

  it("never lets a guess rule a race out", () => {
    expect(ageCategoryMatch({ ageCategories: ["amateur", "masters"], ageConfidence: "default" }, ["masters"])).toBe("possible");
    expect(ageCategoryMatch({ ageCategories: ["amateur", "masters"], ageConfidence: "default" }, ["kids"])).toBe("possible");
  });

  it("ranks confirmed, then fitting guesses, then unknown, then other guesses", () => {
    const sel = ["kids"];
    expect(ageMatchRank({ ageCategories: ["u11"], ageConfidence: "explicit" }, sel)).toBe(0);
    expect(ageMatchRank({ ageCategories: ["kids"], ageConfidence: "default" }, sel)).toBe(1);
    expect(ageMatchRank({ ageCategories: [], ageConfidence: null }, sel)).toBe(2);
    expect(ageMatchRank({ ageCategories: ["amateur"], ageConfidence: "default" }, sel)).toBe(3);
  });

  it("expands a group chip to its bands", () => {
    expect(ageCategoryMatch({ ageCategories: ["u9"], ageConfidence: "explicit" }, ["kids"])).toBe("match");
  });

  it("matches everything when no category is selected", () => {
    expect(ageCategoryMatch({ ageCategories: [], ageConfidence: null }, [])).toBe("match");
  });
});

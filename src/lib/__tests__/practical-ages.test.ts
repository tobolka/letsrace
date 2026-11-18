import { describe, expect, it } from "vitest";
import { regulationAgePatch, regulationAges } from "@/lib/catalog/practical-ages";

const list = (key: "categories" | "fees" | "schedule", labels: string[], editionYear = 2026) => ({
  [key]: { status: "current", editionYear, value: labels.map((label) => ({ label, sourceUrl: "https://example.org/propozice.pdf" })) },
});

describe("age classes from the regulations", () => {
  it("drops guessed children when the youth ladder starts at U13 (NoLimited cup)", () => {
    const read = regulationAges(list("schedule", ["Masters A, B, C + women Masters", "U13 men + U15 women", "U15 men + U17 women", "U17 men + Women Juniors", "Men Juniors", "Women elite", "Men Elite (+ U23)"]), 2026);
    const patch = regulationAgePatch({ age_categories: ["kids", "youth", "junior", "u23", "elite"], age_confidence: "default" }, read);
    expect(patch?.age_categories).toEqual(["u13", "u15", "u17", "youth", "junior", "u23", "elite", "masters"]);
    expect(patch?.age_confidence).toBe("explicit");
  });

  it("keeps the elite a youth-only list does not mention, and does not confirm it", () => {
    const read = regulationAges(list("categories", ["Junioři a Juniorky U19/WU19", "Kadeti a Kadetky U17/WU17", "Žáci st. U15", "Žáci ml. U13"]), 2026);
    const patch = regulationAgePatch({ age_categories: ["kids", "youth", "junior", "u23", "elite"], age_confidence: "default" }, read);
    expect(patch?.age_categories).toEqual(["u13", "u15", "u17", "youth", "junior", "u23", "elite"]);
    expect(patch?.age_confidence).toBe("default");
  });

  it("keeps the adults of a marathon whose fees are priced by course", () => {
    const read = regulationAges({ ...list("categories", ["Mladší žiaci", "Starší žiaci"], 2027), ...list("fees", ["90 km MTB", "30 km MTB"], 2027) }, 2027);
    expect(read?.byCourse).toBe(true);
    const patch = regulationAgePatch({ age_categories: ["kids", "amateur", "masters"], age_confidence: "default" }, read);
    expect(patch?.age_categories).toEqual(["u13", "u15", "kids", "youth", "amateur", "masters"]);
  });

  it("keeps guessed open classes beside a list of licensed ones", () => {
    const ladder = regulationAges(list("categories", ["Junioři", "Muži Elite", "Ženy Elite"]), 2026);
    expect(regulationAgePatch({ age_categories: ["junior", "elite", "amateur"], age_confidence: "default" }, ladder)).toBeNull();
  });

  it("never narrows a set another source confirmed, but corrects its own earlier write", () => {
    const read = regulationAges(list("categories", ["Junioři", "Muži Elite"]), 2026);
    const confirmed = { age_categories: ["kids", "junior", "elite", "amateur"], age_confidence: "explicit" };
    expect(regulationAgePatch(confirmed, read)).toBeNull();
    // Its own write is open to correction, though here nothing it may drop is ruled out.
    expect(regulationAgePatch(confirmed, read, true)?.age_confidence).toBe("default");
  });

  it("places a class by its name before the birth years read beside it (Janev Cup)", () => {
    const details = { categories: { status: "current", editionYear: 2026, value: [
      { label: "MUŽI", birthYears: "2008" }, { label: "JUNIOŘI", birthYears: "2009-2010" }, { label: "KADETI", birthYears: "2011-2012" },
      { label: "STARŠÍ ŽÁCI", birthYears: "2013-2014" }, { label: "MLADŠÍ ŽÁCI", birthYears: "2015-2017" }] } };
    const read = regulationAges(details, 2026);
    expect(read?.ages).toEqual(["u13", "u15", "u17", "youth", "junior", "elite"].concat([]));
    expect(regulationAgePatch({ age_categories: ["kids", "youth", "junior", "u23", "elite"], age_confidence: "default" }, read)?.age_categories)
      .toEqual(["u13", "u15", "u17", "youth", "junior", "u23", "elite"]);
  });

  it("ignores another edition's regulations", () => {
    expect(regulationAges(list("categories", ["Junioři", "Muži Elite"], 2025), 2026)).toBeNull();
  });
});

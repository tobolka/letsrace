import { expect, it } from "vitest";
import { bandsFromLines, candidateLines, editionDocs, statable } from "@/lib/catalog/dossier-classes";
import { htmlText } from "@/lib/catalog/regulation-ages";
import type { DossierDoc } from "@/lib/catalog/dossier";

const doc = (patch: Partial<DossierDoc>): DossierDoc => ({ url: "https://organiser.example/race", kind: "site", text: "Race 24.10.2026", thisEdition: true, classLines: 0, thin: false, ...patch });

it("reads RaceResult's admission page while rejecting the results tab", () => {
  const registration = doc({ url: "https://my.raceresult.com/419021/", text: "LAKE.BIKE 10.10.2026\nU13\nU15" });
  expect(editionDocs([registration], "2026-10-10", ["LAKE.BIKE"])).toEqual([registration]);
  expect(editionDocs([{ ...registration, url: "https://my.raceresult.com/419021/results" }], "2026-10-10", ["LAKE.BIKE"])).toEqual([]);
});

it("inherits edition identity for a directly linked class table, not an old rulebook", () => {
  const parent = doc({ text: "Podzimní Bahno 24.10.2026" });
  const table = doc({ url: "https://organiser.example/propozice-2026-mtb/", kind: "linked", text: "kluci | do 8 let | 2018 a mladší\n9-10 let | 2017-2016", thisEdition: false, linkedFromEdition: true });
  expect(editionDocs([parent, table], "2026-10-24", ["Podzimní Bahno"])).toContain(table);
  const old = { ...table, url: "https://organiser.example/propozice-2025-mtb/", text: "Propozice 2025\nkluci do 8 let" };
  expect(editionDocs([parent, old], "2026-10-24", ["Podzimní Bahno"])).not.toContain(old);
});

it("keeps all gender-prefixed U classes and every enumerated adult class", () => {
  expect(bandsFromLines([{ line: "MU13, WU15, MU17; Junioren m/w; U23/ELITE; Amateure und Masters" }], "2026-10-10").ages)
    .toEqual(["u13", "u15", "u17", "youth", "junior", "u23", "elite", "amateur", "masters"]);
});

it("does not require two classes when the complete programme contains one", () => {
  const found = { ages: ["amateur" as const], lines: [{ line: "Jedermann", url: "https://organiser.example/entry" }] };
  expect(statable({ name: "Race" }, found)).toBe(false);
  expect(statable({ name: "Race" }, { ...found, complete: true })).toBe(true);
  expect(candidateLines([doc({ text: "Herren", classLines: 0 })])).toHaveLength(1);
});

it("preserves table column boundaries for cohort extraction", () => {
  const text = htmlText("<table><tr><td>U15</td><td>2012-2013</td></tr></table>");
  expect(text).toContain("U15 | 2012-2013");
});

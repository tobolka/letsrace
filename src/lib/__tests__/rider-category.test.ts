import { describe, expect, it } from "vitest";
import { categoryGender, feeForCategory, matchRiderCategories, parseBirthYears, riderFactsFromStored } from "@/lib/rider-category";

const REF = 2027;

describe("parseBirthYears", () => {
  it.each([
    ["2019-2020", { from: 2019, to: 2020 }],
    ["2019–2020", { from: 2019, to: 2020 }],
    ["2020-2019", { from: 2019, to: 2020 }],
    ["1978 - 1987", { from: 1978, to: 1987 }],
    ["2013/2014", { from: 2013, to: 2014 }],
    ["2017 t/m 2019", { from: 2017, to: 2019 }],
    ["ročníky 1997 – 1988", { from: 1988, to: 1997 }],
    ["2010", { from: 2010, to: 2010 }],
    ["2008 a starší", { from: null, to: 2008 }],
    ["ročníky 1967 a st.", { from: null, to: 1967 }],
    ["<= 2008", { from: null, to: 2008 }],
    ["2018 a mladší", { from: 2018, to: null }],
    ["ročníky 1998 a ml.", { from: 1998, to: null }],
    ["2010 i młodsi", { from: 2010, to: null }],
    ["2008 und älter", { from: null, to: 2008 }],
  ])("%s", (text, expected) => {
    expect(parseBirthYears(text, REF)).toEqual(expected);
  });

  it("reads ages against the race year", () => {
    expect(parseBirthYears("40-49 Jahre", REF)).toEqual({ from: 1978, to: 1987 });
    expect(parseBirthYears("50-59", REF)).toEqual({ from: 1968, to: 1977 });
    expect(parseBirthYears("30/34 anni", REF)).toEqual({ from: 1993, to: 1997 });
    expect(parseBirthYears("od 50 do 59 lat", REF)).toEqual({ from: 1968, to: 1977 });
    expect(parseBirthYears("do 15 lat", REF)).toEqual({ from: 2012, to: null });
    expect(parseBirthYears("60 a více let", REF)).toEqual({ from: null, to: 1967 });
    expect(parseBirthYears("51 let a více", REF)).toEqual({ from: null, to: 1976 });
    expect(parseBirthYears("dai 19 anni e più", REF)).toEqual({ from: null, to: 2008 });
    expect(parseBirthYears("powyżej 59 lat", REF)).toEqual({ from: null, to: 1967 });
  });

  it("reads a UCI under-group from a name", () => {
    expect(parseBirthYears("Schüler U11", REF, { label: true })).toEqual({ from: 2017, to: 2018 });
    expect(parseBirthYears("Junior Men U-19, Junior Women U-19", REF, { label: true })).toEqual({ from: 2009, to: 2010 });
  });

  it("leaves what it cannot read with confidence", () => {
    expect(parseBirthYears("2011, 2012, 2013", REF)).toBeNull();
    expect(parseBirthYears("U13/WU15", REF, { label: true })).toBeNull();
    expect(parseBirthYears("4.16 Schüler U13", REF, { label: true })).toBeNull();
    expect(parseBirthYears("muži 40", REF, { label: true })).toBeNull();
    expect(parseBirthYears("holky 7-8", REF, { label: true })).toBeNull();
    expect(parseBirthYears("Cup 2027 Elite", REF, { label: true })).toBeNull();
    expect(parseBirthYears("Elite", REF)).toBeNull();
    expect(parseBirthYears("DM60 - 60let a starší", REF, { label: true })).toEqual({ from: null, to: 1967 });
  });
});

// The Golf Open Bike Race list, as read from its regulations.
const golf = {
  startDate: "2027-05-15",
  disciplines: ["mtb"],
  categories: [
    { label: "holky 5-6", birthYears: "2021-2022" },
    { label: "kluci 5-6", birthYears: "2021-2022" },
    { label: "holky 7-8", birthYears: "2019-2020" },
    { label: "kluci 7-8", birthYears: "2019-2020" },
    { label: "žákyně I", birthYears: "2015-2016" },
    { label: "ženy", birthYears: "<= 2008" },
    { label: "muži", birthYears: "1988-2008" },
    { label: "muži 40", birthYears: "1978-1987" },
    { label: "muži 50", birthYears: "<= 1977" },
  ],
  fees: [
    { label: "holky 5-6", amount: 200, currency: "CZK" },
    { label: "kluci 5-6", amount: 200, currency: "CZK" },
    { label: "holky 7-8", amount: 200, currency: "CZK" },
    { label: "kluci 7-8", amount: 200, currency: "CZK" },
    { label: "žákyně I", amount: 300, currency: "CZK" },
    { label: "ženy", amount: 350, currency: "CZK" },
  ],
};

describe("matchRiderCategories", () => {
  it("shows every category the year fits, girls' and boys' alike, with its own fee", () => {
    expect(matchRiderCategories(2019, golf, { today: "2027-01-01" })).toEqual([
      { label: "holky 7-8", birthYears: "2019-2020", fee: { amount: 200, currency: "CZK" } },
      { label: "kluci 7-8", birthYears: "2019-2020", fee: { amount: 200, currency: "CZK" } },
    ]);
  });

  it("shows no fee the list does not name", () => {
    expect(matchRiderCategories(1982, golf, { today: "2027-01-01" })).toEqual([
      { label: "ženy", birthYears: "<= 2008", fee: { amount: 350, currency: "CZK" } },
      { label: "muži 40", birthYears: "1978-1987" },
    ]);
  });

  it("shows nothing for a rider who fits no category", () => {
    expect(matchRiderCategories(2017, golf, { today: "2027-01-01" })).toEqual([]);
    expect(matchRiderCategories(2025, golf, { today: "2027-01-01" })).toEqual([]);
  });

  it("falls back to the race's age groups only when the regulations give no ages", () => {
    const race = { startDate: "2027-06-01", disciplines: ["road"], categories: [{ label: "Elite" }], ageCategories: ["u9", "u11", "junior"], ageConfidence: "explicit" as const };
    expect(matchRiderCategories(2019, race)).toEqual([{ label: "u9", taxonomyId: "u9" }]);
    expect(matchRiderCategories(2019, { ...race, ageConfidence: "previous" })).toEqual([{ label: "u9", taxonomyId: "u9", asLastYear: true }]);
    expect(matchRiderCategories(2019, { ...race, ageConfidence: "default" })).toEqual([]);
    // A cyclocross winter counts by its second year.
    expect(matchRiderCategories(2019, { ...race, startDate: "2026-11-21", disciplines: ["cx"] })).toEqual([{ label: "u9", taxonomyId: "u9" }]);
  });
});

describe("feeForCategory", () => {
  const today = "2027-03-01";
  it("matches a fee row that names the category inside a longer name", () => {
    expect(feeForCategory("Elite", [{ label: "Startgeld Elite", amount: 30, currency: "EUR" }], ["Elite", "U19"], today)).toEqual({ amount: 30, currency: "EUR" });
  });
  it("does not take the fee of a longer category's name", () => {
    expect(feeForCategory("muži", [{ label: "muži 40", amount: 300, currency: "CZK" }], ["muži", "muži 40"], today)).toBeUndefined();
  });
  it("does not take a fee row shared by two categories as one's own", () => {
    expect(feeForCategory("holky 7-8", [{ label: "holky 7-8 a kluci 7-8", amount: 200, currency: "CZK" }], ["holky 7-8", "kluci 7-8"], today)).toBeUndefined();
  });
  it("drops expired early prices and spans the rest", () => {
    const fees = [
      { label: "Junioři", amount: 250, currency: "CZK", validUntil: "2027-02-01" },
      { label: "Junioři", amount: 300, currency: "CZK", validUntil: "2027-05-01" },
      { label: "Junioři", amount: 400, currency: "CZK" },
    ];
    expect(feeForCategory("junioři", fees, ["Junioři"], today)).toEqual({ amount: 300, maxAmount: 400, currency: "CZK" });
  });
});

describe("riderFactsFromStored", () => {
  it("keeps only this edition's lists", () => {
    const stored = {
      categories: { editionYear: 2027, value: [{ label: "holky 7-8", birthYears: "2019-2020", sourceQuote: "x" }] },
      fees: { editionYear: 2026, value: [{ label: "holky 7-8", amount: 150, currency: "CZK" }] },
    };
    expect(riderFactsFromStored(stored, "2027-05-15")).toEqual({ categories: [{ label: "holky 7-8", birthYears: "2019-2020" }] });
    expect(riderFactsFromStored(null, "2027-05-15")).toEqual({});
  });
});

describe("categoryGender", () => {
  it.each([
    ["holky 7-8", "female"], ["kluci 7-8", "male"], ["dívky", "female"], ["chlapci", "male"],
    ["ženy", "female"], ["muži 40", "male"], ["žákyně I", "female"], ["žáci II", "male"],
    ["kadetky", "female"], ["junioři", "male"], ["Girls U9", "female"], ["Boys U9", "male"],
    ["Schülerinnen U11", "female"], ["Schüler U11", "male"], ["Jugend weiblich U17", "female"], ["Jugend männlich U17", "male"],
    ["WU15", "female"], ["Elita Kobiet", "female"], ["M5", "male"],
    ["kadeti, kadetky", "mixed"], ["Masters Men / Women", "mixed"], ["OPEN M/F", "mixed"], ["4er-Team (Damen, Herren, Mixed)", "mixed"],
    ["Děti", null], ["Elite", null], ["U13", null],
  ])("%s", (label, expected) => {
    expect(categoryGender(label)).toBe(expected);
  });
});

describe("matchRiderCategories with a gender", () => {
  const opts = { today: "2027-01-01" };
  it("shows only the girls' category for a girl and the boys' for a boy", () => {
    expect(matchRiderCategories(2019, golf, { ...opts, gender: "female" }).map((m) => m.label)).toEqual(["holky 7-8"]);
    expect(matchRiderCategories(2019, golf, { ...opts, gender: "male" }).map((m) => m.label)).toEqual(["kluci 7-8"]);
    expect(matchRiderCategories(1982, golf, { ...opts, gender: "male" }).map((m) => m.label)).toEqual(["muži 40"]);
  });
  it("shows every match when the gender is not given", () => {
    expect(matchRiderCategories(2019, golf, { ...opts, gender: null }).map((m) => m.label)).toEqual(["holky 7-8", "kluci 7-8"]);
  });
  it("keeps mixed and unnamed categories", () => {
    const race = {
      startDate: "2027-05-15",
      disciplines: ["mtb"],
      categories: [
        { label: "Děti", birthYears: "2018-2020" },
        { label: "kadeti, kadetky", birthYears: "2018-2020" },
        { label: "kluci", birthYears: "2018-2020" },
      ],
    };
    expect(matchRiderCategories(2019, race, { ...opts, gender: "female" }).map((m) => m.label)).toEqual(["Děti", "kadeti, kadetky"]);
  });
});

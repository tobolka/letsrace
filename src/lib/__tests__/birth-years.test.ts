import { describe, expect, it } from "vitest";
import { birthYears, referenceYear, typicalAgeRange } from "@/lib/birth-years";
import { ageCategoryHelp } from "@/lib/i18n/taxonomy";

describe("birth years", () => {
  it("counts racing age as race year minus birth year", () => {
    expect(birthYears("u11", "2027-05-10", ["xco"], "cs")).toBe("2017–2018");
    expect(birthYears("junior", "2027-05-10", ["road"], "cs")).toBe("2009–2010");
  });

  it("counts an autumn cyclocross race by the season's second year", () => {
    expect(referenceYear("2026-11-07", ["cx"])).toBe(2027);
    expect(referenceYear("2027-01-10", ["cx"])).toBe(2027);
    expect(referenceYear("2026-11-07", ["road"])).toBe(2026);
    expect(birthYears("u9", "2026-11-07", ["cx"], "cs")).toBe("2019–2020");
  });

  it("says open ends in words and gives nothing for categories without ages", () => {
    expect(birthYears("u7", "2027-05-10", [], "cs")).toBe("2021 a mladší");
    expect(birthYears("masters", "2027-05-10", [], "en")).toBe("1992 and earlier");
    expect(birthYears("amateur", "2027-05-10", [], "cs")).toBeNull();
  });

  it("gives schema.org's age range, open for adult categories", () => {
    expect(typicalAgeRange(["u9", "u11"])).toBe("7-10");
    expect(typicalAgeRange(["junior", "elite"])).toBeNull();
    expect(typicalAgeRange(["u11", "amateur"])).toBeNull();
  });
  it("never turns an Elite label into an age restriction or birth year", () => {
    expect(birthYears("elite", "2027-07-09", ["mtb", "four_cross"], "cs")).toBeNull();
    expect(typicalAgeRange(["elite"])).toBeNull();
    expect(ageCategoryHelp("elite", "cs")).toBe("Věkové podmínky podle propozic závodu");
  });
});

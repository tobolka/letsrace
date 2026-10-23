import { describe, expect, it } from "vitest";
import { verifyRaces } from "@/lib/watcher/extractors/llm-calendar";
const url = "https://club.test/calendar";
const verify = (raw: Parameters<typeof verifyRaces>[0], text: string) => verifyRaces(raw, text, new Set(), url, "2026-01-01");

describe("calendar evidence belongs to one row", () => {
  it("rejects a race name borrowed from a different row", () => {
    expect(verify([{ name: "Perlcross", start_date: "2026-10-11", quote: "11.10.2026 Anothercross" }], "11.10.2026 Anothercross\n12.10.2026 Perlcross")).toEqual([]);
  });
  it("checks the whole date, including month and year", () => {
    for (const date of ["2026-11-11", "2027-10-11", "2026-02-31"]) {
      expect(verify([{ name: "Perlcross", start_date: date, quote: "11.10.2026 Perlcross" }], "11.10.2026 Perlcross")).toEqual([]);
    }
  });
  it("keeps the race but does not borrow another race's classes, place or discipline", () => {
    const quote = "11.10.2026 Perlcross Perl CX";
    const [race] = verify([{ name: "Perlcross", start_date: "2026-10-11", quote, place: "Berlin", categories: ["U11", "U13"], disciplines: ["cx", "road"] }], `${quote}\n12.10.2026 Roadrace Berlin U11 U13 road`);
    expect(race?.placeText).toBe("");
    expect(race?.ageCategories).toBeUndefined();
    expect(race?.discipline).toEqual(["cx"]);
  });
  it("retains a valid range and season heading", () => {
    const quote = "10.–11.10.2026 Perlcross Perl";
    expect(verify([{ name: "Perlcross", start_date: "2026-10-10", end_date: "2026-10-11", quote, place: "Perl" }], quote)[0]?.endDate).toBe("2026-10-11");
    expect(verify([{ name: "Perlcross", start_date: "2026-10-11", quote: "11.10. Perlcross" }], "Season 2026\n11.10. Perlcross")).toHaveLength(1);
  });
});

it("does not treat a generic season heading as a race series", () => {
  const quote = "14.11.2026 BL Cyclo Cross Stahnsdorf";
  const [race] = verify([{name:"BL Cyclo Cross Stahnsdorf", start_date:"2026-11-14", quote, series_name:"Termine 2026",series_quote:"Termine 2026"}], `Termine 2026\n${quote}`);
  expect(race?.seriesName).toBeUndefined();
  expect(race?.name).toBe("BL Cyclo Cross Stahnsdorf");
});

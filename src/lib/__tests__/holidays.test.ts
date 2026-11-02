import { afterEach, describe, expect, it, vi } from "vitest";
import { raceHolidays } from "@/lib/holidays";

const CZ_2027 = [
  { date: "2027-03-26", localName: "Velký pátek", name: "Good Friday", global: true },
  { date: "2027-09-28", localName: "Den české státnosti", name: "St. Wenceslas Day", global: true },
  { date: "2027-06-01", localName: "Regionální", name: "Regional", global: false },
];

afterEach(() => vi.unstubAllGlobals());
const stub = () => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(CZ_2027), { status: 200 })));

describe("raceHolidays", () => {
  it("names a public holiday on race day in the country's language", async () => {
    stub();
    expect(await raceHolidays({ startDate: "2027-09-28", endDate: null, countryCode: "CZ" }, "cs")).toEqual(["Státní svátek – Den české státnosti"]);
    expect(await raceHolidays({ startDate: "2027-09-28", endDate: null, countryCode: "CZ" }, "en")).toEqual(["Public holiday – St. Wenceslas Day"]);
  });

  it("spots a long weekend from a holiday on Friday", async () => {
    stub();
    const lines = await raceHolidays({ startDate: "2027-03-27", endDate: "2027-03-28", countryCode: "CZ" }, "cs");
    expect(lines[0]).toMatch(/^Prodloužený víkend – Velký pátek \(pátek\)$/);
  });

  it("marks Czech summer holidays and ignores regional and ordinary days", async () => {
    stub();
    expect(await raceHolidays({ startDate: "2027-07-17", endDate: null, countryCode: "CZ" }, "cs")).toEqual(["Letní školní prázdniny"]);
    expect(await raceHolidays({ startDate: "2027-06-01", endDate: null, countryCode: "CZ" }, "cs")).toEqual([]);
  });
});

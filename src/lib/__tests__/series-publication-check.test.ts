import { describe, expect, it } from "vitest";
import { verifyPublicSeries } from "@/lib/pipeline/series-publication-check";
import { compactRaceDates } from "@/lib/i18n/dates";
import { eventPagePath } from "@/lib/event-url";

const race = { name: "Race", slug: "race", startDate: "2027-06-03", endDate: "2027-06-05", location: { municipality: "Brno", countryCode: "CZ" } };
const series = { series: { name: "Cup", slug: "cup", description: "Ročník 2027" }, events: [race] } as NonNullable<Parameters<typeof verifyPublicSeries>[2]>;
const page = `<article><div class="browse-intro"><h1 data-page-title>Cup</h1><p>Ročník 2027</p></div></article>
  <div hidden><a class="race-row-link" data-series-round="cup" href="${eventPagePath("cs", "race")}"><span class="race-row-name">Race</span>
  </a></div><div hidden><span class="race-row-meta" data-series-race="race"><time datetime="2027-06-03">${compactRaceDates(race, "cs")}</time><span class="race-row-place">Brno · CZ · XCO</span></span></div>`;

describe("series publication", () => {
  it("checks actual round content in the series article", () => {
    expect(() => verifyPublicSeries(page, 200, series, "cs")).not.toThrow();
    expect(() => verifyPublicSeries(page.replace("Ročník 2027", "Starý popis"), 200, series, "cs")).toThrow("description");
    expect(() => verifyPublicSeries(page.replace("2027-06-03", "2027-06-02"), 200, series, "cs")).toThrow("round does not match");
    expect(() => verifyPublicSeries(page.replace(compactRaceDates(race, "cs"), "3 čvn"), 200, series, "cs")).toThrow("round does not match");
    expect(() => verifyPublicSeries(page.replace("Brno · CZ", "Jihlava · CZ"), 200, series, "cs")).toThrow("round does not match");
  });
  it("does not use unrelated links or hidden responses as proof", () => {
    expect(() => verifyPublicSeries(page.replace('data-series-round="cup"', 'data-series-round="another"'), 200, series, "cs")).toThrow("round count");
    expect(() => verifyPublicSeries(page, 200, null, "cs")).toThrow("still publicly available");
    expect(() => verifyPublicSeries("", 404, null, "cs")).not.toThrow();
  });
});

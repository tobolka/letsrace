import { describe, expect, it } from "vitest";
import { countryCompletionTargets, missingCompletionFields, missingCatalogFields } from "@/lib/catalog/completeness";
const race = { website_url: "https://perlcross.de", regulations_url: "https://perlcross.de/rules.pdf", disciplines: ["cx"], age_categories: ["kids", "amateur"], age_confidence: "explicit", location: { lat: 49, lng: 6, country_code: "DE" } };
describe("90 percent completion goal", () => {
  it("requires source-backed categories and tracks optional propositions separately", () => {
    expect(missingCompletionFields(race)).toEqual([]);
    expect(missingCompletionFields({ ...race, age_confidence: "default" })).toEqual(["categories"]);
    expect(missingCompletionFields({ ...race, regulations_url: null })).toEqual([]);
    expect(missingCatalogFields({ ...race, regulations_url: null })).toEqual(["regulations"]);
  });
  it("measures every country independently and rounds the 90 percent target up", () => {
    const rows = [race, ...Array.from({ length: 10 }, () => ({ ...race, age_confidence: "default" }))];
    expect(countryCompletionTargets(rows, ["DE"])[0]).toMatchObject({ total: 11, complete: 1, target: 10, remaining: 9 });
  });
});

import { describe, expect, it } from "vitest";
import { parseEventinKids } from "@/lib/watcher/extractors/eventin-kids";
import { ageCategoriesFromList } from "@/lib/age-bands";

const url = "https://ketterechts.eu/etn/tour/";
const page = (date = "10. Oktober 2026", paragraph = "Kinder von 2 bis 6 Jahren starten mit dem Laufrad, Kinder von 7 bis 10 Jahren mit dem Fahrrad.") => `
<ul><li><span>Datum:</span>${date}</li><li><span>Ort:</span>Sellin/Rügen</li></ul>
<div id="strecken"><div class="e-con"><h2>Fette Reifen RügenChallenge – für unsere jüngsten Radhelden</h2><p>${paragraph}</p><img alt="Poster"></div></div>
<section><h3>Related adult race</h3>11. Oktober 2026, Masters 40+ Jahre</section>`;

describe("children's races embedded in Eventin ride pages", () => {
  it("creates a separate children's race with local admission ages, not the related adult date/categories", () => {
    const [e] = parseEventinKids(url, page());
    expect(e).toMatchObject({ name: "Fette Reifen RügenChallenge", startDate: "2026-10-10", placeText: "Sellin/Rügen", audience: "kids", eventType: "race", websiteUrl: `${url}#strecken` });
    expect(e.ageCategories).toEqual(["u7", "u9", "u11", "kids"]);
    expect(e.registrationUrl).toBeUndefined();
  });
  it("does not assume a children's race has the parent's date when its own paragraph contradicts it", () => {
    expect(parseEventinKids(url, page(undefined, "Am 11. Oktober 2026: Kinder von 2 bis 6 Jahren mit dem Laufrad."))).toEqual([]);
  });
  it("requires a valid labelled date, venue and local admission evidence", () => {
    expect(parseEventinKids(url, page("31. Februar 2026"))).toEqual([]);
    expect(parseEventinKids(url, page().replace("Ort:", "Other:"))).toEqual([]);
    expect(parseEventinKids(url, page(undefined, "Bilder der Kinder vom letzten Jahr."))).toEqual([]);
  });
  it("does not inherit age ranges from a neighboring section sharing a large container", () => {
    expect(parseEventinKids(url, page().replace('<p>', '<h3>Other category programme</h3><p>'))).toEqual([]);
  });
  it("reads written German age ranges in the shared parser too", () => {
    expect(ageCategoriesFromList([{ name: "Kinder von 7 bis 10 Jahren" }], { refYear: 2026 })).toEqual(["u9", "u11", "kids"]);
  });
});

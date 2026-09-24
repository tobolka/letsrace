import { describe, expect, it } from "vitest";
import { parseUciCxWorldCup } from "@/lib/watcher/extractors/road-cx-gravel";

describe("UCI Cyclo-cross World Cup age categories", () => {
  it("keeps youth support races out of elite-only World Cup rounds", () => {
    const html = `
      <div class="competition-block">
        <div class="competition-block-location"><h2>Glasgow</h2><img class="flag" alt="Scotland"></div>
        <span class="competition-block-date">13/12/26</span>
      </div>
      <div class="competition-block">
        <div class="competition-block-location"><h2>Tábor</h2><img class="flag" alt="Czech Republic"></div>
        <span class="competition-block-date">29/11/26</span>
      </div>`;
    const events = parseUciCxWorldCup("https://www.ucicyclocrossworldcup.com/en", html);
    expect(events.find((event) => event.startDate === "2026-12-13")?.ageCategories).toEqual(["elite"]);
    expect(events.find((event) => event.startDate === "2026-11-29")?.ageCategories).toEqual(["junior", "u23", "elite"]);
  });
});

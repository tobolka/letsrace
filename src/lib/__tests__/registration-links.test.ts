import { describe, expect, it } from "vitest";
import { findEntryLink } from "@/lib/catalog/registration-links";

// tbcserie.cz: one "REGISTRACE 2026" button, the season's points sign-up.
const seriesHome = `
  <div class="hero"><p>TBC série 2026</p>
    <a href="https://maraton.cz/terminovka/entry/300" class="btn">REGISTRACE 2026</a>
  </div>`;

describe("findEntryLink", () => {
  it("takes a lone entry button on a race's own page", () => {
    expect(findEntryLink(seriesHome, "https://tbcserie.cz/", ["tabor"], "2026")).toBe(
      "https://maraton.cz/terminovka/entry/300",
    );
  });

  it("leaves a page several races share unless the link sits beside this race", () => {
    expect(
      findEntryLink(seriesHome, "https://tbcserie.cz/", ["tabor", "1. 11."], "2026", { shared: true }),
    ).toBeNull();
    const calendar = `<ul><li><span>Tábor 1. 11.</span>
      <a href="https://maraton.cz/terminovka/entry/705">přihláška</a></li></ul>`;
    expect(
      findEntryLink(calendar, "https://tbcserie.cz/", ["tabor", "1. 11."], "2026", { shared: true }),
    ).toBe("https://maraton.cz/terminovka/entry/705");
  });
});

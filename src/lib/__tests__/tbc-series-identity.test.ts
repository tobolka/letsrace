import { describe, expect, it } from "vitest";
import { canonicalizeSeries, parseHynekMusil } from "@/lib/watcher/extractors/hynek";
import { parseMaratonTbcRows } from "@/lib/watcher/extractors/tbcserie";

// Hynek's list page labels the cyclocross series "TBC SÉRIE"; the official
// calendar files it as tbc-cyclocross. One series, one slug.
describe("TBC série identity", () => {
  it("maps Hynek's label onto the official series slug", () => {
    expect(canonicalizeSeries("TBC SÉRIE")).toEqual({
      name: "TBC série cyklokros",
      slug: "tbc-cyclocross",
    });
    expect(canonicalizeSeries("3. TBC série")?.slug).toBe("tbc-cyclocross");
  });

  it("files a Hynek calendar row under tbc-cyclocross", () => {
    const html = `
      <div>Dnes je pondělí, 7.9.2026, svátek má Regína</div>
      <table>
        <tr>
          <td><a href='https://tbcserie.cz/'><img alt='TBC SÉRIE'></a></td>
          <td>TBC SÉRIE</td><td>neděle</td><td>15.11.</td>
          <td>Prachatice <br> cyklokros</td><td></td>
        </tr>
      </table>`;
    const events = parseHynekMusil("https://hynekmusil.cz/", html);
    expect(events.map((e) => e.seriesSlug)).toEqual(["tbc-cyclocross"]);
  });

  it("skips the season points-registration row on maraton.cz", () => {
    const html = `<table>
      <tr><td>20.9.2026</td><td>ne</td><td>TBC</td><td>TBC série 2026 - přihláška do bodování v seriálu - přihláška</td><td><a href="https://tbcserie.cz/">web</a></td></tr>
      <tr><td>20.9.2026</td><td>ne</td><td>Bernartice</td><td>Bernartický cyklokros- přihláška (TBC série)</td><td><a href="https://tbcserie.cz/">web</a></td></tr>
    </table>`;
    const events = parseMaratonTbcRows(html, "https://maraton.cz/terminovka");
    expect(events.map((e) => e.name)).toEqual(["TBC — Bernartický cyklokros"]);
  });
});

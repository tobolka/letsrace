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

  it("uses one World Cup series for the Hynek homepage and series page", () => {
    expect(canonicalizeSeries("3. UCI cycloX World Cup")?.slug).toBe("uci-cx-world-cup");
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

  it("rejects Hynek discipline labels and junk series names", () => {
    expect(canonicalizeSeries("2. XCO/XCC")).toBeNull();
    expect(canonicalizeSeries("PMTBP")).toBeNull();
    expect(canonicalizeSeries("závod")).toBeNull();
    expect(canonicalizeSeries("UCI ZÁVOD")).toBeNull();
  });

  it("aliases Prima Cup and Český pohár horských kol onto the canonical rows", () => {
    expect(canonicalizeSeries("Prima Cup")?.slug).toBe("primacup");
    expect(canonicalizeSeries("Český pohár horských kol")?.slug).toBe("cesky-pohar-mtb");
  });
});

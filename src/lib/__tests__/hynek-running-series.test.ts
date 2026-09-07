import { describe, expect, it } from "vitest";
import {
  discoverHynekSeriesUrls,
  isHynekRunningSeriesUrl,
  parseHynekMusil,
} from "@/lib/watcher/extractors/hynek";

const nav = `
  <table><tr>
    <td><a class='tlackak' href='?serialosss=tc'>| TALENT CUP</a></td>
    <td><a class='tlackak' href='?serialosss=forest'>| FORESTOVO ZÁVODY</a></td>
    <td><a class='tlackak' href='?serialosss=bbp'>| BĚŽECKÝ POHÁR PLZEŇSKA</a></td>
    <td><a class='tlackak' href='?serialosss=bch'>| BĚŽEC CHODSKA</a></td>
    <td><a class='tlackak' href='?serialosss=čpXC'>| MTB CZECH CUP</a></td>
    <td><a class='tlackak' href='?serialosss='>| ZPĚT NA KALENDÁŘ</a></td>
  </tr></table>
`;

// Forestovo závody is the Forrest Gump Team trail-running series; the rows look
// exactly like the MTB ones, so only the series code tells them apart.
const forestPage = `
  ${nav}
  <div>Dnes je pondělí, 7.9.2026, svátek má Regína</div>
  <table>
    <tr>
      <td><a href='http://www.forestovo.cz/'><img alt='6. závod Forestovo závod'></a></td>
      <td>6. Forestovo závod</td><td>neděle</td><td>13.9.</td>
      <td>Záluží u Třemošné <br> Forestova čtrnáctka</td><td></td>
    </tr>
    <tr>
      <td><a href='http://www.forestovo.cz/'><img alt='7. závod Forestovo závod'></a></td>
      <td>7. Forestovo závod</td><td>sobota</td><td>21.11.</td>
      <td>Záluží u Třemošné <br> Nočník</td><td></td>
    </tr>
  </table>
`;

describe("Hynek running series", () => {
  it("parses no events off a running series page", () => {
    expect(parseHynekMusil("https://hynekmusil.cz/?serialosss=forest", forestPage)).toEqual([]);
  });

  it("does not hand the running series pages to the watcher", () => {
    const urls = discoverHynekSeriesUrls(forestPage);
    expect(urls).toContain("https://hynekmusil.cz/?serialosss=tc");
    expect(urls.some((u) => /serialosss=(forest|bbp|bch)$/.test(u))).toBe(false);
  });

  it("recognises the running codes by URL, decoded or not", () => {
    expect(isHynekRunningSeriesUrl("https://hynekmusil.cz/?serialosss=forest")).toBe(true);
    expect(isHynekRunningSeriesUrl("?serialosss=bch")).toBe(true);
    expect(isHynekRunningSeriesUrl("https://hynekmusil.cz/?serialosss=%C4%8DpXC")).toBe(false);
  });

  it("still drops the Forestovo rows when they show up on the full calendar", () => {
    const events = parseHynekMusil("https://hynekmusil.cz", forestPage);
    expect(events).toEqual([]);
  });
});

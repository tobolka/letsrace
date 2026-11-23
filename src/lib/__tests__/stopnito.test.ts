import { describe, expect, it } from "vitest";
import { parseStopnito } from "@/lib/watcher/extractors/stopnito";

describe("stopnito.cz extractor", () => {
  it("parses cycling events and filters out running and cross-country skiing", () => {
    const html = `<table>
      <tr><td><strong><a href="/detail-zavodu/1237">Desítka v Bezručáku</a></strong></td><td>09.01.2027</td><td>Chomutov</td><td>Běh</td></tr>
      <tr><td><strong><a href="/detail-zavodu/1260">Krkonošská 70</a></strong></td><td>23.01.2027</td><td>Špindlerův Mlýn</td><td>Běžky</td></tr>
      <tr><td><strong><a href="/detail-zavodu/1401">Jizerská MTB 50</a></strong></td><td>15.05.2027</td><td>Bedřichov</td><td>Cyklistika / MTB</td></tr>
      <tr><td><strong><a href="/detail-zavodu/1402">Gravel Krušné hory</a></strong></td><td>12.06.2027 - 13.06.2027</td><td>Boží Dar</td><td>Cyklistika</td></tr>
    </table>`;

    const events = parseStopnito("https://www.stopnito.cz/zavody", html);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      externalId: "stopnito-1401-2027-05-15",
      name: "Jizerská MTB 50",
      startDate: "2027-05-15",
      placeText: "Bedřichov",
      countryHint: "CZ",
      discipline: ["mtb"],
    });
    expect(events[1]).toMatchObject({
      externalId: "stopnito-1402-2027-06-12",
      startDate: "2027-06-12",
      endDate: "2027-06-13",
      discipline: ["gravel"],
    });
  });
});

import { describe, expect, it } from "vitest";
import { parseHynekSeriesCalendar } from "@/lib/watcher/extractors/hynek-series";

const row = (date: string, name: string) => `
  <tr><td class='veliko100' colspan=2>${date}</td><td class='veliko100' colspan=3>${name}</td></tr>
  <tr><td><a class='tlackam' href='https://hynekmusil.cz/resreg/?designindex=data/registry.php&seiresepyt=tal'>ON-LINE</a></td>
      <td><a class='tlackam' href='Propozice/Propo1.pdf'>PROPOZICE</a></td></tr>`;

describe("Hynek series site calendars (talentcup.cz, pkk-hk.cz)", () => {
  it("keeps a dated round whose venue is a camp site and reads the town", () => {
    const html = `<table>${row("sobota: 28. března 2026", "Kemp Ejpovice - GOLF OPEN BIKE RACE - Časovka")}</table>`;
    const events = parseHynekSeriesCalendar("https://talentcup.cz/?tcdesignindex=data/zavody.php", html);
    expect(events.map((e) => [e.startDate, e.placeText])).toEqual([["2026-03-28", "Ejpovice"]]);
  });

  it("names the town in mixed case whatever the cell shouts", () => {
    const html = `<table>${row("sobota: 02. května 2026", " - XCO města KRALOVICE - Hlavní závod seriálu")}${row("sobota: 16. května 2026", "- XC CHEB - mistrovství KV kraje")}${row("sobota: 27. června 2026", "AŠ UCI C1")}</table>`;
    const events = parseHynekSeriesCalendar("https://www.pkk-hk.cz/?pkkdesignindex=data/zavody.php", html);
    expect(events.map((e) => e.placeText)).toEqual(["Kralovice", "Cheb", "Aš"]);
    expect(events[0]?.name).toBe("XCO města KRALOVICE - Hlavní závod seriálu");
  });
});

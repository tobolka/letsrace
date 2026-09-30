import { describe, expect, it } from "vitest";
import { isPortalDefaultClassList } from "@/lib/catalog/csc-ages";
import { parseCscRaceDetailText } from "@/lib/watcher/extractors/csc-render";

const PANEL = `Detail závodu
State:\tEnum:RaceState.LoadPro
Race:\tBrněnský cyklokrosový pohár
Category:\t
Elite
Junior
Kadeti
Masters
U23
Žáci - mladší

Start Date:\t10/7/2026
End Date:\t10/7/2026
Entries close date:\t10/5/2026
Web:\thttp://www.oca.cz
`;

describe("CSC race page", () => {
  it("reads the classes, dates and web from the opened panel", () => {
    expect(parseCscRaceDetailText(PANEL)).toEqual({
      categories: ["Elite", "Junior", "Kadeti", "Masters", "U23", "Žáci - mladší"],
      startDate: "2026-10-07",
      entriesCloseDate: "2026-10-05",
      web: "http://www.oca.cz",
    });
  });

  it("recognises the portal's prefilled class list", () => {
    const prefilled = ["Elite", "Junior", "Juniorky", "Žáci - mladší", "Žáci - starší", "Žákyně - starší", "Ženy", "Žákyně - mladší"];
    expect(isPortalDefaultClassList(prefilled)).toBe(true);
    expect(isPortalDefaultClassList([...prefilled, "Masters"])).toBe(false);
  });
});

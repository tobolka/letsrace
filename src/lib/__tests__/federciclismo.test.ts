import { describe, expect, it } from "vitest";
import { fciWindowsForRun, mapFciDiscipline } from "@/lib/watcher/extractors/federciclismo";

describe("FCI calendar coverage", () => {
  it("visits every month through December 2027 over successive daily runs", () => {
    const months = new Set<string>();
    for (let day = 24; day <= 30; day++) {
      const windows = fciWindowsForRun(new Date(`2026-09-${day}T05:00:00Z`));
      for (const window of windows.slice(0, 3)) {
        months.add(window.start.toISOString().slice(0, 7));
      }
    }
    for (let month = 1; month <= 12; month++) {
      expect(months.has(`2027-${String(month).padStart(2, "0")}`)).toBe(true);
    }
  });
});

describe("FCI discipline labels", () => {
  it.each([
    ["Fuoristrada - CICLOCROSS", "cx"],
    ["Fuoristrada - DOWNHILL", "dh"],
    ["Fuoristrada - ENDURO", "enduro"],
    ["Fuoristrada - CROSS COUNTRY", "xco"],
    ["Fuoristrada - MTB", "mtb"],
    ["Pista", "track"],
  ] as const)("maps %s to %s", (label, discipline) => {
    expect(mapFciDiscipline(label)).toEqual([discipline]);
  });
});

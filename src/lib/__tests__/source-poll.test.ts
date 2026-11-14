import { expect, it } from "vitest";
import { sourcePollAt } from "@/lib/watcher/core";

const days = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86_400_000);

it("asks an empty calendar again within days while next season is being published", () => {
  const november = new Date("2026-11-09T12:00:00Z"), june = new Date("2026-06-09T12:00:00Z");
  expect(days(november, sourcePollAt([], november))).toBe(2);
  expect(days(june, sourcePollAt([], june))).toBe(21);
});

import { comingDatesOnPage, SILENT_CALENDAR_DATES } from "@/lib/watcher/core";

it("counts the coming days a page states, so an empty read of a dated calendar is noticed", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const season = "Hradec Králové 2027 10. 4. 2027 Informace o závodě Dolní Morava 2027 5. 6. 2027 Sázava 2027 19. 6. 2027 Kupkolo MTB Trilogy 3.–5. 7. 2027";
  expect(comingDatesOnPage(season, now)).toBeGreaterThanOrEqual(SILENT_CALENDAR_DATES);
  // Last season's results and a bare year are not a calendar of coming races.
  expect(comingDatesOnPage("Výsledky: 11. 4. 2026 Hradec Králové, 16. 5. 2026 Opava. Sezona 2027 se připravuje.", now)).toBe(0);
  expect(comingDatesOnPage("Termín 14. 11. 2026 a 14. 11. 2026 znovu", now)).toBe(1);
});

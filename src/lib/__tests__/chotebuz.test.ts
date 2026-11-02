import { expect, it } from "vitest";
import { parseChotebuz } from "@/lib/watcher/extractors/chotebuz";
const url = "https://www.tjsokolchotebuz.cz/index.php?Itemid=36&id=17&option=com_content&view=article";
const page = (announcement: string) => `<title>Chotěbuzský kopec</title><h1>TJ Sokol Chotěbuz</h1><p>${announcement}</p><table><tr><td>8. května 2026</td></tr><tr><td>8. května 2025</td></tr></table>`;
it("reads only the explicit next edition, retaining its literal evidence and leaving unstated categories and discipline alone", () => {
  const quote = "Datum konání příštího závodu je 8. května 2027";
  const rows = parseChotebuz(url, page(quote));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ name: "Chotěbuzský kopec", startDate: "2027-05-08", evidence: { quote, sourceUrl: url } });
  expect(rows[0].discipline).toBeUndefined(); expect(rows[0].ageCategories).toBeUndefined(); expect(rows[0].registrationUrl).toBeUndefined();
});
it("does not manufacture the next date from an archive, a yearless date or a different club page", () => {
  expect(parseChotebuz(url, page(""))).toEqual([]);
  expect(parseChotebuz(url, page("Datum konání příštího závodu je 8. května"))).toEqual([]);
  expect(parseChotebuz(url, page("Datum konání příštího závodu je 8. května 2027").replace("<title>Chotěbuzský kopec</title>", "<title>Another event</title>"))).toEqual([]);
});
it("defers conflicting announcements and impossible dates", () => {
  expect(parseChotebuz(url, page("Datum konání příštího závodu je 31. února 2027"))).toEqual([]);
  expect(parseChotebuz(url, page("Datum konání příštího závodu je 8. května 2027. Datum konání příštího závodu je 9. května 2027"))).toEqual([]);
});

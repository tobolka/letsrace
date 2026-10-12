import { describe, expect, it } from "vitest";
import { paginateRaces, raceListPagePath, RACE_LIST_PAGE_SIZE } from "../race-list-pagination";

describe("race list pagination", () => {
  it("keeps every race reachable exactly once across the pages", () => {
    const events = Array.from({ length: 213 }, (_, i) => i);
    const first = paginateRaces(events);
    const pages = Array.from({ length: first.pages }, (_, i) => paginateRaces(events, String(i + 1)));
    expect(pages.flatMap((p) => p.events)).toEqual(events);
    expect(pages.every((p) => p.events.length <= RACE_LIST_PAGE_SIZE)).toBe(true);
  });

  it("handles empty lists and malformed or overflowing page numbers", () => {
    expect(paginateRaces([], "2")).toEqual({ events: [], page: 1, pages: 1 });
    for (const raw of ["0", "-1", "1.5", "foo", "9999999999999999999999", ["2", "3"]]) {
      expect(paginateRaces([1, 2], raw).page).toBe(1);
      expect(raceListPagePath("/en/races/de", raw)).toBe("/en/races/de");
    }
  });

  it("clamps to the last page and produces self-canonical pagination links", () => {
    const events = Array.from({ length: 51 }, (_, i) => i);
    const last = paginateRaces(events, "999");
    expect(last).toEqual({ events: [50], page: 2, pages: 2 });
    expect(raceListPagePath("/en/races/de", String(last.page))).toBe("/en/races/de?page=2");
    expect(raceListPagePath("/en/races/de", "1")).toBe("/en/races/de");
  });
});

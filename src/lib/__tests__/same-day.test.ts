import { expect, it } from "vitest";
import { sameDayConflicts } from "@/lib/same-day";

const golf = { id: "g", name: "Golf Open", slug: "golf", startDate: "2027-03-20", endDate: null };
const stage = { id: "s", name: "Etapák", slug: "etapak", startDate: "2027-03-19", endDate: "2027-03-21" };
const other = { id: "o", name: "Jinde", slug: "jinde", startDate: "2027-03-27", endDate: null };

it("lists other planned races on the same days, not the race itself", () => {
  expect(sameDayConflicts({ id: "x", startDate: "2027-03-20" }, [golf, other, golf], []).races.map((r) => r.id)).toEqual(["g"]);
  expect(sameDayConflicts({ id: "g", startDate: "2027-03-20" }, [golf], []).races).toEqual([]);
});

it("counts a multi-day race on any of its days", () => {
  expect(sameDayConflicts({ id: "x", startDate: "2027-03-21", endDate: "2027-03-22" }, [stage, golf], []).races.map((r) => r.id)).toEqual(["s"]);
});

it("lists days marked as taken within the race", () => {
  const taken = [{ day: "2027-03-20", note: "Svatba" }, { day: "2027-03-22", note: null }];
  expect(sameDayConflicts({ id: "x", startDate: "2027-03-20" }, [], taken).days).toEqual([{ day: "2027-03-20", note: "Svatba" }]);
  expect(sameDayConflicts({ id: "x", startDate: "2027-03-23" }, [golf], taken)).toEqual({ races: [], days: [] });
});

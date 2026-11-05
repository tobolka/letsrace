import { expect, it } from "vitest";
import { defaultEditionSeason } from "@/lib/catalog/edition-season";

it.each([
  ["2026-11-05T12:00:00Z", 2026],
  ["2027-01-01T12:00:00Z", 2026],
  ["2027-09-30T12:00:00Z", 2026],
  ["2027-10-01T12:00:00Z", 2027],
  // Already New Year's Eve evening in UTC, but January in Prague.
  ["2026-12-31T23:30:00Z", 2026],
  ["2027-09-30T22:30:00Z", 2027],
])("at %s looks for editions following season %i", (now, season) => {
  expect(defaultEditionSeason(new Date(now))).toBe(season);
});

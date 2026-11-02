import { expect, it } from "vitest";
import { preserveUnstatedDisciplines, protectSpecificFacts } from "@/lib/watcher/update-policy";
it("keeps the known discipline and formats when a new source only announces a date", () => {
  const stored = { disciplines: ["road"], formats: ["hill_climb"] };
  const proposed = { disciplines: ["mtb"], formats: ["cross_country"] };
  preserveUnstatedDisciplines(stored, {}, proposed);
  expect(proposed).toEqual(stored);
  expect(protectSpecificFacts(stored, proposed)).toEqual([]);
});
it("retains explicit incoming classification for normal protection and review", () => {
  const proposed = { disciplines: ["four_cross"], formats: ["four_cross"] };
  preserveUnstatedDisciplines({ disciplines: ["mtb"], formats: [] }, { discipline: ["four_cross"] }, proposed);
  expect(proposed.disciplines).toEqual(["four_cross"]);
});
it("does not turn an unchanged specific discipline into a conflict", () => {
  const stored = { disciplines: ["road", "tt"], formats: ["time_trial"] };
  expect(protectSpecificFacts(stored, { ...stored })).toEqual([]);
});
it("still protects a specific discipline from a broader incoming assertion", () => {
  const proposed = { disciplines: ["road"] };
  expect(protectSpecificFacts({ disciplines: ["road", "tt"] }, proposed)).toEqual(["disciplines"]);
  expect(proposed.disciplines).toEqual(["road", "tt"]);
});

import { expect, it } from "vitest";
import { protectOfficialFields } from "@/lib/watcher/update-policy";
import { pickBestDuplicate } from "@/lib/dedup";

it("keeps official identity/date fields while permitting an aggregator to fill missing facts", () => {
  const stored = { name: "Perlcross", start_date: "2026-10-11", end_date: "2026-10-11", disciplines: ["cx"],
    registration_url: null, fingerprint: "official-key", name_normalized: "perlcross", sources: [{ kind: "official" }] };
  const proposed = { name: "Cross 2026", start_date: "2026-10-12", end_date: "2026-10-12", disciplines: ["mtb"], registration_url: "https://entry.test/123", fingerprint: "wrong-key" };
  expect(protectOfficialFields("aggregator", stored, proposed)).toEqual(["name", "start_date", "end_date", "disciplines"]);
  expect(proposed).toMatchObject({ name: stored.name, start_date: stored.start_date, end_date: stored.end_date, disciplines: ["cx"], registration_url: "https://entry.test/123", fingerprint: "official-key" });
});

it("permits an official source to correct a reschedule and lets an aggregator fill an empty field", () => {
  const proposed = { start_date: "2026-10-18", disciplines: ["cx"] };
  expect(protectOfficialFields("race", { start_date: "2026-10-11", sources: [{ kind: "official" }] }, proposed)).toEqual([]);
  expect(protectOfficialFields("aggregator", { disciplines: [], sources: [{ kind: "official" }] }, proposed)).toEqual([]);
  expect(proposed.start_date).toBe("2026-10-18");
});

it("defers an ambiguous match and treats repeated sightings of the same row as one candidate", () => {
  const event = { name: "Perlcross", startDate: "2026-10-11", placeText: "Perl" };
  expect(pickBestDuplicate(event, [{ row: { id: "a" }, event }, { row: { id: "b" }, event }])).toBeNull();
  expect(pickBestDuplicate(event, [{ row: { id: "a" }, event }, { row: { id: "a" }, event }])?.row.id).toBe("a");
});

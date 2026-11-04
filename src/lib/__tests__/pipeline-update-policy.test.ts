import { expect, it } from "vitest";
import { protectOfficialFields, protectSpecificFacts } from "@/lib/watcher/update-policy";
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
it("retains an XCO format and detailed classification when a federation only says MTB", () => {
  const stored = { disciplines: ["xco"], formats: ["xco"], class_label: "UCI C1", uci_class: "C1", competition_type: "uci" };
  const proposed = { disciplines: ["mtb"], formats: [], class_label: null, uci_class: null, competition_type: "other" };
  protectSpecificFacts(stored, proposed);
  expect(proposed).toEqual(stored);
});
it("permits specific corrected disciplines and new positive formats", () => {
  const proposed = { disciplines: ["xcm"], formats: ["xcm"], competition_type: "national" };
  protectSpecificFacts({ disciplines: ["mtb"], formats: [], competition_type: "other" }, proposed);
  expect(proposed).toEqual({ disciplines: ["xcm"], formats: ["xcm"], competition_type: "national" });
});
it("protects an organiser series against an aggregator", () => {
  const proposed = { start_date: "2027-06-02" };
  protectOfficialFields("aggregator", { start_date: "2027-06-01", sources: [{ kind: "series" }] }, proposed);
  expect(proposed.start_date).toBe("2027-06-01");
});

it("keeps detailed formats when a later official sighting only repeats MTB", () => {
  const stored = { disciplines: ["xco", "xcc"], formats: ["xco", "xcc"] };
  const proposed = { disciplines: ["mtb"], formats: ["mtb"] };
  protectSpecificFacts(stored, proposed);
  expect(proposed).toEqual(stored);
});

it("does not demote a documented UCI race when a general organiser announcement supplies no class", () => {
  const proposed = { competition_type: "community", uci_class: null };
  protectSpecificFacts({ competition_type: "uci", uci_class: "cs" }, proposed);
  expect(proposed).toEqual({ competition_type: "uci", uci_class: "cs" });
});

import { createRequire } from "node:module";
import { expect, it } from "vitest";

const { eventFills, confirmedDetails, valueHash } = createRequire(import.meta.url)("../../../scripts/local-fills.cjs");
const race = { name: "Race", start_date: "2027-05-01" };
const venue = { value: { name: "Park" } }, fees = { value: [{ label: "Elite", amount: 20, currency: "EUR" }] }, schedule = { value: [{ label: "Start", date: "2027-05-01", time: "10:00" }] };

it("adds a missing programme to a race that already has a venue, keeping what the server holds", () => {
  const fill = eventFills({ ...race, practical_details: { venue: { value: { name: "Other" } }, schedule } }, { ...race, practical_details: {} }, { ...race, practical_details: { venue } });
  expect(fill.after.practical_details).toEqual({ venue, schedule });
  expect(fill.before.practical_details).toEqual({ venue });
});
it("does not bring back a part that was in the copy and removed since", () => {
  expect(eventFills({ ...race, practical_details: { fees } }, { ...race, practical_details: { fees } }, { ...race, practical_details: {} })).toBeNull();
});
it("respects a lock on one part and on all of them", () => {
  const work = { ...race, practical_details: { fees, schedule } }, base = { ...race, practical_details: {} };
  expect(eventFills(work, base, { ...race, practical_details: {}, locked_fields: ["practical.fees"] }).after.practical_details).toEqual({ schedule });
  expect(eventFills(work, base, { ...race, practical_details: {}, locked_fields: ["practical_details"] })).toBeNull();
});
it("sends nothing when the edition no longer matches", () => {
  expect(eventFills({ ...race, start_date: "2027-05-02", practical_details: { fees } }, { ...race, practical_details: {} }, { ...race, practical_details: {} })).toBeNull();
});

it("lets out only what the second reader confirmed, for the value it saw", () => {
  const details = { fees, schedule, venue };
  const entry = { fields: { fees: { verdict: "confirmed", value: valueHash(fees.value) }, schedule: { verdict: "wrong_value", value: valueHash(schedule.value) }, venue: { verdict: "confirmed", value: "changed since" } } };
  expect(confirmedDetails(details, entry)).toEqual({ fees });
});
it("lets out nothing a race has no check for, except links to its documents", () => {
  const documents = { value: [{ kind: "regulations", url: "https://a.cz/p.pdf" }] };
  expect(confirmedDetails({ fees, documents }, undefined)).toEqual({ documents });
});

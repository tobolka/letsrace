import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { nextRunAt, CARRY_ON_MS, SHORTEST_WAIT_MS, LONGEST_WAIT_MS } = require("../../../scripts/local-schedule.cjs");
const { organiserDue, targetNeeded, coverageFrom } = require("../../../scripts/local-cycle.cjs");
const { eventFills, locationFill } = require("../../../scripts/local-fills.cjs");
const now = Date.parse("2026-11-05T12:00:00Z");
const at = (ms: number) => new Date(now + ms).toISOString();

describe("when the Mac's next cycle starts", () => {
  it("carries on straight away while there is work", () => {
    expect(nextRunAt({ now, exitCode: 0, result: { state: "finished", moreWork: true } })).toBe(now + CARRY_ON_MS);
    expect(nextRunAt({ now, exitCode: 2, result: { state: "publication_pending", moreWork: true } })).toBe(now + CARRY_ON_MS);
  });
  it("otherwise waits for what falls due next, within limits", () => {
    expect(nextRunAt({ now, exitCode: 0, result: { moreWork: false, nextWorkAt: at(3_600_000) } })).toBe(now + 3_600_000);
    expect(nextRunAt({ now, exitCode: 0, result: { moreWork: false, nextWorkAt: at(-5) } })).toBe(now + SHORTEST_WAIT_MS);
    expect(nextRunAt({ now, exitCode: 0, result: { moreWork: false, nextWorkAt: at(LONGEST_WAIT_MS * 9) } })).toBe(now + LONGEST_WAIT_MS);
    expect(nextRunAt({ now, exitCode: 0, result: { moreWork: false } })).toBe(now + LONGEST_WAIT_MS);
  });
  it("backs off from a broken cycle instead of repeating it", () => {
    const failed = { state: "attention", error: "reader crashed", moreWork: true };
    expect(nextRunAt({ now, exitCode: 1, result: failed, failures: 1 })).toBe(now + 5 * 60_000);
    expect(nextRunAt({ now, exitCode: 1, result: failed, failures: 3 })).toBe(now + 20 * 60_000);
    expect(nextRunAt({ now, exitCode: 1, result: failed, failures: 40 })).toBe(now + 60 * 60_000);
    expect(nextRunAt({ now, exitCode: 1, result: null, failures: 1 })).toBe(now + 5 * 60_000);
  });
});

describe("details found on the Mac for races on the server", () => {
  const race = { name: "Závod", start_date: "2027-06-01", merged_into_id: null, website_url: null, class_label: "Regional", age_categories: [], age_confidence: null, audience: "mixed" };
  it("fills only what is empty there and was empty when the copy was taken", () => {
    const work = { ...race, website_url: "https://zavod.cz/", class_label: "National" };
    expect(eventFills(work, race, race)).toEqual({ after: { website_url: "https://zavod.cz/" }, before: { website_url: null } });
  });
  it("does not bring back a value removed from the server after the copy", () => {
    const base = { ...race, website_url: "https://stary.cz/" };
    expect(eventFills({ ...base }, base, race)).toBeNull();
  });
  it("keeps a value someone entered there meanwhile", () => {
    const work = { ...race, website_url: "https://zavod.cz/" };
    expect(eventFills(work, race, { ...race, website_url: "https://jiny.cz/" })).toBeNull();
  });
  it("leaves alone a race that merged or moved on the server", () => {
    const work = { ...race, website_url: "https://zavod.cz/" };
    expect(eventFills(work, race, { ...race, merged_into_id: "x" })).toBeNull();
    expect(eventFills(work, race, { ...race, start_date: "2027-07-01" })).toBeNull();
    expect(eventFills(work, race, { ...race, name: "Jiný" })).toBeNull();
  });
  it("treats a race the Mac itself created after the copy as having had nothing", () => {
    const work = { ...race, website_url: "https://zavod.cz/" };
    expect(eventFills(work, undefined, race)?.after).toEqual({ website_url: "https://zavod.cz/" });
  });
  it("moves categories together with their companions", () => {
    const work = { ...race, age_categories: ["U11"], age_confidence: "official", audience: "kids" };
    expect(eventFills(work, race, race)).toEqual({ after: { age_categories: ["U11"], age_confidence: "official", audience: "kids" }, before: { age_categories: [], age_confidence: null, audience: "mixed" } });
  });
  it("sets a pin only where neither side had one", () => {
    const empty = { lat: null, lng: null, geog: null, geocode_status: "pending", geocode_query: null };
    const found = { lat: 50, lng: 14, geocode_query: "Praha" };
    expect(locationFill(found, empty, empty)?.after).toEqual({ lat: 50, lng: 14, geog: "SRID=4326;POINT(14 50)", geocode_status: "ok", geocode_query: "Praha" });
    expect(locationFill(found, { ...empty, lat: 49 }, empty)).toBeNull();
    expect(locationFill(found, empty, { ...empty, lat: 49 })).toBeNull();
    expect(locationFill(found, empty, { ...empty, geocode_status: "skipped" })).toBeNull();
  });
});

describe("what a cycle needs from elsewhere", () => {
  const fresh = { targetCheckedAt: at(-4 * 3_600_000), eventsAtLastPlan: "10:x", deferredNewRaces: 0, sendFailed: false };
  it("does not read the server while nothing here could be sent", () => expect(targetNeeded(fresh, "10:x", now)).toBe(false));
  it("reads it for a new local race, waiting races, a failed send, or when the copy got old", () => {
    expect(targetNeeded(fresh, "11:y", now)).toBe(true);
    expect(targetNeeded({ ...fresh, deferredNewRaces: 3 }, "10:x", now)).toBe(true);
    expect(targetNeeded({ ...fresh, sendFailed: true }, "10:x", now)).toBe(true);
    expect(targetNeeded({ ...fresh, targetCheckedAt: at(-13 * 3_600_000) }, "10:x", now)).toBe(true);
    expect(targetNeeded({ ...fresh, fillsWaiting: 5 }, "10:x", now)).toBe(true);
    expect(targetNeeded({}, "10:x", now)).toBe(true);
  });
  it("copies the target at most every three hours, whatever is waiting", () => {
    expect(targetNeeded({ ...fresh, targetCheckedAt: at(-3_600_000) }, "11:y", now)).toBe(false);
    expect(targetNeeded({ ...fresh, targetCheckedAt: at(-3_600_000), sendFailed: true }, "10:x", now)).toBe(false);
  });
  it("counts last year's races that have their next edition, by country", () => {
    const result = coverageFrom({ summary: { season: 2027 }, rows: [{ race: "a", state: "found" }, { race: "b", state: "published" }, { race: "c", state: "waiting" }] }, [{ id: "a", location: { country_code: "CZ" } }, { id: "b", location: { country_code: "CZ" } }, { id: "c", location: { country_code: "IT" } }]);
    expect(result).toEqual({ season: 2027, races: 3, withEdition: 2, byCountry: { CZ: { races: 2, withEdition: 2 }, IT: { races: 1, withEdition: 0 } } });
  });
  it("starts the organiser reading only when it left something or a page fell due", () => {
    expect(organiserDue(null, now)).toBe(true);
    expect(organiserDue({ unreadPages: 4 }, now)).toBe(true);
    expect(organiserDue({ unreadPages: 0, nextDueAt: at(1000) }, now)).toBe(false);
    expect(organiserDue({ unreadPages: 0, nextDueAt: at(-1000) }, now)).toBe(true);
  });
});

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newRaceProblems, type KnownRace } from "@/lib/local-pass/new-race-check";
import { createComparer, editionCoverage } from "@/lib/local-pass/compare";
import { withChromeSlot } from "@/lib/watcher/chrome-slots";
import { belongsToThisWorker } from "@/lib/watcher/pool";
import { chooseEventType, isDifferentDatedRace, isSameCalendarOtherRace, isSamePlace } from "@/lib/watcher/update-policy";
import { spanOf } from "@/lib/watcher/extractors/rideandrest";
import { nextForFreeHost, openStore, type CatalogueEvent, type LocalStore } from "@/lib/local-pass/store";

const race = (over: Partial<CatalogueEvent>): CatalogueEvent => ({
  id: "a", name: "Bike Maraton Kněžice", start_date: "2027-05-29", end_date: null, status: "scheduled", visibility: "public", event_type: "race",
  series_id: null, disciplines: ["mtb_marathon"], website_url: null, lat: 49.27, lng: 15.67, municipality: "Kněžice", country_code: "CZ", ...over,
});
const parsed = { externalId: "row-1", name: "Bike Maraton Kněžice", startDate: "2027-05-29", placeText: "Kněžice", countryHint: "CZ", discipline: ["mtb_marathon"], lat: 49.27, lng: 15.67 };

let directory: string, store: LocalStore;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "local-pass-")); store = openStore(directory); });
afterEach(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });

it("resumes: a read source is not due again and a failure waits, keeping its earlier page", () => {
  store.addSources([{ url: "https://a.test/", origin: "watched" }, { url: "https://b.test/", origin: "watched" }]);
  const now = 1_000_000_000;
  store.saveRead("https://a.test/", { html: "<p>2027</p>", status: 200, hash: "h1" }, now);
  store.saveFailure("https://b.test/", { state: "error", error: "timeout" }, now);
  expect(store.dueSources(now, now - 1000)).toEqual([]);
  store.addSources([{ url: "https://a.test/", origin: "watched" }]);
  expect(store.pageText("https://a.test/")).toBe("<p>2027</p>");
  expect(store.dueSources(now + 3 * 3600_000, now - 1000).map(row => row.url)).toEqual(["https://b.test/"]);
  store.saveFailure("https://a.test/", { state: "error", error: "down" }, now);
  expect(store.pageText("https://a.test/")).toBe("<p>2027</p>");
});

it("re-extracts only pages that changed or met a new reader", () => {
  store.addSources([{ url: "https://a.test/", origin: "watched" }]);
  store.saveRead("https://a.test/", { html: "x", status: 200, hash: "h1" }, 1);
  expect(store.sourcesToExtract("v1")).toHaveLength(1);
  store.saveExtraction("https://a.test/", "v1", "h1", { strategy: "generic", complete: true, events: [{ externalId: "e", startDate: "2027-01-01" }] });
  expect(store.sourcesToExtract("v1")).toHaveLength(0);
  expect(store.sourcesToExtract("v2")).toHaveLength(1);
  store.saveRead("https://a.test/", { html: "y", status: 200, hash: "h2" }, 2);
  expect(store.sourcesToExtract("v1")).toHaveLength(1);
});

it("lets a second pass take over only from a dead process", () => {
  store.acquireLock(111);
  expect(() => store.acquireLock(222, () => true)).toThrow(/Another local pass/);
  expect(() => store.acquireLock(222, () => false)).not.toThrow();
});

it("sends one request per host at a time, without starving other hosts", () => {
  const queue = [{ url: "https://www.a.test/1" }, { url: "https://a.test/2" }, { url: "https://b.test/1" }];
  expect(nextForFreeHost(queue, new Set(["a.test"]))?.url).toBe("https://b.test/1");
  expect(nextForFreeHost(queue, new Set(["a.test"]))).toBeUndefined();
  expect(queue).toHaveLength(2);
});

it("recognises a known race by its source row and flags a moved date without changing it", () => {
  const compare = createComparer([race({})], [{ event_id: "a", watched_url_id: "w", external_id: "row-1" }]);
  expect(compare(parsed, "w")).toMatchObject({ decision: "known", eventId: "a" });
  expect(compare({ ...parsed, startDate: "2027-06-05" }, "w")).toMatchObject({ decision: "date_differs", eventId: "a" });
});

it("recognises the same race from another source and calls an unknown one new", () => {
  const compare = createComparer([race({})], []);
  expect(compare(parsed, null)).toMatchObject({ decision: "known", eventId: "a" });
  expect(compare({ ...parsed, name: "Gravel Třeboň", placeText: "Třeboň", lat: 49.0, lng: 14.77, discipline: ["gravel"], startDate: "2027-05-29" }, null).decision).toBe("new");
});

it("measures last year's races without calculating dates or counting races that cannot return", () => {
  const last = (id: string, over: Partial<CatalogueEvent> = {}) => race({ id, start_date: "2026-05-30", ...over });
  const events = [
    last("published", { name: "Bike Maraton Kněžice" }), race({ id: "next" }),
    last("local", { name: "Gravel Třeboň", municipality: "Třeboň", lat: 49, lng: 14.77, disciplines: ["gravel"] }),
    last("mentioned", { name: "Sudety Cup", municipality: "Jeseník", lat: 50.2, lng: 17.2 }),
    last("silent", { name: "Tichý závod", municipality: "Kolín", lat: 50, lng: 15.2 }),
    last("cancelled", { name: "Zrušený závod", status: "cancelled" }), last("ride", { name: "Vyjížďka", event_type: "ride" }),
    last("abroad", { name: "Zahraniční závod", country_code: "SK" }),
  ];
  const local = [{ externalId: "x", name: "Gravel Třeboň", startDate: "2027-05-29", placeText: "Třeboň", countryHint: "CZ", discipline: ["gravel"], lat: 49, lng: 14.77 }];
  const result = editionCoverage(events, local, 2027, "CZ", row => row.id === "mentioned");
  expect(result.base).toBe(4);
  expect(result.counts).toMatchObject({ public: 1, found_locally: 1, mentioned_on_site: 1, nothing_yet: 1 });
  expect(result.percentPublic).toBe(25);
});

it("holds a moved date and everything else written to that race for review", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { separateForReview } = require("../../../scripts/local-sync.cjs");
  const moved = { tab: "public.events", op: "update", pk: { id: "moved" }, before: { start_date: "2027-03-20" }, after: { start_date: "2027-05-15", website_url: "https://other.test" } };
  const seen = { tab: "public.events", op: "update", pk: { id: "seen" }, before: { last_seen_at: "a" }, after: { last_seen_at: "b" } };
  const fresh = { tab: "public.events", op: "insert", pk: { id: "new" }, after: { start_date: "2027-01-01" } };
  const child = { tab: "public.event_sources", op: "insert", pk: { id: "s" }, after: { event_id: "moved" } };
  const place = { tab: "public.locations", op: "insert", pk: { id: "l" }, after: { name: "Praha" } };
  const { send, held } = separateForReview([moved, seen, fresh, child, place]);
  expect(held.map((change: { pk: { id: string } }) => change.pk.id)).toEqual(["moved", "s"]);
  expect(send).toEqual([seen, fresh, place]);
});

it("gives every site to exactly one worker, whatever its www prefix", () => {
  const hosts = ["sumator.cz", "cykloman.cz", "radsport-events.de", "pzkol.pl", "odjazd.pl", "mtbs.cz"];
  for (const host of hosts) {
    expect([0, 1, 2, 3, 4].filter(index => belongsToThisWorker(host, `${index}/5`))).toHaveLength(1);
    expect(belongsToThisWorker(`www.${host}`, "2/5")).toBe(belongsToThisWorker(host, "2/5"));
  }
  expect(belongsToThisWorker("anything.test", undefined)).toBe(true);
  expect(() => belongsToThisWorker("a.test", "7/5")).toThrow();
});

it("never runs more Chrome windows than slots, and reclaims a slot from a dead process", async () => {
  const slots = join(directory, "chrome");
  let running = 0, peak = 0;
  await Promise.all(Array.from({ length: 6 }, () => withChromeSlot(async () => {
    peak = Math.max(peak, ++running);
    await new Promise(resolve => setTimeout(resolve, 15));
    running--;
  }, { directory: slots, slots: 2, waitMs: 5 })));
  expect(peak).toBe(2);
  mkdirSync(join(slots, "slot-0"), { recursive: true });
  writeFileSync(join(slots, "slot-0", "pid"), "999999");
  await expect(withChromeSlot(async () => "done", { directory: slots, slots: 1, waitMs: 5 })).resolves.toBe("done");
});

it("lets no source swap a race's kind by guessing, while a stated specific kind still counts", () => {
  expect(chooseEventType("cup", "race", "series")).toBe("cup");
  expect(chooseEventType(undefined, "race", "series")).toBe("race");
  expect(chooseEventType(undefined, "series", "race")).toBe("series");
  expect(chooseEventType("race", "championship", "race")).toBe("championship");
  expect(chooseEventType(undefined, "ride", "race")).toBe("ride");
  expect(chooseEventType("ride", "race", "race")).toBe("ride");
  expect(chooseEventType(undefined, null, "cup")).toBe("cup");
  expect(chooseEventType("race", null, "cup")).toBe("race");
  // A source stating a plain race corrects a series or cup stored on one race.
  expect(chooseEventType("race", "series", "race")).toBe("race");
  expect(chooseEventType("race", "cup", "race")).toBe("race");
  expect(chooseEventType("race", "ride", "race")).toBe("ride");
});

it("treats another row for one town as the same place, but not a different town", () => {
  const jesenik = { municipality: "Jeseník", name: "Jeseník", geocode_query: "Jeseník", country_code: "CZ", lat: 50.2296, lng: 17.2047 };
  expect(isSamePlace(jesenik, { query: "Jeseník", country: "CZ", lat: 50.2296, lng: 17.2047 })).toBe(true);
  expect(isSamePlace({ ...jesenik, municipality: "Zlaté Hory", name: "Zlaté Hory", geocode_query: "Zlaté Hory", lat: 50.26, lng: 17.39 }, { query: "Zlaté hory", country: "CZ" })).toBe(true);
  expect(isSamePlace(jesenik, { query: "Jeseník", country: "SK" })).toBe(false);
  expect(isSamePlace(jesenik, { query: "Jeseník", country: "CZ", lat: 49.9, lng: 17.2 })).toBe(false);
  expect(isSamePlace(jesenik, { query: "Faak am See", country: "CZ" })).toBe(false);
  expect(isSamePlace(null, { query: "Jeseník" })).toBe(false);
  // A missing point may be filled in, and a start 2 km away is another place.
  expect(isSamePlace({ ...jesenik, lat: null, lng: null }, { query: "Jeseník", country: "CZ", lat: 50.2296, lng: 17.2047 })).toBe(false);
  expect(isSamePlace(jesenik, { query: "Jeseník", country: "CZ", lat: 50.2476, lng: 17.2047 })).toBe(false);
  expect(isSamePlace(jesenik, { query: "Jeseník", country: "CZ", lat: 50.2312, lng: 17.2060 })).toBe(true);
});

describe("last look at new races", () => {
  const place = { municipality: "Kněžice", country_code: "CZ", lat: 49.27, lng: 15.67 };
  const race = { id: "new", name: "Bike Maraton Kněžice", start_date: "2027-05-29", visibility: "public", event_type: "race", disciplines: ["mtb_marathon"] };
  const check = (over: object, where: object | null = place, known: KnownRace[] = []) => newRaceProblems({ ...race, ...over }, where, known, "2026-11-05");

  it("lets a complete race through", () => expect(check({})).toEqual([]));
  it("holds a name that says nothing", () => expect(check({ name: "SHORT TRACK" })).toContain("name_says_too_little"));
  it("holds a ride", () => expect(check({ event_type: "ride" })).toContain("listed_as_a_ride"));
  it("holds a date in the past", () => expect(check({ start_date: "2026-10-01" })).toContain("no_future_date"));
  it("holds a race with no place but accepts a known town before geocoding", () => {
    expect(check({}, null)).toContain("no_usable_place");
    expect(check({}, { municipality: "Kněžice", country_code: "CZ" })).toEqual([]);
  });
  it("holds a race that may already be listed, but not an unrelated one that day", () => {
    const same = { id: "old", name: "Bike Maraton Kněžice", start_date: "2027-05-29", disciplines: ["mtb_marathon"], place };
    const other = { id: "other", name: "Gravel Třeboň", start_date: "2027-05-29", disciplines: ["gravel"], place: { municipality: "Třeboň", country_code: "CZ", lat: 49, lng: 14.77 } };
    expect(check({}, place, [same])).toContain("may_already_be_listed");
    expect(check({}, place, [other])).toEqual([]);
  });
  it("does not resurrect a merged event under a long title with wrong discipline tags", () => {
    const known = { id: "merged-alias", name: "DWH Cross Wels", start_date: "2026-11-08", disciplines: ["cx"], website_url: "https://www.rc-ovilava-wels.at/", place: { municipality: "Wels", country_code: "AT" } };
    expect(check({ name: "DWH Cross Wels Nationales Rennen mit Jedermannfrau Gravel MTB Rennen und BOA Mini Grand Prix", start_date: "2026-11-08", disciplines: ["mtb", "road", "gravel"], website_url: "https://rc-ovilava-wels.at/" }, { municipality: "4600 Wels", country_code: "AT" }, [known])).toContain("may_already_be_listed");
  });
});

it("holds a source change with its race even when the link itself did not change", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { separateForReview } = require("../../../scripts/local-sync.cjs");
  const moved = { tab: "public.events", op: "update", pk: { id: "race" }, owner: "race", before: { start_date: "2027-05-01" }, after: { start_date: "2027-06-01" } };
  const source = { tab: "public.event_sources", op: "update", pk: { id: "s" }, owner: "race", before: { source_url: "old" }, after: { source_url: "new" } };
  const { send, held } = separateForReview([moved, source]);
  expect(send).toEqual([]);
  expect(held).toHaveLength(2);
});

it("sends only a plan that was reviewed and has not changed since", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { assertReviewed } = require("../../../scripts/local-sync.cjs");
  const file = join(directory, "changes.ndjson"), plan = join(directory, "plan.json");
  writeFileSync(file, "line");
  const sha = createHash("sha256").update("line").digest("hex");
  writeFileSync(plan, JSON.stringify({ sha256: sha }));
  expect(() => assertReviewed(file)).toThrow(/not been through/);
  writeFileSync(plan, JSON.stringify({ sha256: sha, reviewedAt: "2026-11-05T12:00:00Z" }));
  expect(assertReviewed(file)).toBe(sha);
  writeFileSync(file, "tampered");
  expect(() => assertReviewed(file)).toThrow(/no longer matches/);
});

it("stops a record jumping between races joined by mistake, but lets a race be rescheduled", () => {
  const sources = [{ external_id: "radsport-27035-2027-04-17" }, { external_id: "radsport-27851-2027-04-30" }];
  expect(isDifferentDatedRace("radsport-27851-2027-04-30", "2027-04-30", "2027-04-17", sources)).toBe(true);
  expect(isDifferentDatedRace("radsport-27035-2027-04-17", "2027-04-17", "2027-04-17", sources)).toBe(false);
  expect(isDifferentDatedRace("radsport-27035-2027-05-02", "2027-05-02", "2027-04-17", [{ external_id: "radsport-27035-2027-04-17" }])).toBe(false);
  expect(isDifferentDatedRace("csc-1695", "2027-05-02", "2027-04-17", sources)).toBe(false);
});

it("does not hold Allgäu for an unrelated road event hundreds of kilometres away on its weekend", () => {
  const incoming={id:"allgaeu",name:"Allgäu & Spätzle",start_date:"2027-06-18",end_date:"2027-06-20",disciplines:["road","gravel"]};
  expect(newRaceProblems(incoming,{municipality:"Bad Waldsee",country_code:"DE",lat:47.9179844,lng:9.7494576},[{id:"munich",name:"Bayrisch-Böhmisches Biere und Bäder Brevet",start_date:"2027-06-19",disciplines:["road"],place:{municipality:"München",country_code:"DE",lat:48.1351,lng:11.582}}],"2026-11-05")).toEqual([]);
});

describe("two entries of one calendar", () => {
  const stored = [{ external_id: "radsport-16-2027-03-20" }];
  it("are two races when the same calendar lists them with their own ids and days", () => {
    expect(isSameCalendarOtherRace("radsport-47-2027-04-10", "2027-04-10", "2027-03-20", stored)).toBe(true);
  });
  it("are one race when only the day moved, or when two calendars disagree", () => {
    expect(isSameCalendarOtherRace("radsport-16-2027-04-10", "2027-04-10", "2027-03-20", stored)).toBe(false);
    expect(isSameCalendarOtherRace("sumator-gravel-2027-04-10", "2027-04-10", "2027-03-20", stored)).toBe(false);
    expect(isSameCalendarOtherRace("radsport-47-2027-03-20", "2027-03-20", "2027-03-20", stored)).toBe(false);
  });
});

describe("a Ride&Rest month page", () => {
  it("dates what is still running from last month by the day it began", () => {
    expect(spanOf("2027-05", "30", "fino al 2 Maggio")).toEqual({ startDate: "2027-04-30", endDate: "2027-05-02" });
    expect(spanOf("2026-11", "30", "fino al 3 Novembre")).toEqual({ startDate: "2026-10-30", endDate: "2026-11-03" });
  });
  it("keeps a span that begins this month, and a plain day", () => {
    expect(spanOf("2027-05", "14", "fino al 16 Maggio")).toEqual({ startDate: "2027-05-14", endDate: "2027-05-16" });
    expect(spanOf("2027-04", "30", "fino al 2 Maggio")).toEqual({ startDate: "2027-04-30", endDate: "2027-05-02" });
    expect(spanOf("2026-12", "30", "fino al 2 Gennaio")).toEqual({ startDate: "2026-12-30", endDate: "2027-01-02" });
    expect(spanOf("2027-05", "14", "")).toEqual({ startDate: "2027-05-14" });
  });
});

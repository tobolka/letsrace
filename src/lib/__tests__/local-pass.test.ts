import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newRaceProblems, type KnownRace } from "@/lib/local-pass/new-race-check";
import { createComparer, editionCoverage } from "@/lib/local-pass/compare";
import { withChromeSlot } from "@/lib/watcher/chrome-slots";
import { belongsToThisWorker } from "@/lib/watcher/pool";
import { chooseEventType, isDayOfStoredRace, isDifferentDatedRace, isSameCalendarOtherRace, isSamePlace } from "@/lib/watcher/update-policy";
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

describe("risk classes for held changes", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { separateForReview } = require("../../../scripts/local-sync.cjs");
  const date = { tab: "public.events", op: "update", pk: { id: "r" }, owner: "r", before: { start_date: "2027-03-20" }, after: { start_date: "2027-03-27" } };
  const fact = (over: Record<string, unknown>) => ({ tab: "public.event_facts", op: "insert", pk: { id: "f" }, owner: "r", after: { event_id: "r", field: "start_date", value: "2027-03-27", quote: "Závod se jede 27. 3. 2027", source_url: "https://organizer.test/", method: "watcher_update_v2", ...over } });

  it("sends a date that arrives with a quote from a named page", () => {
    const { send, held } = separateForReview([date, fact({})]);
    expect(held).toEqual([]);
    expect(send).toHaveLength(2);
  });

  it("holds a date without a quote, without a page, with another value, or from the calendar clock", () => {
    for (const over of [{ quote: null }, { quote: "  " }, { source_url: null }, { value: "2027-04-03" }, { method: "calendar_elapsed" }, { field: "end_date" }]) {
      expect(separateForReview([date, fact(over)]).held).toHaveLength(2);
    }
    expect(separateForReview([date]).held).toHaveLength(1);
  });

  it("sends a quoted cancellation, but no other status and no rename", () => {
    const cancel = { tab: "public.events", op: "update", pk: { id: "r" }, owner: "r", before: { status: "scheduled" }, after: { status: "cancelled" } };
    expect(separateForReview([cancel, fact({ field: "status", value: "cancelled", quote: "Závod 27. 3. 2027 se ruší, zrušeno z důvodu povodní" })]).held).toEqual([]);
    // A quote that only names the date does not say the race is off.
    expect(separateForReview([cancel, fact({ field: "status", value: "cancelled" })]).held).toHaveLength(2);
    expect(separateForReview([cancel]).held).toHaveLength(1);
    const other = { ...cancel, after: { status: "tbc" } };
    expect(separateForReview([other, fact({ field: "status", value: "tbc" })]).held).toHaveLength(2);
    const rename = { ...date, before: { name: "A" }, after: { name: "B" } };
    expect(separateForReview([rename, fact({ field: "name", value: "B" })]).held).toHaveLength(2);
  });

  it("holds the whole race when a proven date comes with an unproven rename", () => {
    const both = { ...date, before: { ...date.before, name: "A" }, after: { ...date.after, name: "B" } };
    expect(separateForReview([both, fact({})]).send).toEqual([]);
  });
});

describe("date proposals preview", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { classify } = require("../../../scripts/date-proposals.cjs");
  const race = (over: Record<string, unknown> = {}) => ({ id: "r", name: "Race", start_date: "2027-06-12", end_date: "2027-06-12", status: "scheduled", merged_into_id: null, ...over });
  const fact = (over: Record<string, unknown> = {}) => ({ event_id: "r", field: "start_date", value: "2027-06-12", quote: "Race 12. 6. 2027", source_url: "https://organizer.test/", method: "watcher_update_v2", ...over });
  const today = "2026-11-20";

  it("lists a moved date that has its quote", () => {
    const out = classify([race()], [race({ start_date: "2027-06-05", end_date: "2027-06-12" })], [fact()], today);
    expect(out.ready).toHaveLength(1);
    expect(out.ready[0]).toMatchObject({ before: { start_date: "2027-06-05" }, after: { start_date: "2027-06-12" } });
  });

  it("keeps a change without a quote waiting, and says which column lacks it", () => {
    const out = classify([race()], [race({ start_date: "2027-06-05", end_date: "2027-06-12" })], [fact({ quote: null })], today);
    expect(out.ready).toEqual([]);
    expect(out.reasons).toEqual({ no_quote_for_start_date: 1 });
  });

  it("does not offer a rename, a past date, a change of a year or any status but cancelled", () => {
    expect(classify([race({ name: "New" })], [race({ start_date: "2027-06-05", name: "Old" })], [fact()], today).reasons).toEqual({ name_or_merge_also_changed: 1 });
    expect(classify([race({ start_date: "2026-01-02", end_date: "2026-01-02" })], [race({ start_date: "2026-01-01", end_date: "2026-01-02" })], [fact({ value: "2026-01-02" })], today).reasons).toEqual({ date_in_the_past: 1 });
    expect(classify([race({ start_date: "2028-09-01", end_date: "2028-09-01" })], [race({ start_date: "2027-06-12", end_date: "2028-09-01" })], [fact({ value: "2028-09-01" })], today).reasons).toEqual({ moved_more_than_a_year: 1 });
    expect(classify([race({ status: "tbc" })], [race()], [fact({ field: "status", value: "tbc" })], today).reasons).toEqual({ status_needs_a_person: 1 });
    expect(classify([race({ status: "cancelled" })], [race()], [fact({ field: "status", value: "cancelled", quote: "Závod je zrušen" })], today).ready).toHaveLength(1);
  });
});

describe("regulation disagreements preview", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { classify, sameTown } = require("../../../scripts/regulation-disagreements.cjs");
  const row = (over: Record<string, unknown> = {}) => ({ id: "r", name: "Race", start_date: "2027-06-12", end_date: null, municipality: "Brno", place: "Brno", country: "CZ", venue_town: "Brno", venue_name: null, venue_country: "CZ", schedule_from: "2027-06-12", schedule_to: "2027-06-12", ...over });

  it("treats spelling and grain as the same town, a different town as a difference", () => {
    expect(sameTown("Warszawa", "Warsaw")).toBe(true);
    expect(sameTown("Praha 5 Motol", "Praha Motol")).toBe(true);
    expect(sameTown("Šternberk", "Dalov")).toBe(false);
  });

  it("lists a different town, another country and a programme day outside the race", () => {
    const found = classify([row(), row({ id: "a", venue_town: "Praha", municipality: "Brno", place: "Brno" }), row({ id: "b", venue_country: "DE" }), row({ id: "c", schedule_to: "2027-06-14" })]);
    expect(found.place.map((r: { id: string }) => r.id)).toEqual(["a"]);
    expect(found.country.map((r: { id: string }) => r.id)).toEqual(["b"]);
    expect(found.dates.map((r: { id: string }) => r.id)).toEqual(["c"]);
  });

  it("says nothing about a race without a town or programme in its regulations", () => {
    const found = classify([row({ venue_town: null, venue_country: null, schedule_from: null, schedule_to: null })]);
    expect(found).toEqual({ place: [], country: [], dates: [] });
  });
});

describe("calendar gaps", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { gaps, heldNearby } = require("../../../scripts/source-yield-gaps.cjs");
  const day = new Map([["2027-05-01", ["Brdský Meandr 2027"]], ["2027-06-12", ["Moravia Divide"]]]);

  it("knows a race held under another listing, a day off, with the words in another order", () => {
    expect(heldNearby("Meandr Brdský", "2027-05-02", day)).toBe(true);
    expect(heldNearby("Zcela jiný závod", "2027-05-01", day)).toBe(false);
    expect(heldNearby("Brdský Meandr", "2027-05-05", day)).toBe(false);
  });

  it("keeps only races held nowhere and inside the catalogue's sports", () => {
    const checked = [{ url: "https://cal.test/", missing: [
      { name: "Brdský Meandr", date: "2027-05-01", sourceUrl: "https://cal.test/a" },
      { name: "Spreewald Triathlon", date: "2027-05-01", sourceUrl: "https://cal.test/b" },
      { name: "Granfondo Torino", date: "2027-04-18", sourceUrl: "https://cal.test/c", countryHint: "IT" },
      { name: "Granfondo Torino", date: "2027-04-18", sourceUrl: "https://cal.test/c2" },
    ] }];
    const out = gaps(checked, day);
    expect(out.gaps).toEqual([{ name: "Granfondo Torino", date: "2027-04-18", country: "IT", source: "https://cal.test/", url: "https://cal.test/c" }]);
    expect(out.dropped).toEqual({ held_nearby: 1, not_covered: 1 });
  });
});

describe("date proof from source reads", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { evidenceFacts, classify } = require("../../../scripts/date-proposals.cjs");
  const read = (event: Record<string, unknown>) => ({ event_id: "r", event: { startDate: "2027-06-12", sourceUrl: "https://o.test/", evidence: { quote: "Race 12. 6. 2027", sourceUrl: "https://o.test/", method: "page_text_near_name" }, ...event } });

  it("turns a read with a page quote into the start and end date facts, a one-day race ends where it starts", () => {
    const facts = evidenceFacts([read({}), read({ endDate: "2027-06-13" }), { event_id: "r", event: { startDate: "2027-06-12" } }]);
    expect(facts.filter((f: { field: string }) => f.field === "start_date")).toHaveLength(2);
    expect(facts.find((f: { field: string; value: string }) => f.field === "end_date")?.value).toBe("2027-06-12");
    expect(facts.some((f: { value: string }) => f.value === "2027-06-13")).toBe(true);
  });

  it("lets a change that wrote no fact of its own go out when a later read proves it", () => {
    const race = { id: "r", name: "Race", start_date: "2027-06-12", end_date: "2027-06-12", status: "scheduled", merged_into_id: null };
    const base = { ...race, start_date: "2027-06-05", end_date: "2027-06-05" };
    expect(classify([race], [base], [], "2026-11-20").ready).toEqual([]);
    expect(classify([race], [base], evidenceFacts([read({})]), "2026-11-20").ready).toHaveLength(1);
  });
});

describe("date sender", () => {
  it("moves the end first when the start moves later, and the start first when it moves earlier", async () => {
    const { orderColumns } = await import("../../../scripts/pipeline2-date-proposals");
    expect(orderColumns({ before: { start_date: "2027-06-05", end_date: "2027-06-05" }, after: { start_date: "2027-06-06", end_date: "2027-06-06" } })).toEqual(["end_date", "start_date"]);
    expect(orderColumns({ before: { start_date: "2027-06-06", end_date: "2027-06-06" }, after: { start_date: "2027-06-05", end_date: "2027-06-05" } })).toEqual(["start_date", "end_date"]);
    expect(orderColumns({ before: { end_date: "2027-04-11" }, after: { end_date: "2027-04-12" } })).toEqual(["end_date"]);
    expect(orderColumns({ before: { status: "scheduled" }, after: { status: "cancelled" } })).toEqual(["status"]);
  });

  it("skips columns already matching the server before taking max so set races do not starve pending ones", async () => {
    const { partitionServerMatches } = await import("../../../scripts/pipeline2-date-proposals");
    const proof = { quote: "q", source_url: "https://example.test", method: "manual_date_fix" };
    const ready: Parameters<typeof partitionServerMatches>[0] = [
      { id: "already", name: "LAWI Tour", before: { start_date: "2027-08-30", end_date: "2027-08-30" }, after: { start_date: "2027-08-29", end_date: "2027-08-29" }, proofs: { start_date: proof, end_date: proof } },
      { id: "partial", name: "Partial Race", before: { start_date: "2027-06-05", end_date: "2027-06-05" }, after: { start_date: "2027-06-06", end_date: "2027-06-06" }, proofs: { start_date: proof, end_date: proof } },
      { id: "pending", name: "Gravel Trans Jura", before: { start_date: "2027-06-03" }, after: { start_date: "2027-06-02" }, proofs: { start_date: proof } },
      { id: "cancelled", name: "Cancelled Race", before: { status: "scheduled" }, after: { status: "cancelled" }, proofs: { status: proof } },
    ];
    const serverById = new Map([
      ["already", { id: "already", start_date: "2027-08-29", end_date: "2027-08-29", status: "scheduled" }],
      ["partial", { id: "partial", start_date: "2027-06-06", end_date: "2027-06-05", status: "scheduled" }],
      ["pending", { id: "pending", start_date: "2027-06-03", end_date: "2027-06-09", status: "scheduled" }],
      ["cancelled", { id: "cancelled", start_date: "2027-07-01", end_date: null, status: "cancelled" }],
    ]);
    const { todo, skipped } = partitionServerMatches(ready, serverById);
    expect(skipped).toEqual([
      { race: "LAWI Tour", column: "start_date", to: "2027-08-29" },
      { race: "LAWI Tour", column: "end_date", to: "2027-08-29" },
      { race: "Partial Race", column: "start_date", to: "2027-06-06" },
      { race: "Cancelled Race", column: "status", to: "cancelled" },
    ]);
    expect(todo.map(entry => ({ id: entry.item.id, columns: entry.columns }))).toEqual([
      { id: "partial", columns: ["end_date"] },
      { id: "pending", columns: ["start_date"] },
    ]);
  });
});

describe("held backlog", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { summarizeHeld } = require("../../../scripts/held-backlog.cjs");
  const row = (id: string, because: string[]) => JSON.stringify({ tab: "public.events", op: "update", pk: { id }, heldBecause: because });
  const day = 86_400_000, now = Date.parse("2026-11-20T10:00:00Z");

  it("counts past-day races apart and keeps the age of the others", () => {
    const first = summarizeHeld([row("a", ["no_future_date"]), row("b", ["name"]), row("c", ["no_future_date", "may_already_be_listed"])], {}, now - 3 * day);
    expect(first).toMatchObject({ actionable: 2, past: 1 });
    const later = summarizeHeld([row("b", ["name"]), row("d", ["end_date"])], first.since, now);
    expect(later.oldestDays).toBe(3);
    expect(Object.keys(later.since).sort()).toEqual(["b", "d"]);
  });

  it("has nothing to report for an empty plan", () => {
    expect(summarizeHeld([""], {}, now)).toMatchObject({ actionable: 0, past: 0, oldestDays: 0, oldestSince: null });
  });
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
    // Judged two different races, with quoted pages: that listed race no longer holds this one back.
    expect(newRaceProblems({ ...race }, place, [same], "2026-11-05", new Set([[race.id, same.id].sort().join("|")]))).not.toContain("may_already_be_listed");
    expect(newRaceProblems({ ...race }, place, [same], "2026-11-05", new Set(["someone|else"]))).toContain("may_already_be_listed");
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

it("treats a later day of a multi-day race as that race, and nothing else", () => {
  expect(isDayOfStoredRace("2026-11-15", "2026-11-14", "2026-11-15")).toBe(true);
  expect(isDayOfStoredRace("2026-07-18", "2026-07-17", "2026-07-19")).toBe(true);
  expect(isDayOfStoredRace("2026-07-20", "2026-07-17", "2026-07-19")).toBe(false);
  expect(isDayOfStoredRace("2026-07-16", "2026-07-17", "2026-07-19")).toBe(false);
  expect(isDayOfStoredRace("2026-07-17", "2026-07-17", "2026-07-17")).toBe(false);
  expect(isDayOfStoredRace("2026-07-18", "2026-07-17", null)).toBe(false);
});

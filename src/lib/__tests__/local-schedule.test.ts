import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { nextRunAt, moreWorkLeft, CARRY_ON_MS, SHORTEST_WAIT_MS, LONGEST_WAIT_MS } = require("../../../scripts/local-schedule.cjs");
const { organiserDue, targetNeeded, coverageFrom, run, stepError, sanitizeError } = require("../../../scripts/local-cycle.cjs");
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

describe("whether a cycle goes straight on", () => {
  it("goes on while it is reading sources that are still due", () => {
    expect(moreWorkLeft({ readAttempts: 12, dueAfter: 40 })).toBe(true);
  });
  it("does not go on for sources the reader never takes", () => {
    expect(moreWorkLeft({ readAttempts: 0, dueAfter: 3 })).toBe(false);
  });
  it("does not go on because a page was read while other rows sit due", () => {
    expect(moreWorkLeft({ readAttempts: 0, dueAfter: 3, organiserRead: 1, organiserUnread: 0 })).toBe(false);
  });
  it("does not go on for races that keep being refused", () => {
    expect(moreWorkLeft({ organiserRead: 0, organiserPublished: 0, organiserUnread: 0, organiserDeferred: false })).toBe(false);
    expect(moreWorkLeft({ organiserRead: 0, organiserPublished: 0, organiserDeferred: true })).toBe(false);
  });
  it("goes on while organiser pages are left unread or a pass ran out of time after moving something", () => {
    expect(moreWorkLeft({ organiserRead: 40, organiserUnread: 200 })).toBe(true);
    expect(moreWorkLeft({ organiserPublished: 2, organiserDeferred: true })).toBe(true);
  });
  it("copes with an unknown unread count", () => {
    expect(moreWorkLeft({ organiserRead: 4, organiserUnread: null })).toBe(false);
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
  it("gathers organiser pages falling due one by one instead of a cycle for each", () => {
    const due = { unreadPages: 0, nextDueAt: at(-1000) };
    expect(organiserDue(due, now, at(-60_000))).toBe(false);
    expect(organiserDue(due, now, at(-31 * 60_000))).toBe(true);
    expect(organiserDue({ unreadPages: 4 }, now, at(-60_000))).toBe(true);
  });
});

describe("capturing stderr and failure details from local-cycle steps", () => {
  it("keeps the error header above a Node stack trace and bounds to 300 chars", () => {
    const stderr = [
      "noise line",
      "Error: UCI API returned HTTP 403",
      "    at main (scripts/harvest-uci-directory.ts:42:11)",
      "    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
      "Node.js v22.23.2",
    ].join("\n");
    const detail = stepError({ stderr, code: 1 });
    expect(detail).toBe("noise line | Error: UCI API returned HTTP 403 | at main (scripts/harvest-uci-directory.ts:42:11)");
    expect(detail!.length).toBeLessThanOrEqual(300);
  });

  it("falls back to non-marker stdout lines when stderr is empty", () => {
    const output = "step_outcome {\"outcome\":\"failed\",\"reason\":\"exit_1\"}\nSomething broke on stdout\n";
    expect(stepError({ stderr: "", output, code: 1 })).toBe("Something broke on stdout");
    expect(stepError({ stderr: "", output: "", code: 1 })).toBeNull();
    expect(stepError({ stderr: "", output: "", message: "spawn ENOENT", code: null })).toBe("spawn ENOENT");
  });

  it("preserves a long error message ahead of a stack frame within 300 chars", () => {
    const longMsg = `Error: ${"x".repeat(400)}`;
    const detail = stepError({ stderr: `${longMsg}\n    at main (scripts/foo.ts:10)`, code: 1 });
    expect(detail!.startsWith("Error: x")).toBe(true);
    expect(detail!.length).toBeLessThanOrEqual(300);
  });

  it("redacts bearer tokens, JWTs, API keys, DB credentials, and query-param secrets", () => {
    const raw = [
      "Authorization: Bearer super_secret_token_value",
      "jwt=eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.sig12345678",
      "https://postgres:myPass123@db.example.com/postgres?apikey=secret123&ok=1",
      "CRON_SECRET=abc12345 sb_secret_abcdef123456 sk-ant-api03-abcdef123456",
    ].join("\n");
    const clean = sanitizeError(raw);
    expect(clean).not.toContain("super_secret_token_value");
    expect(clean).not.toContain("sig12345678");
    expect(clean).not.toContain("myPass123");
    expect(clean).not.toContain("secret123");
    expect(clean).not.toContain("abc12345");
    expect(clean).not.toContain("sb_secret_abcdef123456");
    expect(clean).not.toContain("sk-ant-api03-abcdef123456");
    expect(clean).toContain("ok=1");
  });

  it("captures child stderr on non-zero exit through bounded-pipeline-step.cjs", async () => {
    await expect(
      run(process.execPath, [
        "scripts/bounded-pipeline-step.cjs",
        "2",
        process.execPath,
        "-e",
        "console.error('Bearer tok_secret_12345678 UCI failed'); process.exit(1);",
      ]),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("UCI failed"),
    });
  });
});

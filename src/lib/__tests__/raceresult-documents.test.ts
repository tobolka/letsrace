import { afterEach, expect, it, vi } from "vitest";
import { raceResultDocument, registrationProgramme } from "@/lib/catalog/raceresult-documents";
import { fetchRaceResultProgramme, parseContestAdmission } from "@/lib/watcher/extractors/contest-categories";

afterEach(() => vi.unstubAllGlobals());

it("reads current public config endpoints and ignores participant records", async () => {
  const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("/registration/")
    ? { EventDate: "2026-10-17T00:00:00+02:00", EventDate2: "2026-10-17T00:00:00+02:00", Registrations: [{ Contests: [{ Name: "DETI - Mini", AgeStart: "2016-01-01", AgeEnd: "2017-12-31" }] }], Participants: [{ Name: "Private Participant" }] }
    : { InfoText: "<p>Ružomberské schody 2026</p><p>Kategórie U11, U13, Junior</p>" })));
  vi.stubGlobal("fetch", fetcher);
  const read = await raceResultDocument("https://my.raceresult.com/426889/", '<script type="application/ld+json">{"@type":"Event","name":"Ružomberské schody","startDate":"2026-10-17"}</script>');
  expect(read?.text).toContain("Ružomberské schody");
  expect(read?.text).toContain("DETI - Mini");
  expect(read?.text).not.toContain("Private Participant");
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["https://my.raceresult.com/426889/info/config?lang=en&sanitize=1", "https://my.raceresult.com/426889/registration/config?lang=en&sanitize=1"]);
  const programme = await fetchRaceResultProgramme("426889");
  expect(programme.startDate).toBe("2026-10-17");
  expect(programme.admissions).toEqual([{ name: "DETI - Mini", birthFrom: "2016-01-01", birthTo: "2017-12-31" }]);
});

it("does not discard an explicit cohort merely because its contest name is generic", () => {
  expect(parseContestAdmission({ name: "DETI - Mini", birthFrom: "2016-01-01", birthTo: "2017-12-31" }, 2026)).toEqual(["u11", "kids"]);
  expect(parseContestAdmission({ name: "CROSSCOUNTRY", birthFrom: "1900-01-01", birthTo: "2015-12-31" }, 2026)).toEqual(["u13", "u15", "u17", "youth", "junior", "amateur"]);
  expect(parseContestAdmission({ name: "Main race", birthFrom: "1936-01-01", birthTo: "2011-12-31" }, 2026)).toEqual(["u17", "youth", "junior", "amateur"]);
  expect(parseContestAdmission({ name: "DETI - Baby", birthFrom: "2022-01-01", birthTo: "2026-09-01" }, 2026)).toEqual(["u7", "kids"]);
});

it("rejects sentinel and contradictory date limits as age evidence", () => {
  expect(parseContestAdmission({ name: "30 km", birthFrom: "1900-01-01", birthTo: "2100-12-31" }, 2026)).toEqual([]);
  expect(parseContestAdmission({ name: "30 km", birthFrom: "2015-01-01", birthTo: "2010-12-31" }, 2026)).toEqual([]);
  expect(registrationProgramme({ EventDate: "2027-07-04", Registrations: [{ Title: "Registration", Contests: [{ Name: "2er-Team" }] }] })).toContain("2027-07-04");
});

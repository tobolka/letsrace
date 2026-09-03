import { describe, expect, it } from "vitest";
import {
  disciplinesFromTags,
  isNaZavodyHost,
  parseNaZavodyPage,
  pragueDate,
} from "@/lib/watcher/extractors/nazavody";

describe("isNaZavodyHost", () => {
  it("matches the site and its www form", () => {
    expect(isNaZavodyHost("www.nazavody.cz")).toBe(true);
    expect(isNaZavodyHost("nazavody.cz")).toBe(true);
    expect(isNaZavodyHost("nazavody.example.com")).toBe(false);
  });
});

describe("pragueDate", () => {
  it("reads a local midnight start as the day it actually is", () => {
    // What their API sends for a race on Friday 4 September 2026.
    expect(pragueDate("2026-09-03T22:00:00.000Z")).toBe("2026-09-04");
  });

  it("still gets winter right, when the offset is an hour smaller", () => {
    expect(pragueDate("2027-01-21T23:00:00.000Z")).toBe("2027-01-22");
  });
});

describe("disciplinesFromTags", () => {
  it("reads the platform's own cycling tags", () => {
    expect(disciplinesFromTags(["MTB"])).toEqual(["mtb"]);
    expect(disciplinesFromTags(["Silniční cyklistika"])).toEqual(["road"]);
  });

  it("keeps a bike race that shares its morning with a run", () => {
    // Osečanská Šlapka / Běhna: one race on bikes, one on foot.
    expect(disciplinesFromTags(["MTB", "Běh"])).toEqual(["mtb"]);
    expect(disciplinesFromTags(["MTB", "Dětské", "Rodinné"])).toEqual(["mtb"]);
  });

  it("refuses an adventure race that merely includes a bike leg", () => {
    expect(
      disciplinesFromTags(["Ostatní", "Běh", "Inline", "Kros běh", "MTB", "Noční", "Týmy"]),
    ).toBeNull();
  });

  it("refuses triathlon and duathlon outright", () => {
    expect(disciplinesFromTags(["Triatlon", "Běh", "Maraton", "Silniční cyklistika"])).toBeNull();
    expect(disciplinesFromTags(["Duatlon", "Dětské"])).toBeNull();
  });

  it("refuses a race with no bike tag at all", () => {
    expect(disciplinesFromTags(["Běh", "Dětské", "Rodinné"])).toBeNull();
  });
});

describe("parseNaZavodyPage", () => {
  const page = {
    months: [
      {
        dateRanges: [
          {
            startDate: "2026-09-03T22:00:00.000Z",
            endDate: "2026-09-04T16:30:00.000Z",
            races: [
              {
                id: 865,
                slug: "865-barevny-beh-4-9-2026",
                name: "Barevný běh 4.9.2026",
                datetime: "2026-09-03T22:00:00.000Z",
                place: "Město Touškov",
                tags: ["Běh", "Dětské", "Rodinné"],
              },
              {
                id: 777,
                slug: "777-baby-downhill-n-5-trailpark-bukovka",
                name: "Baby Downhill n.5. - Trailpark Bukovka",
                datetime: "2026-09-11T22:00:00.000Z",
                place: "Mlýnický Dvůr",
                tags: ["MTB", "Dětské", "Rodinné"],
              },
            ],
          },
        ],
      },
    ],
  };

  it("keeps the bike race and drops the running one", () => {
    const events = parseNaZavodyPage(page);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("Baby Downhill n.5. - Trailpark Bukovka");
    expect(events[0].externalId).toBe("nazavody-777");
    expect(events[0].discipline).toEqual(["mtb"]);
    expect(events[0].placeText).toBe("Mlýnický Dvůr");
    expect(events[0].countryHint).toBe("CZ");
  });

  it("dates it in Prague, not UTC", () => {
    expect(parseNaZavodyPage(page)[0].startDate).toBe("2026-09-12");
  });

  it("sends riders to the page they can actually enter on", () => {
    const [ev] = parseNaZavodyPage(page);
    expect(ev.registrationUrl).toBe(
      "https://www.nazavody.cz/zavod/777-baby-downhill-n-5-trailpark-bukovka/",
    );
  });

  it("leaves a one-day race without an end date", () => {
    expect(parseNaZavodyPage(page)[0].endDate).toBeUndefined();
  });
});

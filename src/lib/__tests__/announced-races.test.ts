import { describe, expect, it } from "vitest";
import {
  isYearSpecificUrl, likelySameRace, planNewRace, planUpdate, statedAges, validateAnnouncement,
  type Announcement, type PreviousEdition,
} from "@/lib/catalog/announced-races";

const previous: PreviousEdition = {
  slug: "elimon-xc-strizak-2026", location_id: "loc-strizak", disciplines: ["xco"], formats: ["xco"],
  audience: "mixed", level: "regional", competition_type: "regional", event_type: "race",
  age_categories: ["u7", "kids", "amateur"], website_url: "https://www.ustimtbcup.cz/", timezone: "Europe/Prague", class_label: null,
};
const ann: Announcement = {
  source: "https://www.facebook.com/Ustimtbcup",
  facebook: "https://www.facebook.com/Ustimtbcup",
  races: [{ start: "2027-05-23", name: "ELIMON XC Střížák", quote: "23. 5. 2027 XC STŘÍŽÁK", previous: "elimon-xc-strizak-2026" }],
};

describe("announced races", () => {
  it("rejects a race without its quote or a way to know where it is", () => {
    expect(() => validateAnnouncement({ source: "https://x.cz", races: [{ start: "2027-05-23", name: "X" }] }))
      .toThrow(/quote is required[\s\S]*needs previous/);
    expect(() => validateAnnouncement({ source: "https://x.cz", races: [{ start: "2027-5-3", name: "X", quote: "q", previous: "p" }] }))
      .toThrow(/YYYY-MM-DD/);
    expect(validateAnnouncement(ann)).toBe(ann);
  });

  it("carries venue, discipline and categories from the previous edition, marked as such", () => {
    const { row, inherited } = planNewRace(ann.races[0]!, ann, previous);
    expect(row).toMatchObject({
      location_id: "loc-strizak", disciplines: ["xco"], age_categories: ["u7", "kids", "amateur"],
      age_confidence: "previous", website_url: "https://www.ustimtbcup.cz/", season: "2027",
      registration_url: null, regulations_url: null, status: "scheduled",
      facebook_url: "https://www.facebook.com/Ustimtbcup",
    });
    expect(inherited.map((f) => f.field)).toEqual(["disciplines", "location_id", "age_categories", "website_url"]);
  });

  it("never carries a link that names last year's edition", () => {
    expect(isYearSpecificUrl("https://www.kolarna.eu/kolarna-cba-odersky-pohar-2026/")).toBe(true);
    expect(isYearSpecificUrl("https://www.ustimtbcup.cz/")).toBe(false);
    const { row } = planNewRace(ann.races[0]!, ann, { ...previous, website_url: "https://x.cz/zavod-2026/" });
    expect(row.website_url).toBeNull();
  });

  it("uses the announcement's own classes over last year's and calls them confirmed", () => {
    const race = { ...ann.races[0]!, classes: ["odrážedla 0–6 let", "jízdní kola 6–10 let"] };
    expect(statedAges(race)).toEqual(["u7", "u9", "u11", "kids"]);
    expect(planNewRace(race, ann, previous).row).toMatchObject({ age_categories: ["u7", "u9", "u11", "kids"], age_confidence: "explicit" });
  });

  it("gives cyclocross its winter season", () => {
    const race = { start: "2026-11-28", name: "Cyklokros Zábřeh", quote: "28. 11. 2026", locationId: "l", disciplines: ["cx"] };
    expect(planNewRace(race, ann, null).row.season).toBe("2026/27");
  });

  it("updates an existing record only with what the announcement confirms", () => {
    expect(planUpdate({ ...ann.races[0]!, classes: ["žáci 11–14 let"] }, { ...ann, facebook: undefined }, ["junior", "masters"])).toEqual({
      start_date: "2027-05-23", end_date: "2027-05-23", status: "scheduled",
      age_categories: ["u13", "u15", "youth", "junior", "masters"], age_confidence: "explicit",
    });
    expect(planUpdate(ann.races[0]!, ann).facebook_url).toBe("https://www.facebook.com/Ustimtbcup");
    // A poster shared by someone else's page does not make that page the race's.
    expect(planUpdate(ann.races[0]!, { ...ann, facebook: undefined }).facebook_url).toBeUndefined();
  });

  it("recognises a same-day record of the same race", () => {
    expect(likelySameRace("ELIMON XC Střížák + časovka", "ELIMON XC STŘÍŽÁK")).toBe(true);
    // A poster title and a series round share only the town: the script catches these by place.
    expect(likelySameRace("Cyklokros Zábřeh", "Oderský pohár — Zábřeh na Moravě (velké finále)")).toBe(false);
    expect(likelySameRace("Cyklokros Zábřeh", "Nürnberg Cross Cup")).toBe(false);
  });
});

describe("facebook page links", () => {
  it("keeps Facebook pages tidy and refuses anything else", async () => {
    const { facebookPageUrl } = await import("@/lib/watcher/public-url");
    expect(facebookPageUrl("https://m.facebook.com/Ustimtbcup/?ref=page_internal")).toBe("https://www.facebook.com/Ustimtbcup");
    expect(facebookPageUrl("http://facebook.com/profile.php?id=615&__tn__=x")).toBe("https://www.facebook.com/profile.php?id=615");
    expect(facebookPageUrl("https://www.ustimtbcup.cz/")).toBeNull();
    expect(facebookPageUrl("https://www.facebook.com/")).toBeNull();
    expect(facebookPageUrl("")).toBeNull();
  });
});

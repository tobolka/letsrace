import { describe, expect, it } from "vitest";
import { decideEdition, editionNeutralName, editionWindows, matchAnnouncedEdition, type EditionAnswer, type EditionRace } from "@/lib/catalog/next-edition";
import { findNextEdition, type EditionIdentity } from "@/lib/catalog/edition-identity";

const race: EditionRace = {
  id: "a4639a53-0e95-4bed-a234-efe70a9ad186", name: "HSF System Bike Čeladná 2026", start_date: "2026-08-22",
  website_url: "https://bikeceladna.cz/", disciplines: ["xco"], municipality: "Čeladná", country: "CZ", lat: 49.55, lng: 18.34, event_type: "race",
};
const page = { url: "https://bikeceladna.cz/14-rocnik-zavodu-bude-21-8-2027/", title: "14. ročník závodu bude 21.8.2027!", text: "Zapište si do kalendáře – na startu dalšího ročníku se potkáme v sobotu 21.8.2027! Registrace budou spuštěny v průběhu února." };
const answer: EditionAnswer = { sameRace: true, cycling: true, announced: true, startDate: "2027-08-21", endDate: null, quote: "na startu dalšího ročníku se potkáme v sobotu 21.8.2027!", newPlace: null };
const decide = (changes: Partial<EditionAnswer> = {}, extra: Partial<Parameters<typeof decideEdition>[0]> = {}) =>
  decideEdition({ race, page, answer: { ...answer, ...changes }, year: 2027, today: "2026-11-04", ...extra });

describe("next edition decision", () => {
  it("publishes an explicit announcement from the race's own website", () => {
    const decision = decide();
    expect(decision.state).toBe("publish");
    if (decision.state !== "publish") return;
    expect(decision.event).toMatchObject({ name: "HSF System Bike Čeladná", startDate: "2027-08-21", placeText: "Čeladná", countryHint: "CZ", discipline: ["xco"], sourceUrl: page.url });
    expect(decision.event.evidence?.quote).toBe(answer.quote);
  });

  it.each([
    ["model says not announced", { announced: false }, "not_announced_on_page"],
    ["another event", { sameRace: false }, "page_about_another_event"],
    ["not ridden", { cycling: false }, "not_cycling"],
    ["old year", { startDate: "2026-08-22" }, "date_outside_edition"],
    ["invented quote", { quote: "Závod se koná 21.8.2027" }, "quote_not_on_page"],
    ["date differs from the quote", { startDate: "2027-08-22" }, "quote_does_not_state_date"],
  ])("waits: %s", (_label, changes, reason) => {
    expect(decide(changes)).toEqual({ state: "wait", reason });
  });

  it("does not take a registration deadline for the race day", () => {
    const text = "Uzávěrka přihlášek 7.8.2027 ve 12:00.";
    expect(decide({ startDate: "2027-08-07", quote: "Uzávěrka přihlášek 7.8.2027 ve 12:00." }, { page: { ...page, text } })).toEqual({ state: "wait", reason: "date_may_be_a_deadline" });
  });

  it.each(["Uzávěrka přihlášek závodu 21.8.2027.", "Registrace na další ročník končí 21.8.2027.", "Race registration deadline: 21.8.2027."])("rejects a deadline even when it mentions the race: %s", text => {
    expect(decide({ quote: text }, { page: { ...page, text } })).toEqual({ state: "wait", reason: "date_may_be_a_deadline" });
  });

  it("accepts an independently stated race date beside a registration announcement", () => {
    const text = "Závod se koná 21.8.2027, registrace se brzy otevřou.";
    expect(decide({ quote: text }, { page: { ...page, text } }).state).toBe("publish");
  });

  it("does not accept a provisional date", () => {
    const text = "Předběžný termín 21.8.2027.";
    expect(decide({ quote: text }, { page: { ...page, text } })).toEqual({ state: "wait", reason: "tentative_date" });
  });

  it("does not assign a date from a shared calendar or foreign site", () => {
    expect(decide({}, { page: { ...page, url: "https://sumator.cz/zavod/celadna" } })).toEqual({ state: "wait", reason: "shared_site" });
    expect(decide({}, { page: { ...page, url: "https://jiny-web.cz/celadna" } })).toEqual({ state: "wait", reason: "page_outside_race_website" });
  });

  it("requires the race name on an organiser site with several races", () => {
    expect(decide({}, { sharedHost: true, page: { ...page, url: "https://bikeceladna.cz/novinky", title: "Novinky" }, race: { ...race, name: "Beskydský okruh 2026" } })).toEqual({ state: "wait", reason: "shared_site_name_not_confirmed" });
    expect(decide({}, { sharedHost: true, page: { ...page, title: "HSF System Bike Čeladná 2027" } }).state).toBe("publish");
  });

  it("does not let the organiser name or town identify a race on a shared site", () => {
    const shared = { url: "https://bavsesportem.cz/cyklistickey-race-2027/", title: "Cyklistickey Race 2027 - BAV SE SPORTEM", text: "Cyklistickey Race 2027 Termín: 1. 5. 2027 Místo: Choceň" };
    const other = { ...race, name: "Bav se sportem XCO Choceň", municipality: "Choceň", website_url: "https://bavsesportem.cz/" };
    expect(decide({ startDate: "2027-05-01", quote: "Termín: 1. 5. 2027 Místo: Choceň" }, { sharedHost: true, page: shared, race: other })).toEqual({ state: "wait", reason: "shared_site_name_not_confirmed" });
    const same = decide({ startDate: "2027-05-01", quote: "Termín: 1. 5. 2027 Místo: Choceň" }, { sharedHost: true, page: shared, race: { ...other, name: "Cyklistickey MTB Race" } });
    expect(same.state).toBe("publish");
  });

  it("holds multisport events for review", () => {
    const text = "Orlice Cup Hlavní týmový závod. Běh · MTB · Voda. Termín: 3. 4. 2027";
    expect(decide({ startDate: "2027-04-03", quote: "Termín: 3. 4. 2027" }, { page: { ...page, text } })).toEqual({ state: "wait", reason: "possibly_multisport" });
  });

  it("uses a stated new venue only when it stands on the page", () => {
    const text = `${page.text} Nově startujeme ve Frýdlantu.`;
    const moved = decide({ newPlace: "Frýdlantu" }, { page: { ...page, text } });
    expect(moved.state === "publish" && moved.event.placeText).toBe("Frýdlantu");
    expect(moved.state === "publish" && moved.event.lat).toBeUndefined();
    expect(decide({ newPlace: "Ostrava" })).toEqual({ state: "wait", reason: "new_place_not_on_page" });
  });

  it("holds races whose discipline is not known", () => {
    expect(decide({}, { race: { ...race, disciplines: ["other"] } })).toEqual({ state: "wait", reason: "discipline_unknown" });
  });
});

describe("existing edition identity", () => {
  const old: EditionIdentity = { id: "previous", name: race.name, start_date: race.start_date, series_id: null, disciplines: race.disciplines,
    location: { country_code: "CZ", municipality: "Čeladná", lat: 49.55, lng: 18.34 } };
  const current = { ...old, id: "current", name: "HSF System Bike Čeladná 2027", start_date: "2027-08-21", end_date: null };
  const announced = () => {
    const result = decide();
    if (result.state !== "publish") throw Error("Expected an announcement");
    return result.event;
  };

  it("does not call a same-name race abroad the next edition", () => {
    const abroad = { ...current, location: { ...current.location!, country_code: "PL" } };
    expect(findNextEdition(old, [abroad])).toBeNull();
    expect(matchAnnouncedEdition(announced(), [abroad]).state).toBe("missing");
  });

  it("does not match an unrelated race on the same day in the same town", () => {
    expect(matchAnnouncedEdition(announced(), [{ ...current, name: "Beskydský okruh" }]).state).toBe("missing");
  });

  it("matches an announcement with the same race and preserves ambiguity", () => {
    expect(matchAnnouncedEdition(announced(), [current])).toEqual({ state: "found", event: current });
    const duplicate = { ...current, id: "second" };
    expect(findNextEdition(old, [current, duplicate])).toBeNull();
    expect(matchAnnouncedEdition(announced(), [current, duplicate]).state).toBe("ambiguous");
  });

  it("holds a same-name edition whose date, venue or duration disagrees", () => {
    for (const changed of [
      { ...current, start_date: "2027-08-22" },
      { ...current, end_date: "2027-08-22" },
      { ...current, location: { ...current.location!, lat: 50.1, lng: 14.4, municipality: "Praha" } },
    ]) expect(matchAnnouncedEdition(announced(), [changed]).state).toBe("ambiguous");
  });

  it("does not match another round whose normalised annual name is identical", () => {
    const first = { ...old, name: "Beskydský pohár — 1. kolo" };
    const second = { ...current, name: "Beskydský pohár — 2. kolo" };
    expect(findNextEdition(first, [second])).toBeNull();
  });
});

describe("edition helpers", () => {
  it.each([
    ["Žernovský bajk - XXIV. ročník", "Žernovský bajk"],
    ["HSF System Bike Čeladná 2026", "HSF System Bike Čeladná"],
    ["25. Sudety Tour 2026/27", "Sudety Tour"],
    ["2026", "2026"],
  ])("removes the year and edition from %s", (name, expected) => {
    expect(editionNeutralName(name)).toBe(expected);
  });

  it("shows the model the opening and the passages around the year", () => {
    const windows = editionWindows(`Úvod závodu. ${"x ".repeat(2000)} Další ročník bude 21.8.2027. ${"y ".repeat(2000)}`, 2027);
    expect(windows).toContain("Úvod závodu");
    expect(windows).toContain("21.8.2027");
    expect(windows.length).toBeLessThan(1_500);
  });
});

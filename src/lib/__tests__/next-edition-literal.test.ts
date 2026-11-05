import { describe, expect, it } from "vitest";
import { datesInLine, literalEditionAnswer } from "@/lib/catalog/next-edition-literal";
import { decideEdition, type EditionRace } from "@/lib/catalog/next-edition";
import { fold } from "@/lib/text-match";

const race: EditionRace = { id: "a4639a53-0e95-4bed-a234-efe70a9ad186", name: "HSF System Bike Čeladná 2026", start_date: "2026-08-22", website_url: "https://bikeceladna.cz/", disciplines: ["xco"], municipality: "Čeladná", country: "CZ", event_type: "race" };
const read = (text: string, over: Partial<EditionRace & { end_date: string | null }> = {}, url = "https://bikeceladna.cz/", title = "HSF System Bike Čeladná", ownPage = false) =>
  literalEditionAnswer({ race: { ...race, ...over }, page: { url, title, text }, year: 2027, ownPage });
const start = (result: ReturnType<typeof read>) => result.state === "answer" ? result.answer.startDate : result.reason;

describe("dates stated in a line", () => {
  it.each([
    ["18.4.2027", "2027-04-18", undefined],
    ["28. 9. 2027 · start 11:00", "2027-09-28", undefined],
    ["18. dubna 2027", "2027-04-18", undefined],
    ["2027-04-18", "2027-04-18", undefined],
    ["April 18, 2027", "2027-04-18", undefined],
    ["26 Settembre 2027", "2027-09-26", undefined],
    ["4 września 2027", "2027-09-04", undefined],
    ["3.-10.4.2027", "2027-04-03", "2027-04-10"],
    ["30.4.-2.5.2027", "2027-04-30", "2027-05-02"],
    ["19. + 20. Juni 2027", "2027-06-19", "2027-06-20"],
    ["3. und 4. April 2027", "2027-04-03", "2027-04-04"],
    ["10 - 12 settembre 2027", "2027-09-10", "2027-09-12"],
  ])("%s", (text, begin, end) => {
    const [date] = datesInLine(fold(text), 2027);
    expect(date?.start).toBe(begin);
    expect(date?.end).toBe(end);
  });

  it("ignores impossible dates and slashes, whose order is unclear", () => {
    expect(datesInLine(fold("31.2.2027"), 2027)).toEqual([]);
    expect(datesInLine(fold("10/3/2027"), 2027)).toEqual([]);
    expect(datesInLine(fold("18.4.2026"), 2027)).toEqual([]);
  });
});

describe("reading an announcement without a model", () => {
  it("answers for one plain date on the race's own front page, and the shared gate accepts it", () => {
    const page = { url: "https://bikeceladna.cz/", title: "HSF System Bike Čeladná", text: "14. ročník závodu bude 21.8.2027!" };
    const result = literalEditionAnswer({ race, page, year: 2027 });
    expect(result.state).toBe("answer");
    if (result.state !== "answer") return;
    expect(decideEdition({ race, page, answer: result.answer, year: 2027, today: "2026-11-05" }).state).toBe("publish");
  });

  it.each([
    ["registration date", "Registrace od 1.3.2027", "literal_no_race_date_on_page"],
    ["deadline after a preposition", "Cena platí do 21.8.2027", "literal_no_race_date_on_page"],
    ["a bare date beside the opening of entries", "Anmeldung 2027\n21.8.2027\n+++ONLINE-ANMELDESTART+++", "literal_no_race_date_on_page"],
    ["afterparty", "Termín pro afterparty 2027 je 21.8.2027", "literal_no_race_date_on_page"],
    ["a date marked as expected", "Termin 2027: voraussichtlich 21.08.2027", "literal_no_race_date_on_page"],
    ["a calendar that does not say which date is this race's", "5.6.2027 Závod A\n21.8.2027 Závod B", "literal_several_dates_on_page"],
    ["a date far from last year's", "Další závod: 3.4.2027", "literal_date_far_from_last_edition"],
    ["someone else's event in a sentence", "21. 8. 2027 – náš spolupořadatel Jan Novák pořádá v rodném městě už 4. ročník jiné soutěže na kolech.", "literal_sentence_about_something_else"],
  ])("waits on %s", (_label, text, reason) => expect(start(read(text))).toBe(reason));

  it("takes the date of the line naming the race from a calendar", () => {
    expect(start(read("5.6.2027 Závod A\n21.8.2027 HSF System Bike Čeladná"))).toBe("2027-08-21");
  });

  it("does not take a town on a calendar for the race", () => {
    expect(start(read("5.6.2027 Závod A\n21.8.2027 • Čeladná", { name: "Čeladná 6H" }))).toBe("literal_several_dates_on_page");
  });

  it("treats a range and the days inside it as one date", () => {
    const result = read("27. a 28. srpna 2027\n28.8.2027", { end_date: "2026-08-23" });
    expect(result.state === "answer" && [result.answer.startDate, result.answer.endDate]).toEqual(["2027-08-27", "2027-08-28"]);
  });

  it("does not give a festival's ten days to a one-day race", () => {
    expect(start(read("Festival se uskuteční 13.–22. srpna 2027"))).toBe("literal_range_longer_than_the_race");
  });

  it("requires more than a shared word of the name, and a site's name only on its own address", () => {
    const gfny = { name: "GFNY Bremen", website_url: "https://bremen.gfny.com/", start_date: "2026-08-30", country: "DE" };
    expect(start(read("August 8, 2027", gfny, "https://bremen.gfny.com/gfny-is-coming-to-denmark/", "GFNY is coming to Denmark - GFNY Bremen"))).toBe("literal_race_not_named_on_page");
    expect(start(read("August 8, 2027", gfny, "https://bremen.gfny.com/", "Welcome"))).toBe("2027-08-08");
  });

  it("leaves rides, forums, numbered rounds and sites of another country alone", () => {
    expect(start(read("21.8.2027", { name: "Čeladná cykloturistika" }, "https://bikeceladna.cz/", "Čeladná cykloturistika"))).toBe("literal_not_a_race");
    expect(start(read("21.8.2027", {}, "https://bikeceladna.cz/forum/1", "HSF System Bike Čeladná"))).toBe("literal_forum_page");
    expect(start(read("21.8.2027", { name: "HSF System Bike Čeladná #3" }))).toBe("literal_round_of_a_series");
    expect(start(read("21.8.2027", {}, "https://cyclechallenge.ae/", "HSF System Bike Čeladná"))).toBe("literal_site_in_another_country");
  });

  it("accepts a numbered round on the page only that race links to", () => {
    expect(start(read("21.8.2027", { name: "HSF System Bike Čeladná #3" }, "https://bikeceladna.cz/zavod-3/", "HSF System Bike Čeladná #3", true))).toBe("2027-08-21");
  });
});

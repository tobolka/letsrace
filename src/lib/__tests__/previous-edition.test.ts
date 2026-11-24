import { describe, expect, it } from "vitest";
import { editionKey } from "@/lib/catalog/previous-edition";
import { findNextEdition, findPreviousEdition, type EditionIdentity } from "@/lib/catalog/edition-identity";

const identity = (id: string, date: string, name = "Koolna"): EditionIdentity => ({ id, name, start_date: date, series_id: null, disciplines: ["xco"], location: { lat: 50, lng: 14, country_code: "CZ", municipality: "Praha" } });
describe("shared annual identity", () => {
  it("links back from an older edition to the uniquely identified later one", () => {
    const old = identity("old", "2026-06-01", "31. ročník Českopetrovická koolna 2026");
    const next = identity("new", "2027-05-30", "32. ročník Českopetrovická koolna 2027");
    expect(findNextEdition(old, [old, next])).toEqual(next);
    expect(findNextEdition(old, [next])).toEqual(next);
    expect(findNextEdition(old, [old])).toBeNull();
    expect(findNextEdition(old, [old, next, { ...next, id: "ambiguous" }])).toBeNull();
    expect(findNextEdition(old, [old, { ...old, id: "other-old" }, next])).toBeNull();
    expect(findNextEdition(old, [identity("later", "2028-06-01", "33. ročník Českopetrovická koolna 2028")], 2)?.id).toBe("later");
  });
  it("does not link a different round, country, place or discipline as the next edition", () => {
    const old = { ...identity("old", "2026-06-01", "Cup kolo 1"), series_id: "cup" };
    const next = { ...identity("new", "2027-06-01", "Cup kolo 2"), series_id: "cup" };
    expect(findNextEdition(old, [old, next])).toBeNull();
    expect(findNextEdition(old, [{ ...old, id: "new", start_date: "2027-06-01", disciplines: ["road"] }])).toBeNull();
    expect(findNextEdition(old, [{ ...old, id: "new", start_date: "2027-06-01", location: { ...old.location!, country_code: "DE" } }])).toBeNull();
    expect(findNextEdition(old, [{ ...old, id: "new", start_date: "2027-06-01", location: { ...old.location!, lat: 51 } }])).toBeNull();
  });
  it("uses the same unique match for inheritance and older-edition links", () => {
    const current = identity("new", "2027-06-01", "32. ročník Českopetrovická koolna 2027");
    const previous = identity("old", "2026-05-30", "31. ročník Českopetrovická koolna 2026");
    expect(findPreviousEdition(current, [previous])).toEqual(previous);
    expect(findPreviousEdition(current, [previous, { ...previous, id: "uncertain" }])).toBeNull();
    expect(findPreviousEdition(current, [identity("older", "2025-06-01", "30. ročník Českopetrovická koolna 2025")], 2)?.id).toBe("older");
  });
  it("keeps rounds, disciplines and annual records distinct", () => {
    const current = { ...identity("new", "2027-06-01", "Cup kolo 2"), series_id: "cup" };
    expect(findPreviousEdition(current, [{ ...identity("old", "2026-06-01", "Cup kolo 1"), series_id: "cup" }])).toBeNull();
    expect(findPreviousEdition(identity("new", "2027-06-01"), [{ ...identity("old", "2026-06-01"), disciplines: ["road"] }])).toBeNull();
  });
  it("matches compatible discipline families like mtb/xco and road/road_race", () => {
    const oldMtb = { ...identity("old-mtb", "2026-06-01", "Velká cena Touškova"), disciplines: ["mtb"] };
    const newXco = { ...identity("new-xco", "2027-06-05", "Velká cena Touškova"), disciplines: ["xco"] };
    expect(findNextEdition(oldMtb, [newXco])).toEqual(newXco);
    const oldRoad = { ...identity("old-road", "2026-08-09", "Most - Lesná 2026"), disciplines: ["road"] };
    const newRoadRace = { ...identity("new-road", "2027-08-08", "Most - Lesná"), disciplines: ["road_race"] };
    expect(findNextEdition(oldRoad, [newRoadRace])).toEqual(newRoadRace);
  });
  it("matches recurring races across sponsor prefixes, discipline tags and subtitles at the same venue", () => {
    expect(
      findNextEdition(
        identity("old-1", "2026-06-13", "Krakonošův cyklomaraton"),
        [identity("new-1", "2027-06-12", "CASIA Krakonošův cyklomaraton")],
      )?.id,
    ).toBe("new-1");
    expect(
      findNextEdition(
        identity("old-2", "2026-03-28", "34. Internationale KTM Kamptal Trophy"),
        [identity("new-2", "2027-04-04", "35. KTM Kamptal Trophy - UCI XCO C1")],
      )?.id,
    ).toBe("new-2");
    expect(
      findNextEdition(
        identity("old-3", "2026-06-13", "Rusavská 50ka"),
        [identity("new-3", "2027-06-12", "Rusavská 50")],
      )?.id,
    ).toBe("new-3");
    // Generic cycling words alone must never match two different races in the same town.
    expect(
      findNextEdition(
        identity("old-4", "2026-06-01", "MTB Cup Praha"),
        [identity("new-4", "2027-06-02", "MTB Marathon Brno")],
      ),
    ).toBeNull();
  });
});

describe("editionKey", () => {
  it("drops the year and the edition number", () => {
    expect(editionKey("32. ročník Českopetrovická koolna 2026")).toBe(editionKey("31. ročník Českopetrovická koolna 2025"));
    expect(editionKey("XXXIX Ślężański Mnich")).toBe(editionKey("XL Ślężański Mnich"));
    expect(editionKey("Mikulášský cyklokros - Břeccross 2025")).toBe(editionKey("Mikulášský cyklokros - Břeccross 2026"));
    expect(editionKey("CycloCross im STEVENS-Cup 2026/2027 RG Wedel")).toBe(editionKey("CycloCross im STEVENS-Cup 2025/2026 RG Wedel"));
    expect(editionKey("79° COPPA AGOSTONI - GIRO DELLE BRIANZE")).toBe(editionKey("Coppa Agostoni - Giro delle Brianze"));
    expect(editionKey("Tour de Kosová2027")).toBe(editionKey("Tour de Kosová 2026"));
  });

  it("keeps what tells two races apart", () => {
    expect(editionKey("Oderský pohár — Zlaté Hory I.")).not.toBe(editionKey("Oderský pohár — Krnov"));
  });
});

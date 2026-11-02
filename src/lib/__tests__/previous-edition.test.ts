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
});

describe("editionKey", () => {
  it("drops the year and the edition number", () => {
    expect(editionKey("32. ročník Českopetrovická koolna 2026")).toBe(editionKey("31. ročník Českopetrovická koolna 2025"));
    expect(editionKey("XXXIX Ślężański Mnich")).toBe(editionKey("XL Ślężański Mnich"));
    expect(editionKey("Mikulášský cyklokros - Břeccross 2025")).toBe(editionKey("Mikulášský cyklokros - Břeccross 2026"));
    expect(editionKey("CycloCross im STEVENS-Cup 2026/2027 RG Wedel")).toBe(editionKey("CycloCross im STEVENS-Cup 2025/2026 RG Wedel"));
  });

  it("keeps what tells two races apart", () => {
    expect(editionKey("Oderský pohár — Zlaté Hory I.")).not.toBe(editionKey("Oderský pohár — Krnov"));
  });
});

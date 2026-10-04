import { describe, expect, it } from "vitest";
import { strongSameRace, type MergeDuplicateRow } from "@/lib/catalog/merge-duplicates";

const row = (id: string, name: string, extra: Partial<MergeDuplicateRow> = {}): MergeDuplicateRow => ({
  id,
  name,
  start_date: "2026-11-28",
  end_date: null,
  website_url: null,
  registration_url: null,
  series_id: null,
  fingerprint: null,
  disciplines: ["cx"],
  location: { lat: 53.7532, lng: 9.6524, municipality: "Elmshorn" },
  series: null,
  sources: [{ id: id, watched_url_id: `w-${id}`, external_id: null }],
  ...extra,
});

describe("strongSameRace", () => {
  it("pairs a bare round with the full listing of the same day and place", () => {
    expect(strongSameRace(row("a", "#13 - Elmshorn"), row("b", "CycloCross im Stevens-Cup 2026/2027 Elmshorn RG Uni Hamburg"))).toBe(true);
  });

  it("pairs two titles sharing a distinctive word", () => {
    expect(strongSameRace(row("a", "L'Eroica Gaiole"), row("b", "L'EROICA DI GAIOLE IN CHIANTI"))).toBe(true);
  });

  it("keeps apart two races from one calendar", () => {
    const shared = [{ id: "s", watched_url_id: "fci", external_id: null }];
    expect(
      strongSameRace(
        row("a", "NAZ. GP CICLI FRANCESCONI MEMORIAL CLAUDIA BONFANTI", { sources: shared }),
        row("b", "6° GP CICLI FRANCESCONI MEMORIAL GIUSEPPE FRANCESCONI", { sources: shared }),
      ),
    ).toBe(false);
  });

  it("keeps apart different formats, series and towns-only matches", () => {
    expect(strongSameRace(row("a", "Krajský přebor Pumptrack"), row("b", "Krajský přebor Bikros"))).toBe(false);
    expect(strongSameRace(row("a", "Cykloman — Závod do vrchu", { series_id: "x" }), row("b", "Cyklománek — Jízda do vrchu", { series_id: "y" }))).toBe(false);
    expect(strongSameRace(row("a", "50 COPPA COMUNE DI ELMSHORN"), row("b", "1 GP ELMSHORN IN ROSA"))).toBe(false);
  });
});

import { differentInstalment } from "@/lib/catalog/merge-duplicates";

describe("differentInstalment", () => {
  it("tells the first and the second of a season apart", () => {
    expect(differentInstalment("Povltavský bikerský pohár - První podzimní cross country", "Druhé podzimní cross country Povltavský bikerský pohár")).toBe(true);
    expect(differentInstalment("Oderský pohár — Zlaté Hory I.", "Oderský pohár — Zlaté Hory II.")).toBe(true);
  });
  it("leaves the same instalment and unnumbered names alone", () => {
    expect(differentInstalment("Povltavský bikerský pohár - První podzimní cross country", "První podzimní cross country Povltavský bikerský pohár")).toBe(false);
    expect(differentInstalment("Moravskotřebovský Cyklokros 2026", "Oderský pohár — Moravská Třebová")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { sameTitle } from "@/lib/catalog/llm-duplicates";

describe("sameTitle", () => {
  it("sees one race typed twice", () => {
    expect(sameTitle("TROFEO DELLE REGIONI 2026 - TAPPA CERVARO - 2^ PROVA CAMPIONATO REGIONALE", "TROFEO DELLE REGIONI 2^ TAPPA CERVARO -2^ prova CAMPIONATO REGIONALE")).toBe(true);
  });
  it("does not take a local name and a series round for the same title", () => {
    expect(sameTitle("Moravskotřebovský Cyklokros 2026", "Oderský pohár — Moravská Třebová")).toBe(false);
    expect(sameTitle("VGF Handbike Race", "VGF – Inclusion Race")).toBe(false);
  });
});

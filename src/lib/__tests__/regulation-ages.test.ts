import { describe, expect, it } from "vitest";
import { categoriesFromRegulationsText } from "@/lib/catalog/regulation-ages";

describe("categoriesFromRegulationsText", () => {
  it("reads the classes a propozice names", () => {
    const text = `Mezinárodní závod UCI C1 pro kategorie Muži ELITE+U23, ŽENY ELITE,
junioři

Národní závod JANEV CUP 2026 pro kategorie žáci, žákyně, kadeti, kadetky

Chýnov – sobota 3.10.2026`;
    expect(categoriesFromRegulationsText(text).ages).toEqual([
      "u13", "u15", "u17", "kids", "youth", "junior", "u23", "elite",
    ]);
  });

  it("reads nothing from a text that never names a class", () => {
    expect(categoriesFromRegulationsText("Startovné 300 Kč, prezentace od 8:00, trať 26 km.").ages).toEqual([]);
  });
});

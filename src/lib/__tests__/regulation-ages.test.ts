import { describe, expect, it } from "vitest";
import { categoriesFromRegulationsText, directDocumentUrl } from "@/lib/catalog/regulation-ages";

describe("categoriesFromRegulationsText", () => {
  it("unwraps an embedded Google document viewer into the source PDF", () => {
    expect(directDocumentUrl("https://docs.google.com/viewer?url=https%3A%2F%2Fclub.cz%2Frules.pdf&embedded=true")).toBe("https://club.cz/rules.pdf");
  });
  it("reads the classes a propozice names", () => {
    const text = `Mezinárodní závod UCI C1 pro kategorie Muži ELITE+U23, ŽENY ELITE,
junioři

Národní závod JANEV CUP 2026 pro kategorie žáci, žákyně, kadeti, kadetky

Chýnov – sobota 3.10.2026`;
    expect(categoriesFromRegulationsText(text).ages).toEqual([
      "u13", "u15", "u17", "youth", "junior", "u23", "elite",
    ]);
  });

  it("reads nothing from a text that never names a class", () => {
    expect(categoriesFromRegulationsText("Startovné 300 Kč, prezentace od 8:00, trať 26 km.").ages).toEqual([]);
  });

  it("reads a registration platform's age fields", () => {
    const text = "Klasyfikacje\n DZIECI 0-7 LAT\n Wiek\n 0-7\n Opłaty\n JUNIORZY\n Wiek\n 15-18\n MASTERS\n Wiek\n 40-99";
    // JUNIORZY admits ages 15–18: sixteen-year-olds must also match U17.
    expect(categoriesFromRegulationsText(text, 2026).ages).toEqual(["u7", "u9", "u17", "kids", "youth", "junior", "masters"]);
  });
});

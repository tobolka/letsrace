import { describe, expect, it } from "vitest";
import { categoriesFromRegulationsText, currentRegulationText, directDocumentUrl } from "@/lib/catalog/regulation-ages";

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


describe("regulation category edition evidence", () => {
  const url = "https://prazska50.cz/stranka/propozice/";
  const race = { name: "Pražská 50", startDate: "2027-09-18", ownUrls: [url] };
  it("rejects last year's regulations even when a sidebar announces next year's race", () => {
    const html = '<article class="entry-content"><h1>Pražská 50 – propozice</h1><p>Termín 19. září 2026</p><p>Kategorie U13, U15, Junioři, Muži Elite.</p></article><aside>Pražská 50 18. září 2027</aside>';
    expect(currentRegulationText({ url, text: "Pražská 50 19. září 2026 Kategorie U13 U15. Pražská 50 18. září 2027", html }, race)).toBeNull();
  });
  it("accepts the stated race date of the current edition", () => {
    const text = "Pražská 50 – propozice 18. září 2027\nKategorie U13, U15, Junioři, Muži Elite.";
    expect(currentRegulationText({ url, text }, race)).toBe(text);
  });
  it("rejects category names from an unrelated federation calendar", () => {
    expect(currentRegulationText({ url: "https://svaz.test/kalendar", text: "2027\nPražská 50 18. 9. 2027\nJiný závod: kategorie U13, U15" }, race)).toBeNull();
  });
});

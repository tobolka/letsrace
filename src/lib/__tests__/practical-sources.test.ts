import { expect, it } from "vitest";
import { documentKind, linkScore, onlyInBrowser, posterImages, rankPracticalLinks } from "@/lib/catalog/practical-sources";
import { isNotCycling } from "@/lib/catalog/practical-extraction";

const race = { name: "34. Großer Preis von Buchholz", startDate: "2027-05-01" };
const page = "https://club.test/race";

it("reads the regulations before the rest and leaves out what cannot help", () => {
  const links = ["https://club.test/kontakt", "https://club.test/Satzung.pdf", "https://club.test/ausschreibung-2027.pdf", "https://club.test/ausschreibung-2025.pdf", "https://club.test/ergebnisse.pdf", "https://club.test/agb.pdf", "https://club.test/anmeldung"];
  expect(rankPracticalLinks(links, "", page, race)).toEqual(["https://club.test/ausschreibung-2027.pdf", "https://club.test/anmeldung"]);
});
it("uses a link's words, not only its address", () => {
  expect(rankPracticalLinks(["https://club.test/files/a1b2.pdf", "https://club.test/files/c3d4.pdf"], "[Mitgliedsantrag](https://club.test/files/c3d4.pdf) [Propozice](https://club.test/files/a1b2.pdf)", page, race)[0]).toBe("https://club.test/files/a1b2.pdf");
});
it("keeps a season that reaches this edition", () => {
  expect(linkScore("https://club.test/ausschreibung-2026-27.pdf", "", page, race)).not.toBeNull();
});
it("follows a calendar to the organiser's site, but not to booking or social sites", () => {
  expect(linkScore("https://radsport-buchholz.de/grosser-preis/", "", "https://www.dsergebnis.de/34-grosser-preis-von-buchholz/", race)).toBe(4);
  expect(linkScore("https://www.facebook.com/buchholz", "", page, race)).toBeNull();
  expect(linkScore("https://www.anrdoezrs.net/links/1/https://www.booking.com/x", "", page, race)).toBeNull();
  expect(linkScore("https://unrelated.example/", "", page, race)).toBeNull();
});
it("tells what a document is for this edition", () => {
  const kind = (text: string, url = "https://x.test/a.pdf") => documentKind({ url, text }, race);
  expect(kind("Satzung des Vereins\nParagraph 1")).toBe("not_about_races");
  expect(kind("AGB | Allgemeine Teilnahmebedingungen\nDer Veranstalter haftet nicht.")).toBe("general_terms");
  expect(kind("Ausschreibung 2026\nStart 10:00, Elite 12:30\nStartgeld 20 €")).toBe("other_edition");
  expect(kind("Ausschreibung 2027\nStart 10:00, Elite 12:30\nStartgeld 20 €")).toBe("regulations");
  expect(kind("Herzlich willkommen 2027")).toBe("no_details");
});
it("finds a poster shown as a picture, not logos", () => {
  expect(posterImages('<img src="/img/plakat-2027.jpg"><img src="/img/logo-plakat.png"><img src="/a.jpg" alt="Sponsor">', page)).toEqual(["https://club.test/img/plakat-2027.jpg"]);
});
it("sees a run named plainly, and keeps a round of a cup", () => {
  expect(isNotCycling("10 km Antenne Brandenburg Lauf")).toBe(true);
  expect(isNotCycling("2. Lauf Elite")).toBe(false);
});
it("opens a browser only for pages built with JavaScript, and never for one verifying its visitors", () => {
  expect(onlyInBrowser('<div id="app"></div><script src="a.js"></script>', "We are sorry, but the page doesn't work properly without JavaScript enabled.")).toBe(true);
  expect(onlyInBrowser('<div id="app"></div><script src="a.js"></script>', "Verifying your browser... Just a moment")).toBe(false);
  expect(onlyInBrowser("<h1>Race</h1>", "Race 2027")).toBe(false);
  expect(onlyInBrowser('<div id="app"></div><script></script>', "x ".repeat(400))).toBe(false);
});

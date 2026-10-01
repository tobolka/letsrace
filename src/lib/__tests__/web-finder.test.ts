import { describe, expect, it } from "vitest";
import { isConfidentMatch, looksLikeArticleOrListing, namedByThePage, pageIsAbout, searchQuery } from "@/lib/catalog/web-finder";

describe("web finder", () => {
  it("asks for the race, its town and its year", () => {
    expect(searchQuery("#03 - Bad Harzburg (UCI C1) 2026", "Bad Harzburg", "2026")).toBe("Bad Harzburg 2026");
    expect(searchQuery("Bauhaus Perlcross", "Perl", "2026")).toBe("Bauhaus Perlcross Perl 2026");
  });

  it("recognises articles and calendars, not a race's own site", () => {
    expect(looksLikeArticleOrListing("https://www.ivg.it/2026/09/mountain-bike-memorial/")).toBe(true);
    expect(looksLikeArticleOrListing("https://www.bad-harzburg.de/aktuell/veranstaltungskalender")).toBe(true);
    expect(looksLikeArticleOrListing("https://www.perlcross.de/")).toBe(false);
  });

  it("wants the race's name in the page's address or title, and its season in the text", () => {
    expect(namedByThePage("https://www.perlcross.de/", "Perlcross 2026", "Bauhaus Perlcross")).toBe(true);
    expect(namedByThePage("https://example.com/page", "Welcome", "Bauhaus Perlcross")).toBe(false);
    expect(pageIsAbout("Bauhaus Perlcross 3.10.2026 in Perl", "Bauhaus Perlcross", "Perl", "2026-10-03")).toBe(true);
    expect(pageIsAbout("Bauhaus Perlcross 2024 results", "Bauhaus Perlcross", "Perl", "2026-10-03")).toBe(false);
  });

  it("writes only sure finds", () => {
    expect(isConfidentMatch("https://www.perlcross.de/", "Bauhaus Perlcross in Perl 2026", "Bauhaus Perlcross", "Perl")).toBe(true);
    expect(isConfidentMatch("https://x.com/a/b/c/perlcross", "Bauhaus Perlcross in Perl", "Bauhaus Perlcross", "Perl")).toBe(false);
  });
});

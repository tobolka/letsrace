import { describe, expect, it } from "vitest";
import { facebookPageFromHtml, organiserFacebookPage } from "@/lib/catalog/facebook-links";

const page = (...hrefs: string[]) => `<html><body>${hrefs.map((h) => `<a href="${h}">x</a>`).join("")}</body></html>`;

describe("organiser Facebook page from a race website", () => {
  it("keeps pages and drops share buttons, posts of other kinds and Facebook's own pages", () => {
    expect(organiserFacebookPage("https://www.facebook.com/lesakcup/")).toBe("https://www.facebook.com/lesakcup");
    expect(organiserFacebookPage("https://www.facebook.com/lesakcup/posts/123")).toBe("https://www.facebook.com/lesakcup");
    expect(organiserFacebookPage("https://www.facebook.com/sharer/sharer.php?u=https://x.cz")).toBeNull();
    expect(organiserFacebookPage("https://www.facebook.com/events/1543812600826429")).toBeNull();
    expect(organiserFacebookPage("https://www.facebook.com/profile.php")).toBeNull();
    expect(organiserFacebookPage("https://www.facebook.com/profile.php?id=100094459734260&amp;ref=x")).toBe("https://www.facebook.com/profile.php?id=100094459734260");
  });

  it("writes numbered page addresses one way", () => {
    expect(organiserFacebookPage("https://www.facebook.com/p/Rohansk%C3%A9-stezky-100057334184540/")).toBe("https://www.facebook.com/profile.php?id=100057334184540");
    expect(organiserFacebookPage("https://www.facebook.com/pages/Moravsk%C3%BD-poh%C3%A1r/241120283231")).toBe("https://www.facebook.com/profile.php?id=241120283231");
    expect(organiserFacebookPage("https://www.facebook.com/%C4%8Ceskolipsk%C3%BD-silni%C4%8Dn%C3%AD-poh%C3%A1r-775924069442588")).toBe("https://www.facebook.com/profile.php?id=775924069442588");
  });

  it("takes the only page a site links", () => {
    expect(facebookPageFromHtml(page("https://www.facebook.com/TourDeRalsko", "https://www.facebook.com/sharer.php?u=1"), "https://www.tourderalsko.cz/", ["Tour de Ralsko"]))
      .toBe("https://www.facebook.com/TourDeRalsko");
    expect(facebookPageFromHtml(page("https://www.facebook.com/profile.php", "https://www.facebook.com/profile.php?id=100094459734260"), "https://jizersky-kopec.webnode.cz/", ["Jizerský kopec"]))
      .toBe("https://www.facebook.com/profile.php?id=100094459734260");
  });

  it("among several, takes the one named like the site or the race", () => {
    // Sponsor, organiser, a person and an unnamed profile, as on amaterskaliga.cz.
    expect(facebookPageFromHtml(page(
      "https://www.facebook.com/Ozvu%C4%8Den%C3%AD-Vl%C4%8Dek-100386932095393", "https://www.facebook.com/amaterskaliga",
      "https://www.facebook.com/marcel.spicka.7", "https://www.facebook.com/profile.php?id=100065167263535",
    ), "https://www.amaterskaliga.cz/", ["Amatérská liga"])).toBe("https://www.facebook.com/amaterskaliga");
    expect(facebookPageFromHtml(page("https://www.facebook.com/lesakcup", "https://www.facebook.com/michal.kanera.sportovec"), "https://lesak-cup.cz/", ["Lesák CUP"]))
      .toBe("https://www.facebook.com/lesakcup");
    // The series' page by the race's name, not the media partner's.
    expect(facebookPageFromHtml(page("https://www.facebook.com/ceskypoharxco", "https://www.facebook.com/welovecycling.cz"), "https://www.poharmtb.cz/", ["Český pohár XCO — Zadov"]))
      .toBe("https://www.facebook.com/ceskypoharxco");
    expect(facebookPageFromHtml(page("https://www.facebook.com/PrahaDoksy", "https://www.facebook.com/maso.ohen.coud"), "https://doksy.vinohradskeslapky.com/", ["Vinohradské šlapky Praha–Doksy"]))
      .toBe("https://www.facebook.com/PrahaDoksy");
    // JSON with escaped slashes counts too.
    expect(facebookPageFromHtml('{"sameAs":["https:\\/\\/www.facebook.com\\/jicinska50"]}<a href="https://www.facebook.com/runmtbseries">', "https://www.jicinska50.cz/", ["WEBER Jičínská50"]))
      .toBe("https://www.facebook.com/jicinska50");
  });

  it("does not take a federation's, a magazine's or a sponsor's page for the race", () => {
    // The race's "website" is the federation calendar; the page named like the site is the federation's.
    expect(facebookPageFromHtml(page("https://www.facebook.com/PZKol"), "https://pzkol.pl/kalendarz/2887,bryksy-cross.html", ["XXXIII Bryksy Cross międzynarodowy wyścig"])).toBeNull();
    expect(facebookPageFromHtml(page("https://www.facebook.com/inbici.magazine"), "https://www.inbici.net/beltrami-tsa", ["4° GIMKANA BELTRAMI TSA"])).toBeNull();
    expect(facebookPageFromHtml(page("https://www.facebook.com/Arrigoniarredamenti"), "https://arrigoniarredamenti.it/", ["CICLOCROSS DEL CINQUANTESIMO"])).toBeNull();
    expect(organiserFacebookPage("https://www.facebook.com/2008")).toBeNull();
  });

  it("knows a page by the start of a long word", () => {
    expect(facebookPageFromHtml(page("https://www.facebook.com/svefrankenhain"), "https://www.biathlon-frankenhain.de/cx/", ["Frankenhainer Cyclo-Cross"]))
      .toBe("https://www.facebook.com/svefrankenhain");
  });

  it("takes nothing when no page is named like the site or the race", () => {
    expect(facebookPageFromHtml(page(
      "https://www.facebook.com/bikemat.cz", "https://www.facebook.com/kc.pivovarvratislavice", "https://www.facebook.com/share/x",
    ), "https://www.kckonrad.cz/", ["Konrad Cup"])).toBeNull();
    expect(facebookPageFromHtml(page("https://example.com"), "https://x.cz/", ["X"])).toBeNull();
  });
});

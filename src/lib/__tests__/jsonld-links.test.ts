import { describe, expect, it } from "vitest";
import { extractJsonLdEvents } from "@/lib/watcher/extractors/jsonld";
import { asksToVerifyVisitor } from "@/lib/catalog/practical-sources";

const page = (url: unknown, extra = "") => `<html><head>${extra}<script type="application/ld+json">${JSON.stringify({
  "@graph": [{ "@type": "Event", "@id": "#/schema/events/54", name: "#11 - Rostock", startDate: "2026-11-15", url, location: { name: "Rostock" } }],
})}</script></head><body></body></html>`;

describe("JSON-LD race links", () => {
  it("turns a relative race page into a full address", () => {
    const [race] = extractJsonLdEvents("https://www.stevenscup.de/rennen", page("rennen/11-rostock"));
    expect(race.sourceUrl).toBe("https://www.stevenscup.de/rennen/11-rostock");
    expect(race.registrationUrl).toBe("https://www.stevenscup.de/rennen/11-rostock");
  });

  it("follows the page's own base address", () => {
    const [race] = extractJsonLdEvents("https://www.stevenscup.de/rennen", page("rennen/11-rostock", '<base href="https://www.stevenscup.de/">'));
    expect(race.sourceUrl).toBe("https://www.stevenscup.de/rennen/11-rostock");
  });

  it("keeps the calendar page when the link is not a web address", () => {
    const [race] = extractJsonLdEvents("https://example.org/races", page("mailto:info@example.org"));
    expect(race.sourceUrl).toBe("https://example.org/races");
    expect(race.registrationUrl).toBeUndefined();
  });
});

describe("visitor checks", () => {
  it("does not take a reCAPTCHA line on an ordinary page for a robot check", () => {
    const text = `Tour de Zeleňák – 42. ročník. ${"Program závodu a propozice. ".repeat(60)} Sie müssen den Inhalt von reCAPTCHA laden, um das Formular abzuschicken.`;
    expect(asksToVerifyVisitor(text)).toBe(false);
  });

  it("still recognises a challenge page", () => {
    expect(asksToVerifyVisitor("Just a moment... Checking your browser before accessing the site.")).toBe(true);
    expect(asksToVerifyVisitor("Please complete the captcha to continue.")).toBe(true);
    expect(asksToVerifyVisitor(`${"Rennen ".repeat(300)} Verify you are human`)).toBe(true);
  });
});

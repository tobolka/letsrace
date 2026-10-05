import { expect, it, vi } from "vitest";

vi.mock("@/lib/catalog/regulation-ages", async (original) => {
  const actual = await original<typeof import("@/lib/catalog/regulation-ages")>();
  return { ...actual, readDocument: vi.fn(async (url: string) => {
    const html = url === "https://organiser.example/"
      ? `<h1>Race 24.10.2026</h1>${Array.from({ length: 30 }, (_, i) => `<a href="/info-${i}">Info</a>`).join("")}<a href="https://my.raceresult.com/419021/registration">Anmeldung</a><a href="/propozice-2026-mtb/">Propozice MTB</a>`
      : url.includes("propozice") ? "<table><tr><td>kluci</td><td>do 8 let</td><td>2018 a mladší</td></tr></table>" : "<p>Public registration</p>";
    return { url, html, text: actual.htmlText(html), thin: false };
  }) };
});

it("reads a class table and RaceResult before generic menu links exhaust the dossier", async () => {
  const { gatherDossier } = await import("@/lib/catalog/dossier");
  const docs = await gatherDossier({ startDate: "2026-10-24", website: "https://organiser.example/", registration: null, regulations: null, sources: [], maxDocs: 3 });
  expect(docs.map((doc) => doc.url)).toEqual(["https://organiser.example/", "https://organiser.example/propozice-2026-mtb/", "https://my.raceresult.com/419021/"]);
  expect(docs[1]?.linkedFromEdition).toBe(true);
  const { editionDocs } = await import("@/lib/catalog/dossier-classes");
  expect(editionDocs(docs, "2026-10-24", ["Race"])).toContain(docs[1]);
});

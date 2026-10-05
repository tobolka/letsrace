import { expect, it, vi } from "vitest";

vi.mock("@/lib/catalog/regulation-ages", async (original) => {
  const actual = await original<typeof import("@/lib/catalog/regulation-ages")>();
  return { ...actual, readDocument: vi.fn(async (url: string) => {
    if (url === "https://my.raceresult.com/410580/") return { url, text: "Emser Steinbock 11.10.2026", html: '<a href="https://club.example/hillclimb">Organiser race information — Technical guide</a>', thin: false };
    if (url === "https://club.example/hillclimb") return { url, text: "Emser Steinbock 11.10.2026", html: '<a href="https://files.example/hash.pdf" aria-label="Technical Guide Emser Steinbock 2026.pdf"><img src="pdf.png"></a>', thin: false };
    if (url === "https://render.example/") return { url, text: "", html: '<div id="root"></div>', thin: true };
    if (url === "https://crowded.example/") return { url, text: "Race 11.10.2026", html: `${Array.from({ length: 30 }, (_, i) => `<a href="/info-${i}">Info</a>`).join("")}<a href="/pravidla/">Pravidla</a>`, thin: false };
    if (url === "https://crowded.example/pravidla/") return { url, text: "Series rules", html: '<a href="/Pravidla_WBS_2026_rev2.pdf">Pravidla WBS 2026</a>', thin: false };
    if (url.endsWith(".pdf")) return { url, text: "Emser Steinbock 11.10.2026\nSchüler 2012-2016\nJugend 2008-2011", html: null, thin: false };
    const html = url === "https://organiser.example/"
      ? `<h1>Race 24.10.2026</h1>${Array.from({ length: 30 }, (_, i) => `<a href="/info-${i}">Info</a>`).join("")}<a href="https://my.raceresult.com/419021/registration">Anmeldung</a><a href="/propozice-2026-mtb/">Propozice MTB</a>`
      : url.includes("propozice") ? "<table><tr><td>kluci</td><td>do 8 let</td><td>2018 a mladší</td></tr></table>" : "<p>Public registration</p>";
    return { url, html, text: actual.htmlText(html), thin: false };
  }) };
});

vi.mock("@/lib/watcher/extractors/csc-render", () => ({ renderPagesHtml: vi.fn(async (urls: string[]) => new Map(urls.map((url) => [url, '<h1>Race 11.10.2026</h1><iframe src="/guide.pdf" title="Technical Guide"></iframe>']))) }));

it("follows an external information page and its icon-only guide without a seeded PDF URL", async () => {
  const { gatherDossier } = await import("@/lib/catalog/dossier");
  const docs = await gatherDossier({ startDate: "2026-10-11", website: "https://my.raceresult.com/410580/", registration: null, regulations: null, sources: [], maxDocs: 3 });
  expect(docs.map((doc) => doc.url)).toEqual(["https://my.raceresult.com/410580/", "https://club.example/hillclimb", "https://files.example/hash.pdf"]);
  expect(docs[2]?.thisEdition).toBe(true);
});

it("discovers an embedded PDF after rendering a script shell", async () => {
  const { gatherDossier } = await import("@/lib/catalog/dossier");
  const docs = await gatherDossier({ startDate: "2026-10-11", website: "https://render.example/", registration: null, regulations: null, sources: [], render: true, maxDocs: 2 });
  expect(docs.map((doc) => doc.url)).toEqual(["https://render.example/", "https://render.example/guide.pdf"]);
});

it("makes room for a second-hop rules PDF when first-page menu links fill the queue", async () => {
  const { gatherDossier } = await import("@/lib/catalog/dossier");
  const docs = await gatherDossier({ startDate: "2026-10-11", website: "https://crowded.example/", registration: null, regulations: null, sources: [], maxDocs: 3 });
  expect(docs.map((doc) => doc.url)).toEqual(["https://crowded.example/", "https://crowded.example/pravidla/", "https://crowded.example/Pravidla_WBS_2026_rev2.pdf"]);
});

it("reads a class table and RaceResult before generic menu links exhaust the dossier", async () => {
  const { gatherDossier } = await import("@/lib/catalog/dossier");
  const docs = await gatherDossier({ startDate: "2026-10-24", website: "https://organiser.example/", registration: null, regulations: null, sources: [], maxDocs: 3 });
  expect(docs.map((doc) => doc.url)).toEqual(["https://organiser.example/", "https://organiser.example/propozice-2026-mtb/", "https://my.raceresult.com/419021/"]);
  expect(docs[1]?.linkedFromEdition).toBe(true);
  const { editionDocs } = await import("@/lib/catalog/dossier-classes");
  expect(editionDocs(docs, "2026-10-24", ["Race"])).toContain(docs[1]);
});

import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gatherEventDossier } from "@/lib/catalog/source-evidence";
import { gatherDossier, isRaceListingDetail } from "@/lib/catalog/dossier";

it("gives every source a document budget and reads shared URLs only once", async () => {
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, range: async () => ({ data: [], error: null }) };
  const s = { from: () => query } as unknown as SupabaseClient;
  const calls: string[] = [];
  const source = "https://mtbs.cz/clanek/race-2026/kategorie/xc";
  const docs = await gatherEventDossier(s, "race-id", {
    startDate: "2026-10-11", website: "https://club.cz/", registration: null, regulations: null,
    sources: [source, "https://sumator.cz/race/second"], maxDocs: 2,
    read: async url => { calls.push(url); return { url, text: "Race 11.10.2026", thin: false,
      html: url.includes("sumator") ? '<a href="https://entry.cz/propozice.pdf">Propozice</a>' : '<a href="https://club.cz/propozice.pdf">Propozice</a>' }; },
  });
  expect(docs.map(d => d.url)).toContain(source);
  expect(docs.map(d => d.url)).toContain("https://entry.cz/propozice.pdf");
  expect(calls.filter(url => url === "https://club.cz/propozice.pdf")).toHaveLength(1);
  expect(docs.length).toBeGreaterThan(2);
});

it("allows federation and race details to lead to documents, keeping shared calendars separate", () => {
  expect(isRaceListingDetail("https://portal.czechcyclingfederation.com/RaceDetail/Race/15354")).toBe(true);
  expect(isRaceListingDetail("https://sumator.cz/race/mulda-2026")).toBe(true);
  expect(isRaceListingDetail("https://mtbs.cz/sekce/kalendar")).toBe(false);
  expect(isRaceListingDetail("https://sumator.cz/")).toBe(false);
});

it("reads foreign HTML rules and excludes navigation links from inline aggregator rules", async () => {
  const site = await gatherDossier({ startDate: "2026-10-11", website: "https://foreign.example/race", registration: null, regulations: null, sources: [], maxDocs: 2,
    read: async url => ({ url, text: "Race 11.10.2026", thin: false, html: '<a href="/rules">Rules</a>' }) });
  expect(site.map(d => d.url)).toContain("https://foreign.example/rules");
  const mtbs = await gatherDossier({ startDate: "2026-10-11", website: null, registration: null, regulations: "https://mtbs.cz/clanek/race/kategorie/xc#propozice", sources: [],
    read: async url => ({ url, text: "Race 11.10.2026", thin: false, html: url.endsWith(".pdf") ? null : '<nav><a href="/kategorie/testy">Kategorie</a></nav><a href="/registrace">Registrace účtu</a><a href="https://club.cz/propozice.pdf">Propozice</a>' }) });
  expect(mtbs.map(d => d.url)).toContain("https://club.cz/propozice.pdf");
  expect(mtbs.map(d => d.url)).not.toContain("https://mtbs.cz/registrace");
  expect(mtbs.map(d => d.url)).not.toContain("https://mtbs.cz/kategorie/testy");
});

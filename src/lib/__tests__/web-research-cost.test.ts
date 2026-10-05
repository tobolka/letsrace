import { afterEach, describe, expect, it, vi } from "vitest";
const stubs = vi.hoisted(() => ({ search: vi.fn(), read: vi.fn(), ask: vi.fn() }));
vi.mock("@/lib/catalog/brave", () => ({ braveSearch: stubs.search, braveAvailable: () => true, BraveUnavailable: class extends Error {} }));
vi.mock("@/lib/catalog/regulation-ages", async (original) => ({ ...await original<object>(), readDocument: stubs.read }));
vi.mock("@/lib/llm/anthropic", async (original) => ({ ...await original<object>(), askJson: stubs.ask }));
import { namesRaceVariant, namesTheRace, searchAndPick } from "@/lib/catalog/web-research";
const race = { id: "race", name: "Perlcross", municipality: "Perl", startDate: "2026-10-11", country: "DE", disciplines: ["cx"], website: "https://perlcross.de/", registration: null, regulations: null };
afterEach(() => vi.resetAllMocks());
const doc = { text: "Perlcross Perl 11.10.2026", html: '<a href="/anmeldung">Anmeldung</a><a href="/ausschreibung.pdf">Ausschreibung</a>' };
describe("research cost", () => {
  it("does not confuse a mini or children's race with the main event", () => {
    expect(namesTheRace("Il Lombardia Giro Bergamo 10/10/2026", "MINI GIRO DI LOMBARDIA")).toBe(false);
    expect(namesRaceVariant("Il Lombardia 10/10/2026", "MINI GIRO DI LOMBARDIA")).toBe(false);
    expect(namesTheRace("Mini Giro di Lombardia Bergamo 10/10/2026", "MINI GIRO DI LOMBARDIA")).toBe(true);
    expect(namesRaceVariant("Perlcross 2026", "Perlcross Kids")).toBe(false);
  });
  it("does not search or ask a model when known organiser links supply the missing fields", async () => {
    stubs.read.mockResolvedValue(doc);
    const result = await searchAndPick(race);
    expect(result.json).toEqual({ registration: "https://perlcross.de/anmeldung", regulations: "https://perlcross.de/ausschreibung.pdf" });
    expect(result.searches).toBe(0);
    expect(stubs.search).not.toHaveBeenCalled();
    expect(stubs.ask).not.toHaveBeenCalled();
  });
  it("stops after finding the site and follows its links without further paid searches", async () => {
    stubs.search.mockResolvedValue([{ url: race.website, title: "Perlcross 2026", description: "Perlcross Perl" }]);
    stubs.ask.mockResolvedValue({ json: { website: 1 }, usage: { costUsd: 0.001 } });
    stubs.read.mockResolvedValue(doc);
    const result = await searchAndPick({ ...race, website: null });
    expect(result.json?.website).toBe(race.website);
    expect(result.json?.regulations).toBe("https://perlcross.de/ausschreibung.pdf");
    expect(result.searches).toBe(1);
    expect(stubs.search).toHaveBeenCalledTimes(1);
  });
});

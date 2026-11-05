import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({}) }));
const { namesSupportMerge, recordsSupportNameMerge } = await import("@/lib/catalog/llm-duplicates");
import type { MergeDuplicateRow } from "@/lib/catalog/merge-duplicates";
const { isSeparateRace } = await import("@/lib/catalog/merge-duplicates");

const row = (name: string, website_url: string | null = null) => ({ name, website_url });

describe("names that support a model's merge", () => {
  it("accepts a calendar's distance label on the same race", () => {
    expect(namesSupportMerge(row("Most - Lesná RR 67 km"), row("Most - Lesná"), 0.7)).toBe(true);
    expect(namesSupportMerge(row("LAWI Tour RR 100 km"), row("LAWI Tour 2027"), 0.8)).toBe(true);
  });

  it("does not accept two different distances of one event", () => {
    expect(namesSupportMerge(row("Tour de Zeleňák RR 54 km"), row("Tour de Zeleňák RM 106 km"), 0.95)).toBe(false);
    expect(namesSupportMerge(row("Randonnée Città di Finale Ligure 100"), row("Randonnée Città di Finale Ligure 200"), 0.95)).toBe(false);
  });

  it("needs the same website and high confidence when one name is only part of the other", () => {
    const left = row("Gravel Epic Šternberk", "https://gravelepic.cz/"), right = row("GRAVEL EPIC", "https://www.gravelepic.cz/start");
    expect(namesSupportMerge(left, right, 0.9)).toBe(true);
    expect(namesSupportMerge(left, right, 0.8)).toBe(false);
    expect(namesSupportMerge(left, row("GRAVEL EPIC", "https://jiny.cz/"), 0.9)).toBe(false);
  });

  it("keeps a low model confidence and separate races apart", () => {
    expect(namesSupportMerge(row("Most - Lesná RR 67 km"), row("Most - Lesná"), 0.6)).toBe(false);
    expect(namesSupportMerge(row("Soběšická Mulda 2027"), row("Muldička 2027"), 0.99)).toBe(false);
  });
});

describe("record evidence required for a merge without a source quote", () => {
  const first: MergeDuplicateRow = { id: "a", name: "LAWI Tour 2027", start_date: "2027-08-21", end_date: null,
    website_url: "https://club.test/", registration_url: null, series_id: null, series: null, fingerprint: null,
    disciplines: ["road"], location: { country_code: "CZ", municipality: "Dobrovice", lat: 50.37, lng: 14.96 } };
  const second = { ...first, id: "b", name: "LAWI Tour RR 100 km" };

  it("allows an otherwise matching calendar record", () => {
    expect(recordsSupportNameMerge(first, second, 0.9)).toBe(true);
  });

  it("holds a similarly named next day's race, weekend, other venue or unknown venue", () => {
    for (const changed of [
      { ...second, start_date: "2027-08-22" },
      { ...second, end_date: "2027-08-22" },
      { ...second, location: { ...second.location, lat: 50.1, lng: 14.4 } },
      { ...second, location: null },
      { ...second, location: { country_code: "CZ", municipality: "Česká republika" } },
      { ...second, disciplines: null },
      { ...second, disciplines: ["gravel"] },
      { ...second, location: { ...second.location, country_code: "PL" } },
    ]) expect(recordsSupportNameMerge(first, changed, 0.99)).toBe(false);
  });

  it("does not merge two rounds through a shared website", () => {
    expect(recordsSupportNameMerge({ ...first, name: "Beskydský pohár round 1" }, { ...second, name: "Beskydský pohár round 2" }, 0.99)).toBe(false);
  });
});

describe("shorter race beside the main one", () => {
  it("treats a half distance as its own race", () => {
    expect(isSeparateRace("Bike Paradise", "Půl Paradise")).toBe(true);
    expect(isSeparateRace("Mini Duszek Puszczy", "Ultra Duch Puszczy")).toBe(true);
    expect(isSeparateRace("Bike Paradise", "Bike Paradise 2027")).toBe(false);
  });
});

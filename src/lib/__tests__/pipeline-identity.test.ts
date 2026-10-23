import { describe, expect, it } from "vitest";
import { scoreDuplicate, DEDUP_THRESHOLD, type DedupEvent } from "@/lib/dedup";
import { sourceEditionId } from "@/lib/watcher/source-identity";
import { combineExtractedEvents } from "@/lib/watcher/core";
import type { ParsedEvent } from "@/lib/domain";
import { extractGeneric, isSiteIdentityName } from "@/lib/watcher/extractors/generic";
import { selectDiscoveryCandidates } from "@/lib/watcher/explore";

const race: DedupEvent = { name: "Perlcross", startDate: "2026-10-11", placeText: "Perl", urls: ["https://perlcross.de/race"] };
describe("lookup keys cannot override contradictory identity", () => {
  it.each([
    [{ ...race, startDate: "2027-10-11" }, "edition_conflict"],
    [{ ...race, name: "Perlcross round 2" }, "round_conflict"],
    [{ ...race, name: "Perlcross XCM" }, "format_conflict"],
    [{ ...race, countryCode: "CZ" }, "country_conflict"],
  ] as [DedupEvent, string][])("rejects %j", (other, reason) => {
    const base = { ...race, name: reason === "round_conflict" ? "Perlcross round 1" : reason === "format_conflict" ? "Perlcross XCO" : race.name, countryCode: "DE" };
    for (const fingerprint of [undefined, "colliding-nogps-fingerprint"]) {
      const verdict = scoreDuplicate({ ...base, fingerprint }, { ...other, fingerprint });
      expect(verdict.score).toBeLessThan(DEDUP_THRESHOLD);
      expect(verdict.reasons).toContain(reason);
    }
  });
  it("keeps one legitimate year-end event across New Year", () => {
    expect(scoreDuplicate({ ...race, startDate: "2026-12-31", endDate: "2027-01-02" }, { ...race, startDate: "2027-01-01" }).score).toBeGreaterThanOrEqual(DEDUP_THRESHOLD);
  });
  it("does not follow an external id reassigned to a different town weeks later", () => {
    const stored = { ...race, name: "TBC — TÁBOR", startDate: "2026-10-25", placeText: "Tábor" };
    const incoming = { ...stored, name: "TBC — VIMPERK", startDate: "2026-11-14", placeText: "Vimperk" };
    expect(sourceEditionId(incoming.startDate, { id: "old-round", start_date: stored.startDate }, { incoming, stored })).toBeUndefined();
  });
});

describe("additive extraction", () => {
  const a: ParsedEvent = { externalId: "a", name: "Perlcross", startDate: "2026-10-11", placeText: "Perl", sourceUrl: "https://club.test/race", confidence: 0.8, registrationUrl: "https://entry.test/123" };
  const b: ParsedEvent = { ...a, externalId: "b", name: "Anothercross", startDate: "2026-11-01" };
  it("retains both deterministic races when AI finds only one plus a new race", () => {
    const extra = { ...b, externalId: "c", startDate: "2026-12-01" };
    expect(combineExtractedEvents([a, b], [{ ...a, externalId: "ai-a", registrationUrl: undefined }, extra])).toEqual([a, b, extra]);
  });
  it("recognizes a rich AI name as the same literal calendar row", () => {
    const primary = { ...a, name: "#06 - Schwerin", placeText: "Schwerin", startDate: "2026-10-24" };
    const enriched = { ...primary, externalId: "ai", name: "Cross the Pfaff — Schwerin", placeText: "",
      evidence: { method: "llm_calendar", version: "calendar-v2", sourceUrl: a.sourceUrl, quote: "#06 - Schwerin Cross the Pfaff Samstag, 24. Oktober 2026" } };
    expect(combineExtractedEvents([primary], [enriched])).toHaveLength(1);
    expect(combineExtractedEvents([primary], [enriched])[0]?.externalId).toBe(primary.externalId);
  });
});

it("rejects calendar headings and truncated news teasers as generic race names", () => {
  expect(extractGeneric("https://timing.test/", "<h1>Termine 2026</h1><p>24.10.2026 Perlcross</p>")).toEqual([]);
  expect(isSiteIdentityName("Mach mit: Viele…", "https://club.test/")).toBe(true);
});

it("discovers a new race page on a known domain without reopening an already reviewed URL", () => {
  const known = new Set(["https://example-cup.cz/zavody/2026"]);
  expect(selectDiscoveryCandidates([
    "https://example-cup.cz/zavody/2026",
    "https://example-cup.cz/zavody/2027",
    "https://example-cup.cz/zavody/2027?utm_source=search",
  ], known)).toEqual(["https://example-cup.cz/zavody/2027"]);
});

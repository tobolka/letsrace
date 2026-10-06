import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedEvent } from "@/lib/domain";

const checkpoint = vi.hoisted(() => ({ hashes: new Map<string, string>(), records: vi.fn() }));
vi.mock("@/lib/catalog/facts", async original => {
  const actual = await original<typeof import("@/lib/catalog/facts")>();
  return { ...actual, recordFacts: checkpoint.records,
    alreadyRead: async (_s: unknown, url: string, reader: string, hash: string) => checkpoint.hashes.get(`${url}:${reader}`) === hash,
    markRead: async (_s: unknown, url: string, reader: string, hash: string) => { checkpoint.hashes.set(`${url}:${reader}`, hash); } };
});

it("retains the entire source result, including fields without a single display slot, and archives changed results", async () => {
  const { saveSourceEvidence } = await import("@/lib/catalog/source-evidence");
  const s = {} as SupabaseClient;
  const event: ParsedEvent = { externalId: "source-race", name: "Race", startDate: "2026-10-11", placeText: "Brno", confidence: 0.9,
    sourceUrl: "https://source.cz/race", websiteUrl: "https://club.cz/", regulationsUrl: "https://source.cz/rules.pdf",
    registrationUrl: "https://entry.cz/race", registrationClosesAt: "2026-10-10",
    categories: [{ name: "Ženy", distanceKm: 50, elevationM: 1200, gender: "female", ageMin: 18 }],
    alsoSeries: [{ slug: "regional-cup" }], resultsUrl: "https://timing.cz/race" };
  await saveSourceEvidence(s, "event-id", "watch-id", "aggregator", event);
  await saveSourceEvidence(s, "event-id", "watch-id", "aggregator", event);
  expect(checkpoint.records).toHaveBeenCalledTimes(1);
  expect(checkpoint.records.mock.calls[0]?.[2]).toEqual([{ field: "source_evidence", value: { watchedUrlId: "watch-id", kind: "aggregator", event }, previous: null, sourceUrl: event.sourceUrl }]);
  await saveSourceEvidence(s, "event-id", "watch-id", "aggregator", { ...event, registrationClosesAt: "2026-10-09" });
  expect(checkpoint.records).toHaveBeenCalledTimes(2);
});

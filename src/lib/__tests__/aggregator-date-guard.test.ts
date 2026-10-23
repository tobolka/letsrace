import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { startDateConfirmedOutsideAggregators } from "@/lib/catalog/source-evidence";

function client(rows: { watchedUrlId: string; kind: string; externalId: string; startDate: string }[]) {
  const value = rows.map((r) => ({
    value: { watchedUrlId: r.watchedUrlId, kind: r.kind, event: { externalId: r.externalId, startDate: r.startDate, sourceUrl: "https://x.cz" } },
  }));
  const q = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: value, error: null }) };
  return { from: () => q } as unknown as SupabaseClient;
}

it("counts a series or race source as confirming the stored date, not an aggregator", async () => {
  const s = client([
    { watchedUrlId: "h", kind: "aggregator", externalId: "hynek", startDate: "2026-10-25" },
    { watchedUrlId: "t", kind: "series", externalId: "tbc", startDate: "2026-11-01" },
  ]);
  expect(await startDateConfirmedOutsideAggregators(s, "e", "2026-11-01")).toBe(true);
  expect(await startDateConfirmedOutsideAggregators(s, "e", "2026-10-25")).toBe(false);
});

it("keeps only the latest read of each source", async () => {
  const s = client([
    { watchedUrlId: "t", kind: "series", externalId: "tbc", startDate: "2026-11-01" },
    { watchedUrlId: "t", kind: "series", externalId: "tbc", startDate: "2026-10-25" },
  ]);
  expect(await startDateConfirmedOutsideAggregators(s, "e", "2026-10-25")).toBe(false);
});

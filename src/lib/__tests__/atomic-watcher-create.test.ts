import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWatcherEvent } from "@/lib/watcher/write-event";
import type { ParsedEvent } from "@/lib/domain";

const event: ParsedEvent = { externalId: "race-2027", name: "Fixture race", startDate: "2027-05-01", placeText: "Town", sourceUrl: "https://club.test/race", confidence: 1,
  categories: [{ name: "0 km", distanceKm: 0 }, { name: "Kids", distanceKm: .2 }, { name: "Elite", distanceKm: 0 }] };
const source = { watchedUrlId: "watched", kind: "race", event, reviewed: false };

it("submits the new record with evidence, source, categories, location and memberships in one request", async () => {
  const rpc = vi.fn(async (_name, plan) => ({ data: { id: plan.p_event, created: true }, error: null }));
  const db = { rpc } as unknown as SupabaseClient;
  const location = { action: "create" as const, row: { id: "location", name: "Town" } };
  const result = await createWatcherEvent(db, { slug: "fixture-2027" }, source, location, ["series", "series"]);
  expect(rpc).toHaveBeenCalledOnce();
  const plan = rpc.mock.calls[0][1];
  expect(plan.p_event).toBe(result.id);
  expect(plan.p_hash).toMatch(/^[a-f0-9]{40}$/);
  expect(plan.p_reader).toBe(`source-evidence-v1:watched:race-2027:${result.id}`);
  expect(plan.p_location).toEqual(location);
  expect(plan.p_source.event).toEqual(event);
  expect(plan.p_categories).toEqual([
    { name: "Kids", distance_km: .2, age_min: null, age_max: null, audience: null },
    { name: "Elite", distance_km: null, age_min: null, age_max: null, audience: null },
  ]);
  expect(plan.p_secondary).toEqual(["series"]);
});

it("preserves constraint errors for safe identity handling and rejects a missing confirmation", async () => {
  const error = { code: "23505", message: "Source is already owned by another race" };
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  const db = { rpc } as unknown as SupabaseClient;
  await expect(createWatcherEvent(db, {}, source, null, [])).rejects.toMatchObject({ code: error.code, message: expect.stringContaining(error.message) });
  rpc.mockResolvedValue({ data: { id: "a different race", created: true }, error: null });
  await expect(createWatcherEvent(db, {}, source, null, [])).rejects.toThrow("not confirmed");
});

import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publishCandidatePlan } from "@/lib/discovery/publication";
import type { ParsedEvent } from "@/lib/domain";
const claim = { id: "candidate", token: "token", evidenceHash: "proof" };
const event: ParsedEvent = { externalId: "race", name: "Race", startDate: "2027-05-01", sourceUrl: "https://race.test/", placeText: "Town", confidence: 1, categories: [{ name: "Kids", distanceKm: .2 }] };
const plan = { payload: { name: "Race" }, watchedUrlId: "source", kind: "race", event, location: null, secondarySeries: ["series", "series"] };
it("submits a new race and candidate completion together with every dependency", async () => {
  const rpc = vi.fn(async (_name, args) => ({ data: { id: args.p_event, created: true, changed: true }, error: null }));
  const result = await publishCandidatePlan({ rpc } as unknown as SupabaseClient, claim, plan);
  expect(result.created).toBe(true);
  expect(rpc).toHaveBeenCalledOnce();
  expect(rpc.mock.calls[0][0]).toBe("pipeline_publish_candidate");
  expect(rpc.mock.calls[0][1]).toMatchObject({ p_id: "candidate", p_token: "token", p_hash: "proof", p_revision: null, p_secondary: ["series"], p_categories: [{ name: "Kids", distance_km: .2 }] });
});
it("merges known categories before the revision-protected existing-race transaction", async () => {
  const eq = vi.fn().mockResolvedValue({ data: [{ id: "held", name: "Elite", distance_km: 20, age_min: 19, age_max: null, audience: "adults" }], error: null });
  const rpc = vi.fn(async () => ({ data: { id: "event", created: false, changed: true, applied: { name: "Locked name" } }, error: null }));
  const payload = { name: "Changed" };
  await publishCandidatePlan({ from: () => ({ select: () => ({ eq }) }), rpc } as unknown as SupabaseClient, claim, { ...plan, eventId: "event", revision: "revision", payload });
  expect(rpc.mock.calls[0]).toBeDefined();
  expect(payload.name).toBe("Locked name");
  expect(eq).toHaveBeenCalledWith("event_id", "event");
});
it("does not announce success after a refused transaction or missing receipt", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "lease lost" } });
  const db = { rpc } as unknown as SupabaseClient;
  await expect(publishCandidatePlan(db, claim, plan)).rejects.toThrow("lease lost");
  rpc.mockResolvedValue({ data: {}, error: null });
  await expect(publishCandidatePlan(db, claim, plan)).rejects.toThrow("not confirmed");
});

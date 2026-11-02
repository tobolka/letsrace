import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ eventWrites: 0, categoryError: false }));
vi.mock("@/lib/events", () => ({ upsertManualEvent: vi.fn(), isIsoDay: (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) }));
vi.mock("@/lib/organizer-publish", () => ({ refreshOrganizerPages: async () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ from: (table: string) => {
  if (table === "events") return {
    select: () => ({ eq: () => ({ single: async () => ({ data: { slug: "race", start_date: "2027-05-01", series: null }, error: null }) }) }),
    update: () => ({ eq: async () => { state.eventWrites++; return { error: null }; } }),
  };
  if (table === "event_overrides") return {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    upsert: async () => ({ error: { message: "write failed" } }),
  };
  if (table === "event_categories") return {
    select: () => ({ eq: async () => ({ data: [], error: null }) }),
    insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: "category failed" } }) }) }),
  };
  throw Error(`Unexpected table ${table}`);
} }) }));
import { applyRaceEdit } from "@/lib/race-edit";
beforeEach(() => { state.eventWrites = 0; });
it("reproduces a successful answer despite a failed protective lock", async () => {
  expect(await applyRaceEdit("race-id", { startDate: "2027-06-01" })).toEqual({ changed: 1 });
  expect(state.eventWrites).toBe(1);
});
it("reproduces a partial event write after the category step fails", async () => {
  await expect(applyRaceEdit("race-id", { startDate: "2027-06-01", categories: [{ name: "Elite" }] })).rejects.toThrow("category failed");
  expect(state.eventWrites).toBe(1);
});

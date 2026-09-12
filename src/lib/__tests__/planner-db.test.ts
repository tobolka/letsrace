import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureFavorite, removeFromPlan, setMemberPlanStatus } from "@/lib/planner-db";

function database(error: { message: string; code?: string } | null, rejects = false) {
  const query = {
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return (rejects ? Promise.reject(new TypeError("offline")) : Promise.resolve({ error })).then(resolve, reject);
    },
  };
  return { client: { from: vi.fn(() => query) } as unknown as SupabaseClient, query };
}

const row = { member_id: "rider", status: "going", registered: false, paid: false };

describe("confirmed plan writes", () => {
  it.each(["paid", "none"] as const)("does not invent a %s state after a rejected write", async (status) => {
    const { client } = database({ message: "permission denied" });
    await expect(setMemberPlanStatus({ supabase: client, userId: "user", eventId: "race", memberId: "rider", status, rows: [row], favorited: true })).rejects.toThrow("permission denied");
    expect(row.paid).toBe(false);
  });

  it("does not invent attendance after an insert fails", async () => {
    const { client } = database({ message: "unavailable" });
    await expect(setMemberPlanStatus({ supabase: client, userId: "user", eventId: "race", memberId: "rider", status: "going", rows: [], favorited: false })).rejects.toThrow("unavailable");
  });

  it("returns confirmed payment and registration together", async () => {
    const { client } = database(null);
    const result = await setMemberPlanStatus({ supabase: client, userId: "user", eventId: "race", memberId: "rider", status: "paid", rows: [row], favorited: true });
    expect(result.rows[0]).toMatchObject({ paid: true, registered: true });
  });

  it("reports network failures in adding and removing a race", async () => {
    const { client } = database(null, true);
    expect(await ensureFavorite(client, "user", "race", false)).toBe(false);
    expect(await removeFromPlan({ supabase: client, userId: "user", eventId: "race" })).toBe(false);
  });

  it("accepts a favorite already saved by another request", async () => {
    const { client } = database({ message: "duplicate", code: "23505" });
    expect(await ensureFavorite(client, "user", "race", false)).toBe(true);
  });
});

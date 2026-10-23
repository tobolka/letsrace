import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; op: string; args: unknown[] };
const calls: Call[] = [];
let overrides: { event_id: string; locked_fields: string[] | null; fields: unknown }[] = [];
let failOn: string | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => ({
    from: (table: string) => ({
      update: (...args: unknown[]) => {
        calls.push({ table, op: "update", args });
        return { in: async (...a: unknown[]) => { calls.push({ table, op: "in", args: a }); return { error: failOn === "update" ? { message: "boom" } : null }; } };
      },
      select: (...args: unknown[]) => {
        calls.push({ table, op: "select", args });
        return { in: async () => ({ data: overrides, error: null }) };
      },
      upsert: async (...args: unknown[]) => {
        calls.push({ table, op: "upsert", args });
        return { error: null };
      },
    }),
  }),
}));
const refresh = vi.fn();
vi.mock("@/lib/refresh-public-catalogue", () => ({ refreshPublicCatalogue: () => refresh() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));

import { setEventsVisibility } from "@/lib/events";

beforeEach(() => {
  calls.length = 0;
  overrides = [];
  failOn = null;
  refresh.mockClear();
});

describe("setEventsVisibility", () => {
  it("sets every race in one update, locks the choice for all of them and refreshes once", async () => {
    overrides = [{ event_id: "b", locked_fields: ["name"], fields: { name: "Kept" } }];
    await setEventsVisibility(["a", "b"], "hidden");

    const updates = calls.filter((c) => c.op === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0]!.args[0]).toMatchObject({ visibility: "hidden" });
    expect(calls.find((c) => c.op === "in" && c.table === "events")!.args).toEqual(["id", ["a", "b"]]);

    const upsert = calls.find((c) => c.op === "upsert")!;
    const rows = upsert.args[0] as { event_id: string; locked_fields: string[]; fields: Record<string, unknown> }[];
    expect(upsert.args[1]).toEqual({ onConflict: "event_id" });
    expect(rows.map((r) => r.event_id)).toEqual(["a", "b"]);
    expect(rows[0]!.locked_fields).toEqual(["visibility"]);
    // What an editor locked earlier stays locked and keeps its value.
    expect(rows[1]!.locked_fields).toEqual(["name", "visibility"]);
    expect(rows[1]!.fields).toMatchObject({ name: "Kept", visibility: "hidden" });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing for no races", async () => {
    await setEventsVisibility([], "public");
    expect(calls).toHaveLength(0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("stops at a failed update without touching the locks or the cache", async () => {
    failOn = "update";
    await expect(setEventsVisibility(["a"], "hidden")).rejects.toThrow("boom");
    expect(calls.some((c) => c.op === "upsert")).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });
});

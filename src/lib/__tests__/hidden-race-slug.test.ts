import { expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => database }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
import { findRacesForMissingSlug } from "@/lib/events";

it("does not redirect a known hidden address by guessing another race's name", async () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { id: "hidden-race" }, error: null }) };
  database.from.mockReturnValue(query);
  expect(await findRacesForMissingSlug("litvinovice-2026")).toEqual({ match: null, near: [] });
  expect(database.from).toHaveBeenCalledTimes(1);
});

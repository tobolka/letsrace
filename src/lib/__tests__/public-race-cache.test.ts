import { expect, it, vi } from "vitest";
import { getPublicEventBySlug, preparePublicRaceDetails } from "@/lib/events";

const state = vi.hoisted(() => ({ from: vi.fn(), values: new Map<string, unknown>() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ from: state.from }) }));
vi.mock("next/cache", () => ({
  unstable_cache: (load: () => Promise<unknown>, parts: string[]) => async () => {
    const key = JSON.stringify([load.toString(), parts]);
    if (!state.values.has(key)) state.values.set(key, await load());
    return state.values.get(key);
  },
}));

it("uses prepared public detail without a second database lookup", async () => {
  const row = { slug: "published-race", id: "id", name: "Published race", start_date: "2027-06-21", visibility: "public", status: "scheduled" };
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn() };
  for (const method of Object.values(query)) method.mockReturnValue(query);
  query.in.mockReturnValueOnce(query).mockResolvedValueOnce({ data: [row], error: null });
  state.from.mockReturnValue(query);

  await expect(preparePublicRaceDetails({ slugs: [row.slug, "hidden-race"] })).resolves.toEqual({ prepared: 1, next: null });
  await expect(getPublicEventBySlug(row.slug)).resolves.toMatchObject({ slug: row.slug, startDate: row.start_date });
  expect(query.eq.mock.calls).toEqual([["visibility", "public"]]);
  expect(query.in).toHaveBeenLastCalledWith("slug", [row.slug, "hidden-race"]);
  expect(state.from).toHaveBeenCalledTimes(1);
});

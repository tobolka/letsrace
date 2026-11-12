import { expect, it, vi } from "vitest";
import { listOrganiserRaces, type EventListItem } from "@/lib/events";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ from }) }));
vi.mock("next/cache", () => ({
  unstable_cache: (load: (...args: string[]) => unknown) => {
    const results = new Map<string, unknown>();
    return (...args: string[]) => {
      const key = JSON.stringify(args);
      if (!results.has(key)) results.set(key, load(...args));
      return results.get(key);
    };
  },
}));

it("shares paginated reads across organisers and matches exact hosts", async () => {
  const row = (id: string, host: string) => ({
    id, name: id, slug: id, start_date: "2027-05-01", website_url: `https://${host}/race`,
  });
  const first = [row("a", "first.example.org"), row("prefix", "first.example.org.other.com"),
    ...Array.from({ length: 998 }, (_, i) => row(`busy-${i}`, "calendar.example.org"))];
  const range = vi.fn()
    .mockResolvedValueOnce({ data: first, error: null })
    .mockResolvedValueOnce({ data: [row("b", "www.first.example.org"), row("c", "second.example.org")], error: null });
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn(), gte: vi.fn(), not: vi.fn(), order: vi.fn(), range };
  for (const method of [query.select, query.eq, query.is, query.in, query.gte, query.not, query.order]) method.mockReturnValue(query);
  from.mockImplementation(table => table === "watched_urls"
    ? { select: () => ({ in: async () => ({ data: [], error: null }) }) }
    : query);

  const event = (id: string, host: string) => ({ id, websiteUrl: `https://${host}` }) as EventListItem;
  expect((await listOrganiserRaces(event("a", "first.example.org"))).map(race => race.id)).toEqual(["b"]);
  expect((await listOrganiserRaces(event("past", "second.example.org"))).map(race => race.id)).toEqual(["c"]);
  expect(await listOrganiserRaces(event("past", "calendar.example.org"))).toEqual([]);
  expect(range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
});

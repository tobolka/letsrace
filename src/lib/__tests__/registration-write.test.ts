import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), probe: vi.fn(), clear: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.db }));
vi.mock("@/lib/catalog/probes", () => ({ recentlyProbed: async () => new Set(), recordProbe: mocks.probe, clearProbe: mocks.clear }));
import { fillRegistrationLinks } from "@/lib/catalog/registration-links";

const website = "https://my.raceresult.com/1234";
function setup(opts: { changed?: boolean; locked?: boolean; writeError?: boolean } = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: opts.changed !== false, error: opts.writeError ? { message: "write failed" } : null });
  const row = {
    id: "race", name: "Thaur", start_date: "2099-10-11", website_url: website,
    public_revision: "revision", location: null, overrides: opts.locked ? { locked_fields: ["registration_url"] } : null,
  };
  mocks.db.mockReturnValue({ rpc, from: () => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "in", "gte", "not", "order"]) chain[method] = () => chain;
    chain.range = async () => ({ data: [row], error: null });
    return chain;
  } });
  return rpc;
}
beforeEach(() => vi.clearAllMocks());

it("counts a dry-run candidate without committing it", async () => {
  const rpc = setup();
  expect(await fillRegistrationLinks({ max: 1, dryRun: true })).toMatchObject({ proposed: 1, filled: 0 });
  expect(rpc).not.toHaveBeenCalled();
});
it("does not count a raced or failed database update as an improvement", async () => {
  setup({ changed: false });
  expect((await fillRegistrationLinks({ max: 1 })).filled).toBe(0);
  setup({ writeError: true });
  expect(await fillRegistrationLinks({ max: 1 })).toMatchObject({ filled: 0, failed: 1 });
});
it("skips a known human lock before fetching evidence", async () => {
  const rpc = setup({ locked: true });
  expect((await fillRegistrationLinks({ max: 1 })).filled).toBe(0);
  expect(rpc).not.toHaveBeenCalled();
});
it("commits the revision and evidence together before counting success", async () => {
  const rpc = setup();
  expect((await fillRegistrationLinks({ max: 1 })).filled).toBe(1);
  expect(rpc).toHaveBeenCalledWith("pipeline_fill_registration_link", {
    p_event: "race", p_revision: "revision", p_link: website, p_source: website, p_quote: null,
  });
  expect(mocks.clear).toHaveBeenCalledOnce();
});

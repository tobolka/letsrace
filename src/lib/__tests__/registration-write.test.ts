import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), facts: vi.fn(), probe: vi.fn(), clear: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.db }));
vi.mock("@/lib/catalog/facts", () => ({ recordFacts: mocks.facts }));
vi.mock("@/lib/catalog/probes", () => ({ recentlyProbed: async () => new Set(), recordProbe: mocks.probe, clearProbe: mocks.clear }));
import { fillRegistrationLinks } from "@/lib/catalog/registration-links";
const website = "https://my.raceresult.com/1234";
function setup(opts: { changed?: boolean; locked?: boolean; writeError?: boolean } = {}) {
  const update = vi.fn();
  const row = { id: "race", name: "Thaur", start_date: "2099-10-11", website_url: website, location: null, overrides: null };
  mocks.db.mockReturnValue({ from: () => {
    let field = "", writing = false;
    const chain: Record<string, unknown> = {};
    for (const method of ["eq", "is", "in", "gte", "not", "order"]) chain[method] = () => chain;
    chain.select = (selection: string) => { field = selection; return chain; };
    chain.update = (value: unknown) => { update(value); writing = true; return chain; };
    chain.range = async () => ({ data: [row], error: null });
    chain.single = async () => ({ data: field === "registration_url" ? { registration_url: website } : { ...row, overrides: { locked_fields: opts.locked ? ["registration_url"] : [] } }, error: null });
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: writing && opts.changed !== false ? [{ id: "race" }] : [], error: opts.writeError ? { message: "write failed" } : null }).then(resolve);
    return chain;
  } });
  return update;
}
beforeEach(() => { vi.clearAllMocks(); mocks.facts.mockResolvedValue(undefined); });
it("counts a dry-run candidate separately from verified writes", async () => {
  const update = setup(); const result = await fillRegistrationLinks({ max: 1, dryRun: true });
  expect(result).toMatchObject({ proposed: 1, filled: 0 }); expect(update).not.toHaveBeenCalled();
});
it("does not count a raced or failed database update as an improvement", async () => {
  setup({ changed: false }); expect((await fillRegistrationLinks({ max: 1 })).filled).toBe(0);
  setup({ writeError: true }); expect(await fillRegistrationLinks({ max: 1 })).toMatchObject({ filled: 0, failed: 1 });
});
it("rechecks a human lock immediately before writing", async () => {
  const update = setup({ locked: true }); expect((await fillRegistrationLinks({ max: 1 })).filled).toBe(0);
  expect(update).not.toHaveBeenCalled();
});
it("counts success only after recording provenance and reading the saved value", async () => {
  setup(); expect((await fillRegistrationLinks({ max: 1 })).filled).toBe(1);
  expect(mocks.facts).toHaveBeenCalledOnce(); expect(mocks.clear).toHaveBeenCalledOnce();
});

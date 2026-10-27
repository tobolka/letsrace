import { beforeEach, describe, expect, it, vi } from "vitest";

const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics", () => analytics);

const inserted: string[] = [];
let authListener: ((event: string, session: { user: { id: string } } | null) => void) | null = null;
let currentUser: { id: string } | null = null;

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser } }),
      onAuthStateChange: (cb: typeof authListener) => {
        authListener = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from: () => ({
      select: () => ({ eq: async () => ({ data: inserted.map((event_id) => ({ event_id })) }) }),
      insert: async (row: { event_id: string }) => {
        inserted.push(row.event_id);
        return { error: null };
      },
    }),
  }),
}));

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

describe("saving a race before signing in", () => {
  beforeEach(() => {
    vi.resetModules();
    analytics.track.mockClear();
    inserted.length = 0;
    store.clear();
    currentUser = null;
    authListener = null;
  });

  it("asks for sign-in, then adds the waiting race when a session appears", async () => {
    const m = await import("@/lib/saved-races");
    expect(await m.saveRace({ eventId: "race-1", name: "Race", locale: "cs" })).toBe("auth");
    expect(m.hasPendingSave()).toBe(true);
    expect(inserted).toEqual([]);

    authListener!("SIGNED_IN", { user: { id: "u1" } });
    await vi.waitFor(() => expect(inserted).toEqual(["race-1"]));
    expect(m.getSavedRaces().ids.has("race-1")).toBe(true);
    expect(m.hasPendingSave()).toBe(false);
    expect(analytics.track).toHaveBeenCalledWith("plan_save_completed", expect.objectContaining({ auth_required: true }));
  });

  it("finishes the add on a fresh page after a redirect sign-in", async () => {
    store.set("letsrace:pending-plan-add", JSON.stringify({ eventId: "race-2", name: "R", locale: "en", at: Date.now() }));
    currentUser = { id: "u1" };
    const m = await import("@/lib/saved-races");
    await m.startSavedRaces();
    expect(inserted).toEqual(["race-2"]);
    expect(m.hasPendingSave()).toBe(false);
  });

  it("drops a race left waiting for more than a day", async () => {
    store.set("letsrace:pending-plan-add", JSON.stringify({ eventId: "old", name: "R", locale: "en", at: Date.now() - 2 * 86_400_000 }));
    currentUser = { id: "u1" };
    const m = await import("@/lib/saved-races");
    await m.startSavedRaces();
    expect(inserted).toEqual([]);
  });

  it("adds straight away when signed in", async () => {
    currentUser = { id: "u1" };
    const m = await import("@/lib/saved-races");
    expect(await m.saveRace({ eventId: "race-3", name: "R", locale: "en" })).toBe("saved");
    expect(inserted).toEqual(["race-3"]);
    expect(analytics.track).toHaveBeenCalledWith("plan_save_completed", expect.objectContaining({ race_id: "race-3", auth_required: false }));
    analytics.track.mockClear();
    await m.saveRace({ eventId: "race-3", name: "R", locale: "en" });
    expect(analytics.track).not.toHaveBeenCalled();
  });
});

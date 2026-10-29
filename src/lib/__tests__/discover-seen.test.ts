import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDiscoverPath, unseenDiscoverCount } from "@/lib/discover-seen";
import { locales } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.resetModules();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

const earlier = "2026-10-29T18:00:00.000Z";
const visited = "2026-10-29T19:00:00.000Z";
const later = "2026-10-29T20:00:00.000Z";

describe("Discover navigation badge", () => {
  it("clears previously seen races and counts only new deliveries, once per race", () => {
    const old = [{ eventId: "a", createdAt: earlier }, { eventId: "b", createdAt: earlier }];
    expect(unseenDiscoverCount(old, null)).toBe(2);
    expect(unseenDiscoverCount(old, visited)).toBe(0);
    expect(unseenDiscoverCount([...old, { eventId: "c", createdAt: later }, { eventId: "c", createdAt: later }], visited)).toBe(1);
    expect(unseenDiscoverCount([{ eventId: "a", createdAt: visited }], visited)).toBe(0);
  });

  it("recognizes the section in every language without matching another page", () => {
    for (const locale of locales) {
      expect(isDiscoverPath(localePath(locale, "account/recommendations"))).toBe(true);
      expect(isDiscoverPath(localePath(locale, "account/alerts"))).toBe(true);
      expect(isDiscoverPath(localePath(locale, "account"))).toBe(false);
      expect(isDiscoverPath(`${localePath(locale, "account/recommendations")}-other`)).toBe(false);
    }
    expect(isDiscoverPath(null)).toBe(false);
  });

  it("remembers a visit after reload, separately for each account", async () => {
    const first = await import("@/lib/discover-seen");
    first.markDiscoverSeen("user-a", visited);
    first.markDiscoverSeen("user-a", earlier);
    expect(first.readDiscoverSeen("user-a")).toBe(visited);
    expect(first.readDiscoverSeen("user-b")).toBeNull();
    vi.resetModules();
    const reloaded = await import("@/lib/discover-seen");
    expect(reloaded.readDiscoverSeen("user-a")).toBe(visited);
    expect(reloaded.readDiscoverSeen(null)).toBeNull();
  });

  it("notifies both navigation instances and works with unavailable storage", async () => {
    const seenStore = await import("@/lib/discover-seen");
    const sidebar = vi.fn();
    const mobile = vi.fn();
    const off = seenStore.subscribeDiscoverSeen(sidebar);
    seenStore.subscribeDiscoverSeen(mobile);
    vi.stubGlobal("window", {
      localStorage: { getItem() { throw Error(); }, setItem() { throw Error(); } },
      removeEventListener: vi.fn(),
    });
    seenStore.markDiscoverSeen("user-a", visited);
    expect(seenStore.readDiscoverSeen("user-a")).toBe(visited);
    expect(sidebar).toHaveBeenCalledOnce();
    expect(mobile).toHaveBeenCalledOnce();
    off();
    seenStore.markDiscoverSeen("user-a", later);
    expect(sidebar).toHaveBeenCalledOnce();
    expect(mobile).toHaveBeenCalledTimes(2);
  });
});

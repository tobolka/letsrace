import { describe, expect, it } from "vitest";
import type { EventListItem } from "@/lib/events";
import { reuseUnchanged } from "@/lib/reuse-unchanged";

const race = (id: string, patch: Partial<EventListItem> = {}) =>
  ({ id, name: id, startDate: "2026-10-24", status: "scheduled", lastSeenAt: "t1", ...patch }) as EventListItem;

describe("reuseUnchanged", () => {
  it("hands back the very same list when nothing changed", () => {
    const prev = [race("a"), race("b")];
    const next = [race("a"), race("b")];
    expect(reuseUnchanged(prev, next)).toBe(prev);
  });

  it("keeps the old object for a race that did not change and takes the new one for one that did", () => {
    const prev = [race("a"), race("b")];
    const next = [race("a"), race("b", { name: "renamed" })];
    const out = reuseUnchanged(prev, next);
    expect(out).not.toBe(prev);
    expect(out[0]).toBe(prev[0]);
    expect(out[1]).toBe(next[1]);
  });

  it.each([
    ["last seen", { lastSeenAt: "t2" }],
    ["start date", { startDate: "2026-10-25" }],
    ["status", { status: "cancelled" }],
  ])("sees a change of %s", (_what, patch) => {
    const out = reuseUnchanged([race("a")], [race("a", patch as Partial<EventListItem>)]);
    expect(out[0]).toMatchObject(patch);
  });

  it("is a new list when races came or went, or changed places", () => {
    const a = race("a");
    const b = race("b");
    expect(reuseUnchanged([a], [a, b])).toEqual([a, b]);
    expect(reuseUnchanged([a, b], [a])).toEqual([a]);
    const swapped = reuseUnchanged([a, b], [race("b"), race("a")]);
    expect(swapped.map((e) => e.id)).toEqual(["b", "a"]);
    expect(swapped).not.toEqual([a, b]);
  });

  it("takes the new list as it is when there was no old one", () => {
    const next = [race("a")];
    expect(reuseUnchanged([], next)).toBe(next);
  });
});

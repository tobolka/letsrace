import type { EventListItem } from "@/lib/events";

/**
 * Keep the object a race already had when the fetch brought back the same race.
 *
 * Most of what a viewport query returns is what it returned last time, but
 * every row came back as a brand-new object, so every card was a new prop and
 * every memo was defeated: a background refetch — the one the map fires after
 * it finds you — re-rendered the whole list, and did it while the sheet was
 * moving.
 *
 * `last_seen_at` moves whenever the watcher touches a race, so it is the
 * cheapest honest test for "this row has not changed".
 */
export function reuseUnchanged(prev: EventListItem[], next: EventListItem[]): EventListItem[] {
  if (prev.length === 0) return next;
  const before = new Map(prev.map((e) => [e.id, e]));
  let changed = prev.length !== next.length;
  const out = next.map((e, i) => {
    const old = before.get(e.id);
    const same =
      old &&
      old.lastSeenAt === e.lastSeenAt &&
      old.startDate === e.startDate &&
      old.name === e.name &&
      old.status === e.status;
    if (!same) changed = true;
    else if (prev[i]?.id !== e.id) changed = true;
    return same ? old : e;
  });
  return changed ? out : prev;
}

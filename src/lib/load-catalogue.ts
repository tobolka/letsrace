import type { EventListItem } from "@/lib/events";

let pending: Promise<EventListItem[]> | null = null;
let expiresAt = 0;

/** One shared request for the map, the list and the calendar. The CDN holds it. */
export function loadCatalogue(): Promise<EventListItem[]> {
  if (pending && Date.now() >= expiresAt) pending = null;
  if (!pending) {
    expiresAt = Infinity;
    pending = fetch("/api/events?catalogue=1")
      .then(async (res) => {
        if (!res.ok) throw new Error(`catalogue ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid catalogue response");
        expiresAt = Date.now() + 5 * 60_000;
        return data as EventListItem[];
      })
      .catch((err: unknown) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

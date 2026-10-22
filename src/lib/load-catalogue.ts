import type { EventListItem } from "@/lib/events";

let pending: Promise<EventListItem[]> | null = null;

/** One shared request for the map, the list and the calendar. The CDN holds it. */
export function loadCatalogue(): Promise<EventListItem[]> {
  if (!pending) {
    pending = fetch("/api/events?catalogue=1")
      .then(async (res) => {
        if (!res.ok) throw new Error(`catalogue ${res.status}`);
        return (await res.json()) as EventListItem[];
      })
      .catch((err: unknown) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

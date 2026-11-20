/**
 * The text of a radsport-events.de event page. The page itself is built by a script and has no text for a plain
 * request, so the words a reader sees are taken from the site's own API, which holds them: the title, the place, the
 * day, the kind of race and the description. Used to check a quote against such a page.
 */
export const radsportEventId = (url: string): string | null => /^https?:\/\/(?:www\.)?radsport-events\.de\/events\/(\d+)\/?$/i.exec(url)?.[1] ?? null;

type ApiEvent = { title?: string | null; description?: string | null; locationName?: string | null; city?: string | null; address?: string | null; eventDate?: string | null; endDate?: string | null; category?: string | null; eventType?: string | null; organizerUrl?: string | null };

export function radsportEventText(event: ApiEvent): string {
  return [event.title, event.locationName, event.address, event.city, event.eventDate, event.endDate, event.category, event.eventType, event.description, event.organizerUrl]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0).join("\n");
}

export async function readRadsportEvent(url: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  const id = radsportEventId(url);
  if (!id) return null;
  const res = await fetcher(`https://api.radsport-events.de/api/v1/events/${id}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res?.ok) return null;
  return radsportEventText(await res.json().catch(() => ({})) as ApiEvent);
}

import { locales } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";

const PREFIX = "letsrace:discover-seen:v1:";
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

/** Both recommendations and its alert settings belong to Discover. */
export function isDiscoverPath(pathname: string | null): boolean {
  return !!pathname && locales.some((locale) =>
    ["recommendations", "alerts"].some((section) => {
      const base = localePath(locale, `account/${section}`);
      return pathname === base || pathname.startsWith(`${base}/`);
    }),
  );
}

export function readDiscoverSeen(userId: string | null): string | null {
  if (!userId) return null;
  let stored: string | null = null;
  try { stored = window.localStorage.getItem(`${PREFIX}${userId}`); } catch { /* Storage can be disabled. */ }
  const cached = memory.get(userId) ?? null;
  const valid = stored && Number.isFinite(Date.parse(stored)) ? stored : null;
  return valid && (!cached || valid > cached) ? valid : cached;
}

export function markDiscoverSeen(userId: string, at: string): void {
  const previous = readDiscoverSeen(userId);
  if (previous && previous >= at) return;
  memory.set(userId, at);
  try { window.localStorage.setItem(`${PREFIX}${userId}`, at); } catch { /* Keep the visit in memory. */ }
  listeners.forEach((listener) => listener());
}

export function subscribeDiscoverSeen(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export type DiscoverHit = { eventId: string; createdAt: string };

export function unseenDiscoverCount(hits: DiscoverHit[], seenAt: string | null): number {
  const seenTime = seenAt ? Date.parse(seenAt) : -Infinity;
  return new Set(hits.filter((hit) => Date.parse(hit.createdAt) > seenTime).map((hit) => hit.eventId)).size;
}

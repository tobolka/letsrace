"use client";

import { useSyncExternalStore } from "react";

/**
 * The signed-in family's riders who have a birth year: what the race card and
 * the race page need to point at the right category. One query per page, shared
 * by every card; nobody signed in, or nobody with a birth year, is an empty list.
 *
 * The auth client is fetched after the page is up, as for the plan buttons.
 */
export type Rider = { id: string; name: string; birthYear: number; isSelf: boolean };

const EMPTY: Rider[] = [];
let riders: Rider[] = EMPTY;
let started = false;
let userId: string | null = null;
const listeners = new Set<() => void>();
let reload: (() => void) | null = null;

function set(next: Rider[]) {
  riders = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void (async () => {
    try {
      const { createBrowserSupabase } = await import("@/lib/supabase/browser");
      const client = createBrowserSupabase();
      const load = async (id: string | null) => {
        userId = id;
        if (!id) return set(EMPTY);
        const { data } = await client
          .from("family_members")
          .select("id, name, birth_year, is_self")
          .eq("user_id", id)
          .not("birth_year", "is", null)
          .order("created_at");
        if (userId !== id) return;
        set(
          (data ?? [])
            .filter((m) => typeof m.birth_year === "number")
            .map((m) => ({ id: m.id, name: m.name, birthYear: m.birth_year as number, isSelf: Boolean(m.is_self) })),
        );
      };
      reload = () => void load(userId);
      const { data } = await client.auth.getSession();
      await load(data.session?.user?.id ?? null);
      client.auth.onAuthStateChange((_event, session) => {
        const id = session?.user?.id ?? null;
        if (id === userId) return;
        // Querying inside Supabase's auth callback deadlocks on its lock.
        setTimeout(() => void load(id), 0);
      });
    } catch {
      set(EMPTY);
    }
  })();
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** After the family's riders change on the account page. */
export function refreshRiders() {
  reload?.();
}

/** The family's riders with a birth year; empty until known, and for visitors. */
export function useRiders(): Rider[] {
  return useSyncExternalStore(subscribe, () => riders, () => EMPTY);
}

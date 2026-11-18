"use client";

import { useSyncExternalStore } from "react";
import { asRiderGender, type RiderGender } from "@/lib/rider-category";

/**
 * The signed-in family's riders who have a birth year: what the race card and
 * the race page need to point at the right category. One query per page, shared
 * by every card; nobody signed in, or nobody with a birth year, is an empty list.
 *
 * The auth client is fetched after the page is up, as for the plan buttons.
 */
export type Rider = { id: string; name: string; birthYear: number; isSelf: boolean; gender?: RiderGender | null };
/** Anyone in the family, with what the race filter can use: the birth year and the disciplines they ride. */
export type FamilyRider = Omit<Rider, "birthYear"> & { birthYear: number | null; disciplines: string[] };

const EMPTY: Rider[] = [];
const NO_FAMILY: FamilyRider[] = [];
let riders: Rider[] = EMPTY;
let family: FamilyRider[] = NO_FAMILY;
let started = false;
let userId: string | null = null;
const listeners = new Set<() => void>();
let reload: (() => void) | null = null;

function set(next: FamilyRider[]) {
  family = next.length ? next : NO_FAMILY;
  const withYear = next.filter((m): m is FamilyRider & { birthYear: number } => m.birthYear != null).map(({ disciplines: _d, ...m }) => m);
  riders = withYear.length ? withYear : EMPTY;
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
        if (!id) return set(NO_FAMILY);
        const { data } = await client
          .from("family_members")
          .select("id, name, birth_year, is_self, gender, preferred_disciplines")
          .eq("user_id", id)
          .order("created_at");
        if (userId !== id) return;
        set(
          (data ?? []).map((m) => ({
            id: m.id,
            name: m.name,
            birthYear: typeof m.birth_year === "number" ? m.birth_year : null,
            isSelf: Boolean(m.is_self),
            gender: asRiderGender(m.gender),
            disciplines: Array.isArray(m.preferred_disciplines) ? m.preferred_disciplines.filter((d): d is string => typeof d === "string") : [],
          })),
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
      set(NO_FAMILY);
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

/** Everyone in the signed-in family, for the race filter; empty for visitors. */
export function useFamilyRiders(): FamilyRider[] {
  return useSyncExternalStore(subscribe, () => family, () => NO_FAMILY);
}

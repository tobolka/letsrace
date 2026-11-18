"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSavedRaceIds } from "@/hooks/use-saved-races";
import type { PlannedRace, TakenDay } from "@/lib/same-day";

/**
 * The signed-in family's planned races and days marked as taken, for the
 * "you already have something that day" note. One load per page; it loads
 * again when a race is added to or removed from the plan. Empty for visitors.
 */
type MyDays = { races: PlannedRace[]; days: TakenDay[] };

const EMPTY: MyDays = { races: [], days: [] };
let state: MyDays = EMPTY;
let started = false;
let userId: string | null = null;
let reload: (() => void) | null = null;
/** The plan as last seen, so opening another race does not ask again. */
let lastPlanKey: string | null = null;
const listeners = new Set<() => void>();

function set(next: MyDays) {
  state = next.races.length || next.days.length ? next : EMPTY;
  listeners.forEach((l) => l());
}

type EventRow = { id: string; name: string; slug: string; start_date: string; end_date: string | null };
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

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
        const from = new Date().toISOString().slice(0, 10);
        const embed = "event:events(id, name, slug, start_date, end_date)";
        const [{ data: favs }, { data: att }, { data: blocked }] = await Promise.all([
          client.from("event_favorites").select(embed).eq("user_id", id),
          client.from("event_attendance").select(embed).eq("user_id", id),
          client.from("blocked_days").select("day, note").eq("user_id", id).gte("day", from),
        ]);
        if (userId !== id) return;
        const races = [...(favs ?? []), ...(att ?? [])]
          .map((row) => one(row.event as EventRow | EventRow[] | null))
          .filter((e): e is EventRow => Boolean(e) && (e!.end_date ?? e!.start_date) >= from)
          .map((e) => ({ id: e.id, name: e.name, slug: e.slug, startDate: e.start_date, endDate: e.end_date }));
        set({ races, days: (blocked ?? []).map((d) => ({ day: d.day, note: d.note })) });
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

/** The family's planned races and taken days; follows the plan as races are saved. */
export function useMyDays(): MyDays {
  const ids = useSavedRaceIds();
  const key = [...ids].sort().join(",");
  useEffect(() => {
    if (lastPlanKey !== null && lastPlanKey !== key) reload?.();
    lastPlanKey = key;
  }, [key]);
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

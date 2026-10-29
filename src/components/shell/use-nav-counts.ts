"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { todayIso } from "@/lib/date-presets";
import { isDiscoverPath, markDiscoverSeen, readDiscoverSeen, subscribeDiscoverSeen, unseenDiscoverCount, type DiscoverHit } from "@/lib/discover-seen";

export type NavCounts = { action: number; alerts: number };

/**
 * What still needs doing, on the navigation itself.
 *
 * Without it the only way to find out whether anything is outstanding is to go
 * and look. Nothing is fetched for a visitor who is not signed in.
 */
const NONE: NavCounts = { action: 0, alerts: 0 };

/**
 * `authed` gates the answer as well as the fetch: counts from before a sign-out
 * must not linger on the icons of somebody who is no longer signed in.
 */
export function useNavCounts(refreshKey: string | null, authed: boolean | null): NavCounts {
  const [snapshot, setSnapshot] = useState<{ userId: string | null; action: number; hits: DiscoverHit[] }>({ userId: null, action: 0, hits: [] });
  const seenAt = useSyncExternalStore(
    subscribeDiscoverSeen,
    () => readDiscoverSeen(snapshot.userId),
    () => null,
  );
  const visitingDiscover = isDiscoverPath(refreshKey);

  useEffect(() => {
    let alive = true;
    if (authed !== true) return;
    void (async () => {
      const visitStartedAt = new Date().toISOString();
      const supabase = createBrowserSupabase();
      const { data: auth } = await supabase.auth.getUser();
      if (!alive) return;
      if (!auth.user) {
        setSnapshot({ userId: null, action: 0, hits: [] });
        return;
      }
      const today = todayIso();
      const since = new Date();
      since.setDate(since.getDate() - 14);

      const [{ data: atts }, { data: alertRows, error: alertError }] = await Promise.all([
        supabase
          .from("event_attendance")
          .select("event_id, status, registered, paid, event:events(start_date)")
          .eq("user_id", auth.user.id),
        supabase.from("race_alerts").select("id").eq("user_id", auth.user.id).eq("enabled", true),
      ]);

      const unsettled = new Set<string>();
      for (const row of atts ?? []) {
        const ev = Array.isArray(row.event) ? row.event[0] : row.event;
        if (!ev || ev.start_date < today) continue;
        if (row.status !== "none" && !row.paid) unsettled.add(row.event_id);
      }

      // The same set the inbox shows: one per race, and only races still ahead.
      // Counting raw deliveries said "11" over a list of six.
      const fresh: DiscoverHit[] = [];
      let alertsLoaded = !alertError;
      if (alertRows && alertRows.length > 0) {
        const { data: hits, error: hitsError } = await supabase
          .from("race_alert_deliveries")
          .select("event_id, created_at, event:events(start_date, end_date)")
          .in("alert_id", alertRows.map((a) => a.id))
          .gte("created_at", since.toISOString());
        alertsLoaded = !hitsError;
        for (const hit of hits ?? []) {
          const ev = Array.isArray(hit.event) ? hit.event[0] : hit.event;
          if (ev && (ev.end_date ?? ev.start_date) >= today) fresh.push({ eventId: hit.event_id, createdAt: hit.created_at });
        }
      }
      if (alive) {
        // A completed visit acknowledges what was available when it started.
        // A delivery arriving during loading remains new on the next visit.
        if (visitingDiscover && alertsLoaded) markDiscoverSeen(auth.user.id, visitStartedAt);
        setSnapshot({ userId: auth.user.id, action: unsettled.size, hits: fresh });
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey, authed, visitingDiscover]);

  return authed === true ? {
    action: snapshot.action,
    alerts: visitingDiscover ? 0 : unseenDiscoverCount(snapshot.hits, seenAt),
  } : NONE;
}

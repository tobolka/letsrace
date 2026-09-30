"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { todayIso } from "@/lib/date-presets";

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
  const [counts, setCounts] = useState<NavCounts>(NONE);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const supabase = createBrowserSupabase();
      const { data: auth } = await supabase.auth.getUser();
      if (!alive) return;
      if (!auth.user) {
        setCounts(NONE);
        return;
      }
      const today = todayIso();
      const since = new Date();
      since.setDate(since.getDate() - 14);

      const [{ data: atts }, { data: alertRows }] = await Promise.all([
        supabase
          .from("event_attendance")
          .select("event_id, status, registered, paid, event:events(start_date)")
          .eq("user_id", auth.user.id),
        supabase.from("race_alerts").select("id").eq("user_id", auth.user.id).eq("enabled", true),
      ]);

      const unsettled = new Set<string>();
      for (const row of (atts ?? []) as unknown as {
        event_id: string;
        status: string;
        paid: boolean;
        event: { start_date: string } | { start_date: string }[] | null;
      }[]) {
        const ev = Array.isArray(row.event) ? row.event[0] : row.event;
        if (!ev || ev.start_date < today) continue;
        if (row.status !== "none" && !row.paid) unsettled.add(row.event_id);
      }

      // The same set the inbox shows: one per race, and only races still ahead.
      // Counting raw deliveries said "11" over a list of six.
      let alerts = 0;
      if (alertRows && alertRows.length > 0) {
        const { data: hits } = await supabase
          .from("race_alert_deliveries")
          .select("event_id, event:events(start_date, end_date)")
          .in("alert_id", alertRows.map((a) => a.id))
          .gte("created_at", since.toISOString());
        const fresh = new Set<string>();
        for (const hit of (hits ?? []) as unknown as {
          event_id: string;
          event:
            | { start_date: string; end_date: string | null }
            | { start_date: string; end_date: string | null }[]
            | null;
        }[]) {
          const ev = Array.isArray(hit.event) ? hit.event[0] : hit.event;
          if (ev && (ev.end_date ?? ev.start_date) >= today) fresh.add(hit.event_id);
        }
        alerts = fresh.size;
      }
      if (alive) setCounts({ action: unsettled.size, alerts });
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey, authed]);

  return authed === true ? counts : NONE;
}

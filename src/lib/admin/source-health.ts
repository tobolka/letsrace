/**
 * Is a quiet source finished for the season, or broken?
 *
 * Nothing in the catalogue distinguished the two, and the difference was worth
 * 57% of the Czech calendar: `portal.czechcyclingfederation.com` sat `active`
 * with `last_extract_status: "off_season"` while returning 369 races on
 * request. Six sources were in that state at once, and the admin showed a green
 * "active" count for all of them.
 *
 * A source is *stalled* when its own record says it has nothing while the site
 * still lists races, or when it simply has not been read in a long time. Both
 * are silent, and both need a person.
 */
import { createServerSupabase } from "@/lib/supabase/server";

/** Recorded states that claim "nothing here" — the ones worth double-checking. */
const QUIET_STATES = ["off_season", "error", "needs_review"] as const;

/** A calendar unread for this long is stalled whatever its recorded state. */
const STALE_DAYS = 10;

export type StalledSource = {
  id: string;
  url: string;
  kind: string;
  recordedState: string | null;
  lastError: string | null;
  lastFetchedAt: string | null;
  daysSinceFetch: number | null;
  /** Why it is on the list, in words that fit a table cell. */
  reason: "never read" | "not read recently" | "quiet but listing races" | "erroring";
  /** Races the source returns right now — only filled by the verifying pass. */
  liveRaces?: number;
};

export type SourceHealthReport = {
  activeCalendars: number;
  stalled: StalledSource[];
  checkedAt: string;
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

const CALENDAR_KINDS = ["series", "federation", "aggregator", "calendar"];

/**
 * Cheap pass: judge on the stored record alone, no network.
 *
 * Safe to run on every admin page load. It over-reports — a genuinely
 * off-season calendar looks the same as a broken one from here — which is the
 * point: those are exactly the rows a person should glance at.
 */
export async function getSourceHealth(): Promise<SourceHealthReport> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("watched_urls")
    .select("id,url,kind,status,last_extract_status,last_error,last_fetched_at")
    .eq("status", "active")
    .in("kind", CALENDAR_KINDS);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const stalled: StalledSource[] = [];
  for (const row of rows) {
    const days = daysSince(row.last_fetched_at as string | null);
    const state = (row.last_extract_status as string | null) ?? null;
    let reason: StalledSource["reason"] | null = null;

    if (!row.last_fetched_at) reason = "never read";
    else if (days != null && days >= STALE_DAYS) reason = "not read recently";
    else if (state === "error" || row.last_error) reason = "erroring";
    else if (QUIET_STATES.includes(state as (typeof QUIET_STATES)[number])) {
      reason = "quiet but listing races";
    }
    if (!reason) continue;

    stalled.push({
      id: row.id as string,
      url: row.url as string,
      kind: row.kind as string,
      recordedState: state,
      lastError: (row.last_error as string | null) ?? null,
      lastFetchedAt: (row.last_fetched_at as string | null) ?? null,
      daysSinceFetch: days,
      reason,
    });
  }

  stalled.sort((a, b) => (b.daysSinceFetch ?? 9999) - (a.daysSinceFetch ?? 9999));
  return {
    activeCalendars: rows.length,
    stalled,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Expensive pass: ask each suspect what it actually returns.
 *
 * Confirms the cheap pass by fetching, so "off_season" can be told apart from
 * "broken". Meant for the cron and the admin's explicit re-check button, never
 * for a page render.
 */
export async function verifyStalledSources(
  stalled: StalledSource[],
  opts?: { concurrency?: number; limit?: number },
): Promise<StalledSource[]> {
  const { previewUrl } = await import("@/lib/watcher/run");
  const { mapPool } = await import("@/lib/watcher/pool");
  const subset = stalled.slice(0, opts?.limit ?? 60);

  return mapPool(subset, opts?.concurrency ?? 4, async (row) => {
    try {
      const preview = await previewUrl(row.url);
      return { ...row, liveRaces: preview.ok ? preview.events.length : 0 };
    } catch {
      return { ...row, liveRaces: 0 };
    }
  });
}

/** Stalled sources that demonstrably still have races — the ones losing data. */
export function losingRaces(verified: StalledSource[]): StalledSource[] {
  return verified
    .filter((s) => (s.liveRaces ?? 0) > 0)
    .sort((a, b) => (b.liveRaces ?? 0) - (a.liveRaces ?? 0));
}

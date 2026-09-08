/**
 * A race that has happened says so.
 *
 * `completed` has been in `EVENT_STATUSES` since the beginning and nothing
 * ever wrote it, so every race the catalogue has ever carried still sits at
 * `scheduled` — fifteen hundred of them public and more than three months
 * past. Nobody sees it on the map, which filters by date, but the catalogue
 * was stating that a race in April is going to happen.
 *
 * Deliberately narrow about what counts as run:
 *
 *   - Only `scheduled` and `registration_open`. A `postponed` race did not
 *     take place on its old date — that is what postponed means — and a
 *     `cancelled` one did not take place at all.
 *   - The last day, not the first. A stage race that starts on Friday is not
 *     over until Sunday.
 *   - Strictly before today, so nothing flips while it is still being ridden
 *     anywhere in Europe.
 *   - Never a locked row. An editor who set a status by hand meant it.
 */
import { createServerSupabase } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/read-all";

export type CompletableEvent = {
  id: string;
  status: string | null;
  start_date: string;
  end_date: string | null;
};

/** Statuses that a day passing turns into `completed`. */
const RUNS_ON_ITS_DATE = new Set(["scheduled", "registration_open"]);

/** The last day the race occupies. */
export function lastDay(event: Pick<CompletableEvent, "start_date" | "end_date">): string {
  const end = (event.end_date ?? "").slice(0, 10);
  const start = event.start_date.slice(0, 10);
  return end && end > start ? end : start;
}

/** True when `today` has moved past the race and its status still says otherwise. */
export function hasRun(event: CompletableEvent, today: string): boolean {
  if (!RUNS_ON_ITS_DATE.has(event.status ?? "")) return false;
  return lastDay(event) < today;
}

export type CompletePastResult = {
  scanned: number;
  completed: number;
  skippedLocked: number;
  failed: number;
};

export async function completePastEvents(opts?: {
  today?: string;
  max?: number;
  dryRun?: boolean;
}): Promise<CompletePastResult> {
  const supabase = createServerSupabase();
  const today = opts?.today ?? new Date().toISOString().slice(0, 10);
  const max = opts?.max ?? 2000;

  const rows = await readAllRows<
    CompletableEvent & { overrides: { locked_fields: string[] | null }[] | null }
  >((from, to) =>
    supabase
      .from("events")
      .select("id, status, start_date, end_date, overrides:event_overrides(locked_fields)")
      .in("status", [...RUNS_ON_ITS_DATE])
      .lt("start_date", today)
      .order("id", { ascending: true })
      .range(from, to),
  );

  const result: CompletePastResult = {
    scanned: rows.length,
    completed: 0,
    skippedLocked: 0,
    failed: 0,
  };

  const due: string[] = [];
  for (const row of rows) {
    if (!hasRun(row, today)) continue;
    const locked = (Array.isArray(row.overrides) ? row.overrides : [])
      .flatMap((o) => o.locked_fields ?? []);
    if (locked.includes("status")) {
      result.skippedLocked += 1;
      continue;
    }
    due.push(row.id);
  }

  if (opts?.dryRun) {
    result.completed = Math.min(due.length, max);
    return result;
  }

  // In batches: a single `.in()` of two thousand ids is a URL no gateway wants.
  for (let i = 0; i < Math.min(due.length, max); i += 100) {
    const batch = due.slice(i, i + 100);
    const { error } = await supabase
      .from("events")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .in("id", batch);
    if (error) result.failed += batch.length;
    else result.completed += batch.length;
  }
  return result;
}

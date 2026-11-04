import { createHash } from "node:crypto";
import type { ParsedEvent } from "@/lib/domain";
import type { Json } from "@/lib/supabase/database.types";

type Entry = { hash: string; until: number; conflicts: number };
export const MAX_CALENDAR_PROGRESS_ROWS = 2000;
export const isEventWriteConflict = (error: string) => /^(?:(?:Creating|Updating|Inserting) race: )?concurrent_event_update\b/.test(error);

export function calendarRowHash(event: ParsedEvent) {
  return createHash("sha256").update(JSON.stringify(event, (_, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  )).digest("hex");
}

export function readCalendarProgress(value: Json | undefined, version: string) {
  const entries = new Map<string, Entry>();
  if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== version || !Array.isArray(value.rows) || value.rows.length > MAX_CALENDAR_PROGRESS_ROWS) return entries;
  for (const row of value.rows) {
    if (Array.isArray(row) && row.length === 4) {
      const [id, hash, until, conflicts] = row;
      if (typeof id === "string" && typeof hash === "string" && typeof until === "number" && Number.isInteger(until) && typeof conflicts === "number" && Number.isInteger(conflicts) && conflicts >= 0 && conflicts <= 4) {
        entries.set(id, { hash, until, conflicts });
      }
    }
  }
  return entries;
}

export function calendarRowProgress(hash: string, now: number, conflicts: number): Entry {
  const delay = [7 * 86400_000, 30 * 60_000, 2 * 3600_000, 86400_000, 7 * 86400_000];
  const count = Math.min(4, conflicts);
  return { hash, until: now + delay[count]!, conflicts: count };
}

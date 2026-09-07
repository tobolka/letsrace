import { parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";

/** Parse ISO date filter strings into a day-picker range (no calendar import). */
export function isoToRange(dateFrom: string, dateTo: string): DateRange | undefined {
  if (!dateFrom) return undefined;
  const from = parseISO(dateFrom);
  if (Number.isNaN(from.getTime())) return undefined;
  if (!dateTo) return { from };
  const to = parseISO(dateTo);
  return { from, to: Number.isNaN(to.getTime()) ? undefined : to };
}

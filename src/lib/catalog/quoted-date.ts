import { firstDateIn } from "@/lib/watcher/registration-deadline";
import { textNamesDate } from "@/lib/date-in-text";
import { fold } from "@/lib/text-match";

/** A full day and month must be stated; a day number alone is not a date. */
export function quoteStatesDate(quote: string, date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  // Calendar ranges such as 10.–11.10.2026: test the opening day.
  const text = fold(quote).replace(/\b(\d{1,2})\.?\s*[-–]\s*\d{1,2}([./]\s*\d{1,2}[./](?:\s*\d{2,4})?)/g, "$1$2");
  const first = firstDateIn(text, Number(date.slice(0, 4)));
  if (first) return first === date;
  // Month-first English and French/Dutch month names supported by the shared reader.
  const years: string[] = text.match(/\b20\d{2}\b/g) ?? [];
  return (!years.length || years.includes(date.slice(0, 4))) && textNamesDate(text, date);
}

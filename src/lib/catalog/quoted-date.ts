import { firstDateIn } from "@/lib/watcher/registration-deadline";
import { textNamesDate } from "@/lib/date-in-text";
import { fold } from "@/lib/text-match";

/** A full day and month must be stated; a day number alone is not a date. */
export function quoteStatesDate(quote: string, date: string, options?: { role?: "start" | "end" }): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const normalized = fold(quote);
  const numericRange = normalized.match(/\b(\d{1,2})\.\s*(?:(\d{1,2})\.\s*)?[-–]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})\b/);
  const namedRange = normalized.match(/\b(\d{1,2})\.?\s*[-–]\s*(\d{1,2})\.?\s*([a-z]+)\s*(20\d{2})\b/);
  const months = ["leden ledna lednu january januar", "unor unora unoru february februar", "brezen brezna breznu march marec",
    "duben dubna dubnu april", "kveten kvetna kvetnu maj may", "cerven cervna cervnu jun june", "cervenec cervence cervenci jul july",
    "srpen srpna srpnu august", "zari september", "rijen rijna rijnu october oktober", "listopad listopadu november", "prosinec prosince prosinci december"];
  const iso = (y: string, m: string, d: string) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  let span: [string, string] | null = null;
  if (numericRange) span = [iso(numericRange[5], numericRange[2] ?? numericRange[4], numericRange[1]), iso(numericRange[5], numericRange[4], numericRange[3])];
  else if (namedRange) {
    const month = months.findIndex(words => words.split(" ").includes(namedRange[3]));
    if (month >= 0) span = [iso(namedRange[4], String(month + 1), namedRange[1]), iso(namedRange[4], String(month + 1), namedRange[2])];
  }
  if (span) return span.every(d => Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d) && span[0] <= span[1] && span[options?.role === "end" ? 1 : 0] === date;
  // Calendar ranges such as 10.–11.10.2026: test the opening day.
  const text = normalized.replace(/\b(\d{1,2})\.?\s*[-–]\s*\d{1,2}([./]\s*\d{1,2}[./](?:\s*\d{2,4})?)/g, "$1$2");
  const first = firstDateIn(text, Number(date.slice(0, 4)));
  if (first) return first === date;
  // Month-first English and French/Dutch month names supported by the shared reader.
  const years: string[] = text.match(/\b20\d{2}\b/g) ?? [];
  return (!years.length || years.includes(date.slice(0, 4))) && textNamesDate(text, date);
}

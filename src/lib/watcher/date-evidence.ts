import { textNamesDate } from "@/lib/date-in-text";
import type { ParsedEvent } from "@/lib/domain";

/**
 * A quote for a race a reader found without one.
 *
 * Readers of structured calendars (adapters, JSON-LD) say what the race's date is, but do not keep
 * the words it was read from. Without those words a changed date has no proof and waits for a
 * person. The page text is the second way to check it: when the race's own name stands in the page
 * and, within a short window of it, the date is written with its full year, that window is the
 * quote. It is a literal piece of the page, so it is checked like any other quote.
 *
 * Nothing is invented: a race whose name is not in the text, whose date is not written beside it, or
 * whose end date is not named as well, gets no quote and keeps waiting as before.
 */
const WINDOW = 160;
const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ");

function namePositions(text: string, name: string): number[] {
  // The identifying part of the name: words of three letters or more, so "MTB" and "Cup" alone do not anchor it.
  const words = fold(name).replace(/\b20\d\d\b/g, " ").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3);
  if (words.length < 2 && !(words[0] && words[0].length >= 6)) return [];
  const needle = words.slice(0, 3).join(" ");
  const out: number[] = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at < 0 || out.length >= 20) break;
    out.push(at);
    from = at + needle.length;
  }
  return out;
}

/**
 * "12.–13. 6. 2027" and "12–13 June 2027" name two days under one month and year. The date reader
 * knows single days, so the range is also spelled out as the two days it covers, for the check only.
 */
function withRangesSpelledOut(window: string): string {
  const extra: string[] = [];
  const range = /(?<!\d)(\d{1,2})\s*\.?\s*[–—-]\s*(\d{1,2})\s*\.?\s*(\d{1,2}\s*\.|\p{L}+\.?)\s*(20\d\d)/gu;
  for (const m of window.matchAll(range)) extra.push(`${m[1]}. ${m[3]} ${m[4]}`, `${m[2]}. ${m[3]} ${m[4]}`);
  return extra.length ? `${window} ${extra.join(" ; ")}` : window;
}

export function dateQuote(text: string, event: { name: string; startDate: string; endDate?: string | null }): string | null {
  const year = event.startDate.slice(0, 4);
  const folded = fold(text);
  for (const at of namePositions(folded, event.name)) {
    const from = Math.max(0, at - 40), to = Math.min(folded.length, at + WINDOW);
    const window = folded.slice(from, to);
    const checked = withRangesSpelledOut(window);
    if (!window.includes(year) || !textNamesDate(checked, event.startDate)) continue;
    if (event.endDate && event.endDate !== event.startDate && !textNamesDate(checked, event.endDate)) continue;
    // The original text, not the folded one, so the quote is what the page really says.
    const original = text.replace(/\s+/g, " ").slice(from, to).trim();
    if (fold(original) === window.trim()) return original;
  }
  return null;
}

export function attachDateEvidence(url: string, text: string, events: ParsedEvent[]): ParsedEvent[] {
  if (!text) return events;
  return events.map((event) => {
    if (event.evidence) return event;
    const quote = dateQuote(text, event);
    return quote ? { ...event, evidence: { quote, sourceUrl: event.sourceUrl ?? url, method: "page_text_near_name", version: "date-v1" } } : event;
  });
}

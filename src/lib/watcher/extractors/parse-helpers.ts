import type * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { ParsedEvent } from "@/lib/domain";

/** Lower-case and strip diacritics, so "Říčany" matches "ricany". */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Day, month and year as the strings a page printed them → "YYYY-MM-DD". */
export function dmy(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** The text of every cell in a table row, whitespace collapsed. */
export function cells($: cheerio.CheerioAPI, tr: AnyNode): string[] {
  return $(tr)
    .find("td")
    .toArray()
    .map((td) => $(td).text().replace(/\s+/g, " ").trim());
}

/** Add an event once per external id; a one-day "range" has no end date. */
export function pushOnce(events: ParsedEvent[], seen: Set<string>, ev: ParsedEvent): void {
  if (seen.has(ev.externalId)) return;
  seen.add(ev.externalId);
  if (ev.endDate && ev.endDate === ev.startDate) delete ev.endDate;
  events.push(ev);
}

import { quoteContainsDate, verifyPracticalExtraction, type PracticalDocument } from "./practical-extraction";
import { practicalValueSchemas, type PracticalDetails } from "@/lib/practical-details";

/** Public per-race programme tables: row-bound facts, without paying a model to copy them. */
export function practicalProgramme(doc: PracticalDocument, context: { name: string; startDate: string; endDate?: string | null; knownVenue?: string }): PracticalDetails {
  const lines = doc.text.split("\n").map(line => line.trim()).filter(Boolean);
  const head = lines.slice(0, 12).join("\n"), year = context.startDate.slice(0, 4);
  if (!new URL(doc.url).pathname.includes(year) || !head.includes(year) || !quoteContainsDate(head, context.startDate)) return {};
  const header = lines.findIndex(line => /trať|trat|route|course/i.test(line) && /start/i.test(line) && /startovn|fee|price/i.test(line) && line.includes("|"));
  if (header < 0) return {};
  const starts: unknown[] = [], fees: unknown[] = [], routes: unknown[] = [];
  const iso = (date: string) => { const [d, m, y] = date.split("."); return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; };
  for (const line of lines.slice(header + 1)) {
    const cells = line.split("|").map(cell => cell.trim());
    if (cells.length < 3 || !/^~?\d{1,2}:\d{2}(?::\d{2})?$/.test(cells[1])) continue;
    const [label, rawTime, prices] = cells;
    const evidence = { sourceQuote: line, sourceUrl: doc.url };
    if (!context.endDate || context.endDate === context.startDate) starts.push({ label, date: context.startDate, time: rawTime.replace("~", "").padStart(rawTime.includes(":", rawTime.indexOf(":") + 1) ? 8 : 5, "0"), approximate: rawTime.startsWith("~"), ...evidence });
    for (const match of prices.matchAll(/(\d{1,2}\.\d{1,2}\.20\d{2})\s+([\d \u00a0]+)(?:[,.]-?)?\s*(Kč|CZK|EUR|€)/g)) fees.push({ label, amount: Number(match[2].replace(/\s/g, "")), currency: /Kč|CZK/.test(match[3]) ? "CZK" : "EUR", validUntil: iso(match[1]), ...evidence });
    const distance = label.match(/\b(\d+(?:[,.]\d+)?)\s*km\b/i);
    if (distance) routes.push({ name: label, distanceKm: Number(distance[1].replace(",", ".")), ...evidence });
  }
  const fields: Record<string, unknown> = {};
  const edition = lines.find(line => quoteContainsDate(line, context.startDate))!;
  for (const [field, values] of [["schedule", starts], ["fees", [...new Map(fees.map(row => { const f = row as { label:string;amount:number;currency:string;validUntil:string }; return [JSON.stringify([f.label,f.amount,f.currency,f.validUntil]),row]; })).values()]], ["routes", routes]] as const) {
    if (!values.length || !practicalValueSchemas[field].safeParse(values).success) continue;
    const first = values[0] as { sourceQuote: string };
    fields[field] = { value: values, source_url: doc.url, quote: first.sourceQuote, identity_quote: lines[0], edition_quote: edition, status: "current" };
  }
  return verifyPracticalExtraction({ facts: fields }, { ...context, documents: [doc] }).details;
}

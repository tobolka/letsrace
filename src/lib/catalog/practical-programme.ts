import { entryPrices, quoteContainsDate, verifyPracticalExtraction, type PracticalDocument } from "./practical-extraction";
import { mergePracticalDetails, practicalValueSchemas, type PracticalDetails } from "@/lib/practical-details";

/** Public per-race programme tables: row-bound facts, without paying a model to copy them. */
type ProgrammeContext = { name: string; startDate: string; endDate?: string | null; knownVenue?: string };

export function practicalProgramme(doc: PracticalDocument, context: ProgrammeContext): PracticalDetails {
  return combinePracticalFindings(combinePracticalFindings(programmeRows(doc, context), keyValueProgramme(doc, context)), headedProgramme(doc, context));
}

/** Also the short form a series table uses: "08.11.26 #2 crossmania in Strausberg". */
function statesRaceDay(line: string, day: string): boolean {
  if (quoteContainsDate(line, day)) return true;
  const [year, month, date] = day.split("-");
  return new RegExp(`(?<![\\d.])0?${Number(date)}\\.\\s*0?${Number(month)}\\.\\s*${year!.slice(2)}(?!\\d)`).test(line);
}

/** Race-specific PDF guides often have a title, not a "Race:" table cell. */
function headedProgramme(doc: PracticalDocument, context: ProgrammeContext): PracticalDetails {
  const lines = doc.text.split("\n").map(line => line.trim()).filter(Boolean);
  const head = lines.slice(0, 18).join("\n").slice(0, 500);
  if (!head.includes(context.startDate.slice(0, 4)) || !quoteContainsDate(head, context.startDate)) return {};
  const facts: Record<string, unknown> = {};
  const evidence = (value: unknown, quote: string) => ({ value, quote, source_url: doc.url, identity_quote: head, edition_quote: head, status: "current" });
  // A series document has one such line per round; only the one under this race's date is its organiser.
  const organizerLines = lines.flatMap((line, index) => /^(?:Pořadatel|Poradatel|Organiser|Organizer|Veranstalter)\s*:\s*/i.test(line) ? [index] : []);
  const organizerIndex = organizerLines.length === 1 ? organizerLines[0] : organizerLines.find(index => lines.slice(Math.max(0, index - 2), index).some(line => statesRaceDay(line, context.startDate)));
  if (organizerIndex !== undefined) {
    const organizer = lines[organizerIndex]!;
    const name = organizer.replace(/^[^:]+:\s*/, "").replace(/\s+\p{L}[\p{L}-]*\s*:.*$/u, "").trim();
    if (name.length > 1 && name.length <= 200) facts.organizer = evidence({ name }, organizer);
  }
  const venue = lines.find(line => /^(?:Místo konání|Miesto konania|Areál|Race venue|Veranstaltungsort)\s*:\s*/i.test(line));
  if (venue) {
    const name = venue.replace(/^[^:]+:\s*/, "").trim();
    if (name.length > 1 && name.length <= 200) facts.venue = evidence({ name, precision: "venue" }, venue);
  }
  const starts: { label: string; date: string; time: string; sourceQuote: string; sourceUrl: string }[] = [];
  let inProgramme = false, dayHeader = -1;
  for (const [index, line] of lines.entries()) {
    if (/^(?:Program|Harmonogram|Schedule|Zeitplan)\b/i.test(line)) inProgramme = true;
    if (!inProgramme) continue;
    const dateHeader = /^(?:Program|Harmonogram|Schedule|Zeitplan|V\s|On\s|Am\s|Saturday|Sunday|Friday|Samstag|Sonntag|Freitag)/i.test(line);
    if (dateHeader && /20\d{2}/.test(line)) {
      dayHeader = quoteContainsDate(line, context.startDate) ? index : -1;
      continue;
    }
    if (/^(?:Podmínky|Pravidla|Ceny|Prizes|Startovné|Racing fee|Vyhlášení výsledků|Zdravotní|Antidoping)[^:]{0,35}:\s/i.test(line)) { inProgramme = false; dayHeader = -1; continue; }
    if (dayHeader < 0) continue;
    const row = /^([01]?\d|2[0-3])[:.]([0-5]\d)\s+(.{3,200})$/.exec(line);
    if (!row) continue;
    if (/^[–-]\s*\d/.test(row[3])) continue; // A time range needs its own representation.
    const sourceQuote = !context.endDate || context.endDate === context.startDate ? line : lines.slice(dayHeader, index + 1).join("\n");
    if (sourceQuote.length > 1500) continue;
    starts.push({ label: row[3].split(/\s*\(/)[0].trim(), date: context.startDate, time: `${row[1].padStart(2, "0")}:${row[2]}`, sourceQuote, sourceUrl: doc.url });
  }
  if (starts.length) facts.schedule = evidence(starts, starts[0].sourceQuote);
  return verifyPracticalExtraction({ facts }, { ...context, documents: [doc] }).details;
}

/** Keep independent fields and route variants from every document. */
export function combinePracticalFindings(previous: PracticalDetails, incoming: PracticalDetails): PracticalDetails {
  const a = previous.schedule, b = incoming.schedule;
  if (a && b && a.value.length >= 3 && a.value.length === b.value.length) {
    const language = (rows: typeof a.value) => {
      const labels = rows.map(row => row.label).join(" ");
      if (/\b(?:WOMEN|MEN|CADET|JUNIOR)\b/.test(labels) && !/ŽÁ|MUŽ|ŽENY|JUNIOŘ/i.test(labels)) return "en";
      if (/ŽÁ|MUŽ|ŽENY|JUNIOŘ|KADETKY|KADETI/i.test(labels)) return "cs";
      return null;
    };
    const left = language(a.value), right = language(b.value);
    const frame = (rows: typeof a.value) => rows.map(row => `${row.date}|${row.time}`).sort().join("\n");
    // Complete translated programmes must not double every start. A new time,
    // same-language heats or an unknown language still retain separate evidence.
    if (left && right && left !== right && new URL(a.sourceUrl).hostname === new URL(b.sourceUrl).hostname && frame(a.value) === frame(b.value)) {
      const other = { ...incoming };
      delete other.schedule;
      incoming = other;
    }
  }
  return { ...previous, ...mergePracticalDetails(previous, incoming) };
}

function programmeRows(doc: PracticalDocument, context: ProgrammeContext): PracticalDetails {
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
    const tiers = [...prices.matchAll(/\b\d{1,2}\.\d{1,2}\.20\d{2}\b/g)];
    for (const [index, tier] of tiers.entries()) {
      const after = prices.slice(tier.index + tier[0].length, tiers[index + 1]?.index);
      const entries = entryPrices(after);
      if (entries.length !== 1) continue;
      const { amount, currency, index: amountIndex } = entries[0];
      if (amount > 0 && !after.slice(0, amountIndex).trim()) fees.push({ label, amount, currency, validUntil: iso(tier[0]), ...evidence });
    }
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

/** Label/value tables and text need an explicit race line and nearby edition date.
 * A footer date, unrelated event, office address or children's start is not enough.
 */
function keyValueProgramme(doc: PracticalDocument, context: ProgrammeContext): PracticalDetails {
  const lines = doc.text.split("\n").map(line => line.trim()).filter(Boolean);
  const identityLabel = /^(?:Závod|Zavod|Race|Event|Veranstaltung)\s*[|:]/i;
  const organizerLabel = /^(?:Pořadatel|Poradatel|Organiser|Organizer|Veranstalter)\s*[|:]\s*/i;
  const startLabel = /^(?:Start|Štart)\s*[|:]\s*/i;
  const identityIndex = lines.findIndex(line => identityLabel.test(line));
  if (identityIndex < 0) return {};
  const nextIdentity = lines.slice(identityIndex + 1).findIndex(line => identityLabel.test(line));
  const block = lines.slice(identityIndex, nextIdentity >= 0 ? identityIndex + 1 + nextIdentity : identityIndex + 45);
  const dateIndex = block.findIndex(line => /^(?:Termín|Termin|Date|Datum)\s*[|:]/i.test(line) && quoteContainsDate(line, context.startDate));
  if (dateIndex < 1 || dateIndex > 6) return {};
  const identity = block[0], edition = block.slice(0, dateIndex + 1).join("\n");
  const facts: Record<string, unknown> = {};
  const evidence = (value: unknown, quote: string) => ({ value, quote, source_url: doc.url, identity_quote: identity, edition_quote: edition, status: "current" });
  const organizer = block.find(line => organizerLabel.test(line));
  if (organizer) {
    const name = organizer.replace(organizerLabel, "").trim();
    if (name.length <= 200 && name.length > 1) facts.organizer = evidence({ name }, organizer);
  }
  const starts = block.filter(line => startLabel.test(line)).flatMap(line => {
    const value = line.replace(startLabel, "").trim();
    const time = /\b(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/.exec(value);
    if (!time) return [];
    const beforeTime = value.slice(0, time.index);
    const date = /\b(?:20\d{2}-\d{2}-\d{2}|\d{1,2}\.\s*\d{1,2}\.\s*20\d{2})\b/.exec(beforeTime);
    // One explicit date before the first time binds that time to this edition.
    if (!date || !quoteContainsDate(date[0], context.startDate) || !/^\s*(?:ve?|at|um)?\s*$/i.test(beforeTime.slice(date.index + date[0].length))) return [];
    const label = beforeTime.slice(0, date.index).trim();
    if (!/start|štart/i.test(label) || label.length > 200) return [];
    return [{ label, date: context.startDate, time: time[0].padStart(time[0].length > 5 ? 8 : 5, "0"), sourceQuote: line, sourceUrl: doc.url }];
  });
  if (starts.length) facts.schedule = evidence(starts, starts[0].sourceQuote);
  return verifyPracticalExtraction({ facts }, { ...context, documents: [doc] }).details;
}

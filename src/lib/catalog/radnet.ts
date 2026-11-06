/**
 * rad-net.de publishes every German race on the same template: who runs it, whom to write to, each
 * class with its fee and start time, and the course. Reading the template needs no guessing and no AI;
 * the facts still pass the same checks as anything else that is read.
 */
const clean = (text: string) => text.replace(/\s+/g, " ").trim();

export const isRadNetDetail = (url: string) => /rad-net\.de\/.*ascr_detail/i.test(url);

export type RadNetRow = { date: string; title: string; url: string; place: string };

/** The rows of a rad-net calendar page, as the page reader gives them: `Sa, 07.11.2026 [title](link) place …`. */
export function radNetCalendarRows(text: string): RadNetRow[] {
  const rows: RadNetRow[] = [];
  for (const match of text.matchAll(/\b(?:Mo|Di|Mi|Do|Fr|Sa|So), (\d{2})\.(\d{2})\.(\d{4})(?: bis (?:Mo|Di|Mi|Do|Fr|Sa|So), \d{2}\.\d{2}\.\d{4})? \[([^\]]+)\]\((https?:[^)\s]+)\)\s+([^\n]*?)(?=\s+(?:Str|Cross|MTB|Bahn|Gravel|BMX|Halle|Trial|RTF|CTF|Breit|[A-ZÄÖÜ]{2,})\.?\s)/g)) {
    rows.push({ date: `${match[3]}-${match[2]}-${match[1]}`, title: clean(match[4]!), url: match[5]!, place: clean(match[6]!) });
  }
  return rows;
}

export type RadNetFullRow = { date: string; endDate?: string; title: string; url: string; place: string; kind: string };

/** A calendar row opened for entry, with the kind of racing. Rows with only a provisional date carry no link, so they do not match. */
export function radNetFullRows(text: string): RadNetFullRow[] {
  return [...text.matchAll(/\b(?:Mo|Di|Mi|Do|Fr|Sa|So), (\d{2})\.(\d{2})\.(\d{4})(?: bis (?:Mo|Di|Mi|Do|Fr|Sa|So), (\d{2})\.(\d{2})\.(\d{4}))? \[([^\]]+)\]\((https?:[^)\s]+)\)\s+(.+?)\s+(Str\.|Cross|MTB|Bahn|Gravel|BMX|Halle|Trial|RTF|CTF)\s+[A-ZÄÖÜ]{2,3}\b/g)].map(match => {
    const date = `${match[3]}-${match[2]}-${match[1]}`, end = match[4] ? `${match[6]}-${match[5]}-${match[4]}` : undefined;
    return { date, ...(end && end !== date ? { endDate: end } : {}), title: clean(match[7]!), url: match[8]!, place: clean(match[9]!), kind: match[10]! };
  });
}

export const radNetCalendarPages = (links: string[]) => [...new Set(links.filter(link => /rad-net\.de\/.*pgID_Veranstaltung%3D\d+(?:&|$)/i.test(link) && !/ascr_detail/i.test(link)))];

const between = (text: string, from: string, to: string[]) => {
  const start = text.indexOf(from);
  if (start < 0) return null;
  const rest = text.slice(start + from.length);
  const ends = to.map(word => rest.indexOf(word)).filter(at => at >= 0);
  return clean(ends.length ? rest.slice(0, Math.min(...ends)) : rest.slice(0, 200));
};
const number = (value: string) => Number(value.replace(",", "."));

/** Facts from one race's rad-net page, in the shape the checks expect. */
export function radNetFacts(doc: { url: string; text: string }, currency = "EUR") {
  const text = doc.text, facts: Record<string, unknown> = {};
  const head = /Tag: [^\n]*?Ort: /.exec(text);
  if (!head) return { facts };
  const dayLine = clean(text.slice(head.index, head.index + 40)).slice(0, 20);
  const fact = (value: unknown, quote: string) => ({ value, source_url: doc.url, quote, identity_quote: quote, edition_quote: dayLine, status: "current" });
  const contact = between(text, " An: ", [" Straße:", " Wohnort:", " Telefon:"]);
  const phone = between(text, " Telefon: ", [" Telefax:", " E-Mail:"]);
  const email = between(text, " E-Mail: ", [" Internet:", " Bemerkung:", " ["]);
  const runner = between(text, " Ausrichter: ", [" Veranstalter:", " Hinweise:"]);
  if (runner && runner !== "-") facts.organizer = fact({ name: runner, ...(contact && contact !== "-" ? { contactName: contact } : {}), ...(phone && phone !== "-" ? { phone } : {}), ...(email && email !== "-" ? { email } : {}) }, `Ausrichter: ${runner}`);
  const start = between(text, " Start/Ziel: ", [" Art:", " Nr.-Ausgabe:"]);
  if (start && start !== "-") facts.venue = fact({ name: start, precision: "start" }, `Start/Ziel: ${start}`);
  // "Startberechtigt: R5.1: Hobby Männer 50+ Jg. 1977 und älter, R5.2: …" says who a plain "Hobby" really is.
  const allowed = new Map([...text.matchAll(/R(\d+\.\d+): ([^;]*?)(?=, R\d+\.\d+:|;)/g)].map(match => [match[1]!, clean(match[2]!)]));
  const races = [...text.matchAll(/R\. (\d+\.\d+): (.+?)(?= Nenngeld:| \d+ ?(?:min|km|Rd|Rde|Runden)\b| \d+[.,]?\d* ?km| V\d|\s+olv|\s+Start:)(?: Nenngeld: (\d+(?:,\d+)?) ?€[^\s]*(?: \d+(?:,\d+)? ?€)?)?[^\n]*?Start: (\d{1,2}:\d{2}) Uhr/g)].map(match => {
    const who = allowed.get(match[1]!), plain = clean(match[2]!);
    return { label: who && /hobby|jedermann/i.test(plain) ? who : plain, fee: match[3], time: match[4]!.padStart(5, "0"), years: who?.match(/\d{4}(?:\s*[/-]\s*\d{4})?/)?.[0], quote: clean(match[0]), whoQuote: who };
  });
  if (races.length) facts.schedule = fact(races.map(race => ({ time: race.time, label: race.label, date: "", sourceQuote: race.whoQuote ?? race.quote })), races[0]!.quote);
  const fees = races.filter(race => race.fee).map(race => ({ label: race.label, amount: number(race.fee!), currency, sourceQuote: race.quote }));
  if (fees.length) facts.fees = fact(fees, fees[0]!.sourceQuote);
  if (races.length) facts.categories = fact(races.map(race => ({ label: race.label, ...(race.years ? { birthYears: race.years } : {}), sourceQuote: race.whoQuote ?? race.quote })), races[0]!.quote);
  // Children may ride a shorter lap; the course of the race is the longest one named.
  const laps = [...text.matchAll(/Strecke: [^;]*?(?:Runde|Rundkurs|Rd\.)[^;]*?(\d+(?:[.,]\d+)?) ?(km|m)\b[^;]*/gi)].map(match => {
    const value = number(match[1]!), km = /^km$/i.test(match[2]!) ? value : value / 1000;
    return { km, quote: clean(match[0]).replace(/^Strecke: /, "") };
  }).filter(lap => lap.km > 0 && lap.km <= 200).sort((a, b) => b.km - a.km);
  if (laps[0]) facts.routes = fact([{ name: "Runde", distanceKm: laps[0].km, sourceQuote: laps[0].quote }], laps[0].quote);
  const parking = /[^.;]*\b(?:Parkpl[aä]tz\w*|Parken|Parkm[oö]glichkeit\w*)\b[^.;]*/.exec(text.slice(head.index));
  if (parking) facts.parking = fact({ note: clean(parking[0]) }, clean(parking[0]));
  return { facts };
}

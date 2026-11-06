/**
 * The Italian federation publishes every race on one page: organiser with phone and email, the classes
 * allowed, and for each race its distance, start and services. Reading that needs no guessing and no AI;
 * the facts still pass the same checks as anything else that is read.
 */
const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const line = (text: string, label: string) => clean(new RegExp(`^${label}:[ \\t]*(.*)$`, "m").exec(text)?.[1] ?? "");

export const isFederciclismoRace = (url: string) => /members\.federciclismo\.it\/race\/detail\/\d+/i.test(url);

export function federciclismoFacts(doc: { url: string; text: string }) {
  const text = doc.text, facts: Record<string, unknown> = {};
  const day = line(text, "Data");
  if (!day) return { facts };
  const dayLine = `Data: ${day}`, title = clean(text.split("\n").find(row => row.trim()) ?? dayLine);
  const fact = (value: unknown, quote: string) => ({ value, source_url: doc.url, quote, identity_quote: title, edition_quote: dayLine, status: "current" });
  const name = line(text, "Organizzatore"), phone = line(text, "Telefono"), email = line(text, "Email");
  if (name) facts.organizer = fact({ name, ...(phone ? { phone } : {}), ...(email ? { email } : {}) }, `Organizzatore: ${name}`);
  const allowedLine = line(text, "Categorie ammesse");
  // A plain list of classes is split; a sentence about who may ride stays whole.
  const isSentence = /\b(?:tutte|tutti|compresi|aperta|categorie|riservata)\b/i.test(allowedLine);
  const classes = (isSentence ? [allowedLine.slice(0, 160)] : allowedLine.split(/\s+-\s+|\s*,\s*/)).map(clean).filter(label => label.length >= 2);
  if (classes.length) facts.categories = fact(classes.map(label => ({ label, sourceQuote: `Categorie ammesse: ${allowedLine}` })), `Categorie ammesse: ${allowedLine}`);
  const start = /^Partenza:[ \t]*(.*?)[ \t]*H:(\d{1,2}):(\d{2})[ \t]*$/m.exec(text);
  const rows: { time: string; label: string; date: string; sourceQuote: string }[] = [];
  // The description often holds the real timetable: "• Gara OPEN F - JUNIOR M/F ore 10:15".
  for (const match of text.matchAll(/^[ \t•*-]*((?:gara|partenza|start)\b[^\n]*?)[ \t]+(?:ore|h\.?)[ \t]*(\d{1,2})[:.](\d{2})[ \t]*$/gim)) {
    rows.push({ time: `${match[2]!.padStart(2, "0")}:${match[3]}`, label: clean(match[1]!), date: "", sourceQuote: clean(match[0]).replace(/^[•*-]\s*/, "") });
  }
  if (start) {
    const place = clean(start[1]!), quote = clean(start[0]);
    if (place.length >= 4) facts.venue = fact({ name: place, precision: "start" }, quote);
    if (!rows.length) rows.push({ time: `${start[2]!.padStart(2, "0")}:${start[3]}`, label: "Partenza", date: "", sourceQuote: quote });
  }
  if (rows.length) facts.schedule = fact(rows, rows[0]!.sourceQuote);
  const km = /^KM:[ \t]*(\d+(?:[.,]\d+)?)[ \t]*$/m.exec(text);
  if (km && Number(km[1]!.replace(",", ".")) > 0) {
    const programme = text.slice(text.indexOf("Programma") + 9, km.index).split("\n").map(clean).find(Boolean) ?? "Percorso";
    const kmQuote = `${programme} ${clean(km[0])}`;
    facts.routes = fact([{ name: programme, distanceKm: Number(km[1]!.replace(",", ".")), sourceQuote: kmQuote }], kmQuote);
  }
  const parking = /[^.\n-]*\bparchegg\w*[^.\n-]*/i.exec(text.slice(text.indexOf("Servizi:") + 8));
  if (text.includes("Servizi:") && parking && clean(parking[0]).length >= 8) facts.parking = fact({ note: clean(parking[0]) }, clean(parking[0]));
  const fee = /^[^\n]*(?:quota|iscrizion)[^\n]*?(?:€|euro)\s*(\d+(?:[.,]\d{1,2})?)[^\n]*$|^[^\n]*(?:quota|iscrizion)[^\n]*?(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)[^\n]*$/im.exec(text);
  if (fee) {
    const quote = clean(fee[0]).slice(0, 300), amount = Number((fee[1] ?? fee[2])!.replace(",", "."));
    facts.fees = fact([{ label: /quota|iscrizion\w*/i.exec(quote)![0], amount, currency: "EUR", sourceQuote: quote }], quote);
  }
  return { facts };
}

export const isRideAndRestRace = (url: string) => /rideandrest\.net\/manifestazione\//i.test(url);

/** Italian calendar page: `Ritrovo: place, ore 07:00` and `Organizza: club`. */
export function rideAndRestFacts(doc: { url: string; text: string }) {
  const text = doc.text, facts: Record<string, unknown> = {};
  const day = /^[^\n]*\b\d{1,2} \p{L}+ 20\d{2}[^\n]*$/mu.exec(text)?.[0];
  if (!day) return { facts };
  const dayLine = clean(day);
  const fact = (value: unknown, quote: string) => ({ value, source_url: doc.url, quote, identity_quote: dayLine, edition_quote: dayLine, status: "current" });
  const name = line(text, "Organizza");
  if (name.length >= 4) facts.organizer = fact({ name }, `Organizza: ${name}`);
  const meet = /^Ritrovo:[ \t]*(.*?)(?:,[ \t]*ore[ \t]*(\d{1,2})[:.](\d{2}))?[ \t]*$/m.exec(text);
  if (meet && clean(meet[1]!).length >= 4) {
    const quote = clean(meet[0]);
    facts.venue = fact({ name: clean(meet[1]!), precision: "venue" }, quote);
    if (meet[2]) facts.schedule = fact([{ time: `${meet[2].padStart(2, "0")}:${meet[3]}`, label: "Ritrovo", date: "", sourceQuote: quote }], quote);
  }
  return { facts };
}

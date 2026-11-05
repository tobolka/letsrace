import { fold } from "@/lib/text-match";
import { editionKey } from "@/lib/catalog/edition-identity";
import type { EditionAnswer, EditionPage, EditionRace } from "@/lib/catalog/next-edition";

/**
 * Read a next-edition announcement without a model, for pages that say it plainly.
 *
 * This only proposes: its answer still goes through decideEdition, the same gate a
 * model's answer goes through. It is deliberately narrower than a model. A page is
 * answered only when one date stands out for this race; anything else waits, and a
 * waiting race has lost nothing but time.
 */
export type LiteralEdition = { state: "answer"; answer: EditionAnswer } | { state: "wait"; reason: string };

const MONTHS: Record<string, number> = {};
[
  "january jan januar janner leden ledna lednu gennaio gen styczen stycznia januara",
  "february feb februar unor unora unoru febbraio luty lutego februara",
  "march mar marz maerz brezen brezna breznu marzo marzec marca marec",
  "april apr duben dubna dubnu aprile kwiecien kwietnia aprila",
  "may mai kveten kvetna kvetnu maggio maj maja",
  "june jun juni cerven cervna cervnu giugno czerwiec czerwca juna",
  "july jul juli cervenec cervence cervenci luglio lipiec lipca jula",
  "august aug srpen srpna srpnu agosto sierpien sierpnia augusta",
  "september sep sept zari settembre wrzesien wrzesnia septembra",
  "october oct okt oktober rijen rijna rijnu ottobre pazdziernik pazdziernika oktobra",
  "november nov listopad listopadu novembre listopada novembra",
  "december dec dez dezember prosinec prosince prosinci dicembre grudzien grudnia decembra",
].forEach((words, index) => { for (const word of words.split(" ")) MONTHS[word] = index + 1; });
const MONTH = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

/** A date in the coming year that belongs to something other than the race itself. */
const NOT_THE_RACE = /registrac|registration|anmeld|iscrizion|inscription|prihlas|uzaverk|startovn|deadline|entry fee|payment|platba|sleva|early ?bird|fruhbucher|zapis|zgloszen|meldeschluss|nennung|nennschluss|vyhlasen|galavecer|valna hromada|schuze|hauptversammlung|assemblea|kurz|workshop|webinar|soustreden|trainingslager|\bcamp\b|oboz|ples\b|voucher|poukaz|gultig|platn[ey]\b|valid|predprodej|vorverkauf|after ?party|\bparty\b|predbez|tbc|planovan|pripravuj|upresn|provisional|tentative|geplant|vorlaufig|voraussichtlich|prevista|provvisori|przewidywan|orientacn/;
/** A sentence about something the organiser merely mentions; the race must then be named in it. */
const ANOTHER_ORGANISER = /poradaji?\b|poradat?el|spolupor|partner|veranstaltet|organizuje|organizza/;
/** A sentence pointing at the next edition, which may leave the name to the page around it. */
const POINTS_AT_EDITION = /rocnik|edycj|ausgabe|edizione|edition|save the date|termin|dalsi|pristi|nachst|next|tesime|wiedersehen|sehen uns|widzimy|appuntamento|konat|uskutecn|startuje|odbedzie|findet/;
const SHORT_LINE = 60;
/** A numbered round says which one it is; the organiser's other rounds share the whole site. */
const ROUND_OF_SERIES = /#\s*\d|\b\d+\.?\s*(?:kolo|lauf|round|stage|etap)|\b(?:kolo|lauf|round|stage|etap[ae]?|wyscig|rennen|race)\s*\d|\bc\d\b/;
/** Forums quote dates of anything; a two-letter domain abroad means the record's country is in doubt. */
const NOT_THE_ORGANISER = /\/(?:forum|forums|topic|thread)s?(?:\/|$)/i;
const GENERIC_COUNTRY_DOMAINS = new Set(["eu", "cc", "io", "tv", "me", "co"]);
/** A festival around a one-day race gives the festival's dates, not the race's. */
const MAX_NEW_DAYS_FOR_SHORT_RACE = 2;
/** Rides and tours keep their own path in the catalogue; a plain date is no reason to promote them. */
const NOT_A_RACE = /cykloturist|turisticka|vyjizdk|radtouren|\brtf\b|gravel ?ride|\bbrevet/;
/** "until 31.3.2027", "od 1. 1. 2027": the opening or closing of something, not a race day. */
const BOUNDARY_BEFORE = /(?:^|[^a-z])(?:do|bis|until|till|by|entro|fino al|fino a|ab|from|od|von|seit|since|dal)\s*$/;
const USABLE_LINE = 600;
/** A race does not move months between editions without saying so; such a date is more likely another event's. */
const MAX_DRIFT_DAYS = 75;

const iso = (year: number, month: number, day: number): string | null => {
  const text = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : null;
};

type Found = { start: string; end?: string; at: number };

/** Every full date with the year stated, read from text already folded to lower-case ASCII. */
export function datesInLine(folded: string, year: number): Found[] {
  const y = String(year), found: Found[] = [];
  const add = (at: number, start: string | null, end?: string | null) => {
    if (!start || (end !== undefined && (!end || end <= start))) return;
    found.push(end ? { start, end, at } : { start, at });
  };
  const taken: [number, number][] = [];
  const scan = (pattern: RegExp, read: (m: RegExpExecArray) => void) => {
    for (const match of folded.matchAll(pattern)) {
      const from = match.index, to = from + match[0].length;
      if (taken.some(([a, b]) => from < b && to > a)) continue;
      taken.push([from, to]);
      read(match as RegExpExecArray);
    }
  };
  const num = (value: string | undefined) => Number(value);
  // 30.4.-2.5.2027
  scan(new RegExp(`(?<![\\d.])(\\d{1,2})\\.\\s*(\\d{1,2})\\.?\\s*[-–—]\\s*(\\d{1,2})\\.\\s*(\\d{1,2})\\.\\s*${y}(?!\\d)`, "g"),
    m => add(m.index, iso(year, num(m[2]), num(m[1])), iso(year, num(m[4]), num(m[3]))));
  // 2027-04-18
  scan(new RegExp(`(?<!\\d)${y}-(\\d{1,2})-(\\d{1,2})(?!\\d)`, "g"), m => add(m.index, iso(year, num(m[1]), num(m[2]))));
  // 18.4.2027, 3.-10.4.2027. A slash could be American order, so it never counts.
  scan(new RegExp(`(?<![\\d./])(?:(\\d{1,2})\\.?\\s*[-–—&]\\s*)?(\\d{1,2})\\.\\s*(\\d{1,2})\\.\\s*${y}(?!\\d)`, "g"),
    m => m[1] ? add(m.index, iso(year, num(m[3]), num(m[1])), iso(year, num(m[3]), num(m[2]))) : add(m.index, iso(year, num(m[3]), num(m[2]))));
  // 18. dubna 2027, 10 - 12 settembre 2027, 3. und 4. April 2027
  scan(new RegExp(`(?<![\\d.])(?:(\\d{1,2})\\.?\\s*(?:[-–—&+]|und|and|a|i|e|et)\\s*)?(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s+(?:of\\s+)?(${MONTH})\\.?\\s*,?\\s*${y}(?!\\d)`, "g"),
    m => m[1] ? add(m.index, iso(year, MONTHS[m[3]!]!, num(m[1])), iso(year, MONTHS[m[3]!]!, num(m[2]))) : add(m.index, iso(year, MONTHS[m[3]!]!, num(m[2]))));
  // April 18, 2027
  scan(new RegExp(`(?<![a-z])(${MONTH})\\.?\\s+(?:(\\d{1,2})\\s*[-–—]\\s*)?(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*${y}(?!\\d)`, "g"),
    m => m[2] ? add(m.index, iso(year, MONTHS[m[1]!]!, num(m[2])), iso(year, MONTHS[m[1]!]!, num(m[3]))) : add(m.index, iso(year, MONTHS[m[1]!]!, num(m[3]))));
  return found.sort((a, b) => a.at - b.at);
}

/** The words that make this race itself, without the edition and with nothing shared by the whole site. */
function identityWords(race: EditionRace): string[] {
  return [...new Set(editionKey(race.name).split(" ").filter(word => word.length > 3))];
}
/** More than half of the words: one shared word of two also fits the organiser's other events. */
const named = (words: string[], text: string) => {
  const hits = words.filter(word => text.includes(word)).length;
  return words.length === 1 ? hits === 1 : hits * 2 > words.length;
};

/** One short literal sentence from the line, keeping the date whole. */
function quoteFrom(line: string, year: number): string {
  if (line.length <= 280) return line;
  const at = line.indexOf(String(year));
  let from = Math.max(0, at - 140), to = Math.min(line.length, at + 120);
  while (from > 0 && !/\s/.test(line[from - 1]!)) from++;
  while (to < line.length && !/\s/.test(line[to]!)) to--;
  return line.slice(from, to).trim();
}

export function literalEditionAnswer(input: { race: EditionRace & { end_date?: string | null }; page: EditionPage; year: number; ownPage?: boolean }): LiteralEdition {
  const { race, page, year, ownPage = false } = input;
  const words = identityWords(race);
  if (!words.length) return { state: "wait", reason: "literal_name_says_too_little" };
  let path = "", host = "";
  try { const url = new URL(page.url); path = decodeURIComponent(url.pathname); host = url.hostname.toLowerCase(); } catch { return { state: "wait", reason: "literal_invalid_address" }; }
  if (NOT_THE_ORGANISER.test(path)) return { state: "wait", reason: "literal_forum_page" };
  const domain = host.split(".").at(-1)!;
  if (domain.length === 2 && !GENERIC_COUNTRY_DOMAINS.has(domain) && domain !== race.country.toLowerCase()) return { state: "wait", reason: "literal_site_in_another_country" };
  if (NOT_A_RACE.test(fold(`${race.name} ${page.title ?? ""} ${path}`))) return { state: "wait", reason: "literal_not_a_race" };
  if (!ownPage && ROUND_OF_SERIES.test(fold(race.name))) return { state: "wait", reason: "literal_round_of_a_series" };

  type Line = { text: string; date: Found };
  const lines: Line[] = [];
  for (const raw of page.text.split("\n")) {
    const text = raw.replace(/\s+/g, " ").trim();
    if (text.length > USABLE_LINE || !text.includes(String(year))) continue;
    const folded = fold(text);
    for (const date of datesInLine(folded, year)) {
      if (NOT_THE_RACE.test(folded) || BOUNDARY_BEFORE.test(folded.slice(0, date.at))) continue;
      lines.push({ text, date });
    }
  }
  if (!lines.length) return { state: "wait", reason: "literal_no_race_date_on_page" };

  // A range and the days inside it are one date; several separate dates are a calendar.
  const widest = [...lines].sort((a, b) => Number(Boolean(b.date.end)) - Number(Boolean(a.date.end)))[0]!;
  const inside = (date: Found) => widest.date.end ? date.start >= widest.date.start && date.start <= widest.date.end : date.start === widest.date.start;
  let chosen: Line;
  if (lines.every(line => inside(line.date))) chosen = lines.find(line => line.date.start === widest.date.start && Boolean(line.date.end) === Boolean(widest.date.end))!;
  else {
    // On a calendar only the line that names this race can say which date is its own.
    // The town alone will not do: a calendar's "26.9.2027 • Jesolo" fits every race held there.
    const town = fold(race.municipality);
    const distinctive = words.filter(word => !town.includes(word));
    const own = distinctive.length ? lines.filter(line => named(distinctive, fold(line.text))) : [];
    if (new Set(own.map(line => line.date.start)).size !== 1) return { state: "wait", reason: "literal_several_dates_on_page" };
    chosen = own[0]!;
  }

  const anniversary = new Date(`${race.start_date}T00:00:00Z`); anniversary.setUTCFullYear(year);
  const drift = Math.abs(Date.parse(`${chosen.date.start}T00:00:00Z`) - anniversary.getTime()) / 86_400_000;
  if (!(drift <= MAX_DRIFT_DAYS)) return { state: "wait", reason: "literal_date_far_from_last_edition" };

  if (chosen.date.end) {
    const lastDays = (Date.parse(race.end_date ?? race.start_date) - Date.parse(race.start_date)) / 86_400_000 + 1;
    const newDays = (Date.parse(chosen.date.end) - Date.parse(chosen.date.start)) / 86_400_000 + 1;
    if (lastDays <= 2 && newDays > MAX_NEW_DAYS_FOR_SHORT_RACE) return { state: "wait", reason: "literal_range_longer_than_the_race" };
  }
  // A site's name identifies it only on its own front page or on the race's own address.
  const addressCounts = ownPage || path === "/" || path === "";
  // Likewise "Coming to Denmark - GFNY Bremen": after the separator a title gives the site's name.
  const title = addressCounts ? page.title ?? "" : (page.title ?? "").split(/\s[-–—|·]\s/)[0]!;
  const seen = fold(`${title} ${chosen.text} ${path} ${addressCounts ? host : ""}`);
  if (!named(words, seen)) return { state: "wait", reason: "literal_race_not_named_on_page" };
  const line = fold(chosen.text);
  if (chosen.text.length > SHORT_LINE && !named(words, line) && (ANOTHER_ORGANISER.test(line) || !POINTS_AT_EDITION.test(line))) return { state: "wait", reason: "literal_sentence_about_something_else" };

  return { state: "answer", answer: { sameRace: true, cycling: true, announced: true, startDate: chosen.date.start, endDate: chosen.date.end ?? null, quote: quoteFrom(chosen.text, year), newPlace: null } };
}

import { distinctiveWords } from "@/lib/catalog/race-completeness";

/**
 * Many calendars we already read link each race's regulations and results from its row: a date, a place
 * and a file. One such page gives the documents of a whole discipline, at no cost per race.
 */
export type CalendarRow = { date: string; endDate?: string; text: string; regulations: string[]; results: string[]; sites: string[] };

const folded = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const FILE = /\.(?:pdf|docx?|odt|rtf|zip)(?:$|[?#])/i;
const POSTER = /plagat|plakat|poster|flyer|letak|\.(?:jpe?g|png|webp)(?:$|[?#])/i;
const RESULTS = /vysledk|výsledk|results?\b|ergebnis|wyniki|risultati|classifica|\/vysl/i;
const NOT_REGULATIONS = /startlist|prihlasen|meldeliste|\bbody\b|poradi|rangliste|klasyfikacja/i;

const LABELLED = /propoz|rozpis|ausschreib|regulamin|regolament|r[eè]glement|invito|organiza[cč]n/i;
const NOT_ORGANISER = /facebook|instagram|youtube|google\.|maps\.|strava|twitter|x\.com|mapy\.|\/prihlas|\/anmeld|registr|raceresult|sportsoft|maraton\.cz|sumator|results?\b|vysledk/i;

/** Rows of a calendar: one day on the line and at least one link. A date without a year takes the page's calendar year when the page states one. */
export function calendarRows(text: string, pageUrl = ""): CalendarRow[] {
  const rows: CalendarRow[] = [];
  const pageHost = (() => { try { return new URL(pageUrl).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const yearOnPage = /(?:^|\D)(20\d{2})(?:\D|$)/.exec(`${pageUrl} ${text.slice(0, 1500)}`)?.[1];
  for (const line of text.split("\n")) {
    const plain = line.replace(/\([^)]*\)/g, " ");
    let dates = [...plain.matchAll(/(?<![\d.])(\d{1,2})\.\s*(?:[-–]\s*(\d{1,2})\.\s*)?(\d{1,2})\.\s*(20\d{2})(?!\d)/g)].map(match => ({ day: match[1]!, last: match[2], month: match[3]!, year: match[4]! }));
    if (!dates.length && yearOnPage) dates = [...plain.matchAll(/(?<![\d.])(\d{1,2})\.\s*(?:[-–]\s*(\d{1,2})\.\s*)?(\d{1,2})\.(?![\d.])/g)].filter(match => Number(match[3]) >= 1 && Number(match[3]) <= 12 && Number(match[1]) <= 31).map(match => ({ day: match[1]!, last: match[2], month: match[3]!, year: yearOnPage }));
    // Two or more dates on a line is a list or a sentence, not a row of one race.
    if (dates.length !== 1) continue;
    const links = [...line.matchAll(/(?:\[([^\]]*)\])?\((https?:\/\/[^)]+)\)/g)].map(match => ({ label: match[1] ?? "", url: match[2]!.replace(/\s+/g, "") }));
    if (!links.length) continue;
    const { day, last, month, year } = dates[0]!;
    const iso = (d: string) => `${year}-${month.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const files = links.filter(link => FILE.test(link.url) && !POSTER.test(link.url));
    const results = links.filter(link => RESULTS.test(`${link.url} ${link.label}`) && !POSTER.test(link.url) && !/prihlas|zoznam|anmeld|startlist/i.test(link.url)).map(link => link.url);
    const regulations = [...new Set([...files.map(link => link.url), ...links.filter(link => LABELLED.test(link.label)).map(link => link.url)])].filter(url => !results.includes(url) && !NOT_REGULATIONS.test(url) && !/\/prihlas/i.test(url));
    const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };
    const sites = links.filter(link => !results.includes(link.url) && !FILE.test(link.url) && !POSTER.test(link.url) && !LABELLED.test(link.label) && !NOT_ORGANISER.test(link.url) && hostOf(link.url) !== pageHost).map(link => link.url);
    if (!regulations.length && !results.length && !sites.length) continue;
    rows.push({ date: iso(day), ...(last ? { endDate: iso(last) } : {}), text: line.replace(/\((https?:\/\/[^)]+)\)/g, " ").replace(/\s+/g, " ").trim(), regulations, results, sites });
  }
  return rows;
}

export type RaceForRow = { name: string; start_date: string; municipality?: string | null };

/** The race's own row: its day, and its place or its name in the row's text. */
export function rowOfRace(rows: CalendarRow[], race: RaceForRow): CalendarRow | null {
  const place = folded(race.municipality ?? "").split(/[^a-z0-9]+/).filter(word => word.length >= 3);
  const words = distinctiveWords(race.name.split(/[—–]/).at(-1)!);
  const named = (row: CalendarRow) => {
    const text = folded(row.text);
    return place.length > 0 && place.every(word => text.includes(word)) || words.length > 0 && words.every(word => text.includes(word));
  };
  const matches = rows.filter(row => row.date === race.start_date && named(row));
  return matches.length === 1 ? matches[0]! : null;
}

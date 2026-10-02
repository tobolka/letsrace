/**
 * Does a text name this day? "3.10.2026", "3. 10.", "2026-10-03",
 * "3. října", "3 ottobre", "October 3rd", "Sa, 03.10." — the way race pages
 * and regulations write their date, in the languages of the catalogue.
 */
const MONTHS: string[][] = [
  ["january", "jan", "januar", "jänner", "janner", "leden", "ledna", "gennaio", "styczen", "stycznia", "janvier", "enero", "januari", "januára", "januara"],
  ["february", "feb", "februar", "unor", "unora", "febbraio", "luty", "lutego", "fevrier", "febrero", "februari", "februára"],
  ["march", "mar", "marz", "maerz", "brezen", "brezna", "marzo", "marzec", "marca", "mars", "maart", "marca"],
  ["april", "apr", "duben", "dubna", "aprile", "kwiecien", "kwietnia", "avril", "abril", "apríla", "aprila"],
  ["may", "mai", "kveten", "kvetna", "maggio", "maj", "maja", "mayo", "mei", "mája"],
  ["june", "jun", "juni", "cerven", "cervna", "giugno", "czerwiec", "czerwca", "juin", "junio", "júna", "juna"],
  ["july", "jul", "juli", "cervenec", "cervence", "luglio", "lipiec", "lipca", "juillet", "julio", "júla", "jula"],
  ["august", "aug", "srpen", "srpna", "agosto", "sierpien", "sierpnia", "aout", "augustus", "augusta"],
  ["september", "sep", "sept", "zari", "settembre", "wrzesien", "wrzesnia", "septembre", "septiembre", "septembra"],
  ["october", "oct", "okt", "oktober", "rijen", "rijna", "ottobre", "pazdziernik", "pazdziernika", "octobre", "octubre", "októbra", "oktobra"],
  ["november", "nov", "listopad", "listopadu", "novembre", "listopada", "noviembre", "novembra"],
  ["december", "dec", "dez", "dezember", "prosinec", "prosince", "dicembre", "grudzien", "grudnia", "decembre", "diciembre", "decembra"],
];

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function textNamesDate(rawText: string, iso: string): boolean {
  const t = fold(rawText);
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const D = `0?${d}`;
  const M = `0?${m}`;
  if (new RegExp(`${y}-0?${m}-0?${d}(\\D|$)`).test(t)) return true;
  // American, as the Czech federation's portal renders it: "10/3/2026".
  if (new RegExp(`(^|[^\\d])0?${m}/0?${d}/${y}(?!\\d)`).test(t)) return true;
  if (new RegExp(`(^|[^\\d])${D}\\s*[./]\\s*${M}\\s*[./]?\\s*(${y}|${String(y).slice(2)}(?!\\d))?(?!\\s*[./]?\\s*\\d)`).test(t)) {
    // "3.10." alone could be another year's; fine — the year is checked below.
    return true;
  }
  for (const name of MONTHS[m - 1]!) {
    const n = fold(name);
    if (new RegExp(`(^|[^\\d])${D}\\s*(\\.|st|nd|rd|th|er|°)?\\s*(of\\s+)?${n}\\b`).test(t)) return true;
    if (new RegExp(`\\b${n}\\.?\\s+${D}(st|nd|rd|th)?(\\D|$)`).test(t)) return true;
  }
  return false;
}

/** Same day, and the page does not tie it to another year only. */
export function textNamesEdition(rawText: string, iso: string): boolean {
  if (!textNamesDate(rawText, iso)) return false;
  const y = iso.slice(0, 4);
  const years = new Set(rawText.match(/(?<!\d)20\d\d(?!\d)/g) ?? []);
  return !years.size || years.has(y) || years.has(String(Number(y) - 1)) && Number(iso.slice(5, 7)) <= 3;
}

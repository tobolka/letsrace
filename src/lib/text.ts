/**
 * Undo the oldest mistake in scraping: Windows-1252 read as Latin-1.
 *
 * A German organiser writes "Pott’s Leeze Tour". Their page is Windows-1252,
 * where the apostrophe is byte 0x92; something upstream decoded it as Latin-1,
 * where 0x92 is a control character nobody has a glyph for. It reaches us as
 * U+0092 and the browser draws an empty box in the middle of the name.
 *
 * The bytes are not lost, only mislabelled, so the mapping back is exact: the
 * C1 block is what Windows-1252 fills with punctuation. Anything left in that
 * block with no character behind it is dropped rather than shown, because a
 * missing apostrophe reads better than a hole.
 */

const CP1252: Record<number, string> = {
  0x80: "€",
  0x82: "‚",
  0x83: "ƒ",
  0x84: "„",
  0x85: "…",
  0x86: "†",
  0x87: "‡",
  0x88: "ˆ",
  0x89: "‰",
  0x8a: "Š",
  0x8b: "‹",
  0x8c: "Œ",
  0x8e: "Ž",
  0x91: "‘",
  0x92: "’",
  0x93: "“",
  0x94: "”",
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x98: "˜",
  0x99: "™",
  0x9a: "š",
  0x9b: "›",
  0x9c: "œ",
  0x9e: "ž",
  0x9f: "Ÿ",
};

/** Control characters that never belong in a race name. */
// eslint-disable-next-line no-control-regex
const C1 = /[\u0080-\u009f]/g;
// eslint-disable-next-line no-control-regex
const C0 = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

export function repairText<T extends string | null | undefined>(value: T): T {
  if (!value) return value;
  if (!C1.test(value) && !C0.test(value)) return value;
  C1.lastIndex = 0;
  C0.lastIndex = 0;
  return value
    .replace(C1, (ch) => CP1252[ch.charCodeAt(0)] ?? "")
    .replace(C0, "") as T;
}

const ENTITY = /&(?:[a-z][a-z0-9]{1,8}|#\d{2,6}|#x[0-9a-f]{2,5});/i;
const FULL_DATE =
  /\b\d{1,2}\.\s?\d{1,2}\.\s?20\d{2}\b|\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/20\d{2}\b/g;
/** "Mad Liepāja (29.08.2026 - 30.08.2026)" — a listing that dates itself, not a slice. */
const TRAILING_DATE_SPAN = /\s*\(\s*[\d./-]+\s*(?:[-–]\s*[\d./-]+\s*)?\)\s*$/;
const TIME_RANGE = /\b\d{1,2}[.:]\d{2}\s*(?:[-–—]|&ndash;)\s*\d{1,2}[.:]\d{2}\b/;
const PAGE_CHROME =
  /mehr erfahren|weiterlesen|zur anmeldung|\[fotos hier\]|ausschreibung \(stand|\bergebniss?e\b|\bveranstalter\b|infos rennen|read more|czytaj więcej|strona zgłoszenia|informacje podstawowe|więcej informacji|více informací|\bwww\.|▶|✔/i;
const ROUND_LIST = /\b\d{1,2}\.\s*(?:rennen|kolo|runde|etap[pa]?|lauf)\b/gi;

/**
 * True when a "name" is a slice of page text rather than what a race is called.
 *
 * A date-first scraper takes the characters around each date on a calendar page
 * and calls that the race: "> Sa, | 09.00&ndash;17.00 Uhr MUD MASTER CYCLOCROSS
 * Mittelk&auml;rnten von Mountain Sport Union Kl". It carries the page's own
 * markup with it — unescaped entities, a replacement character where the
 * charset was guessed wrong, the next row's date, a "Mehr erfahren" link, a
 * start time, the numbered list of every round. A real name has none of that.
 *
 * Deliberately a detector, not a scorer: each signal on its own is something a
 * race name does not contain, so one is enough. Length alone is not a signal —
 * "Mistrzostwa Polski w kolarstwie szosowym - jazda na czas i jazda parami w
 * kategorii Masters" is 91 characters and is exactly what the race is called —
 * and neither is two round numbers: "5. kolo Slovenského pohára v pumptracku a
 * 4. kolo PUMPCUP" is one race counted by two cups.
 */
export function looksLikeTextFragment(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  if (!n) return false;
  if (n.includes("\uFFFD")) return true;
  if (ENTITY.test(n)) return true;
  if (/^[>|,;:)\]}.]/.test(n)) return true;
  if (PAGE_CHROME.test(n)) return true;
  if (TIME_RANGE.test(n)) return true;
  // One date is a listing that dates itself ("17. Hügellandtrophy 14.06.2026");
  // two are the scraper's anchor and the next row's.
  if ((n.replace(TRAILING_DATE_SPAN, "").match(FULL_DATE) ?? []).length >= 2) return true;
  if ((n.match(ROUND_LIST) ?? []).length >= 3) return true;
  return false;
}

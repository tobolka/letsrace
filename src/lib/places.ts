/**
 * Put a shouted place name back into sentence case.
 *
 * A tenth of the locations we hold arrived in capitals — Italian federation
 * calendars and a few Czech ones publish that way — and "HRADEC KRÁLOVÉ" in a
 * list of ordinary place names reads as an error rather than a town.
 *
 * The rule is deliberately narrow: only a name with no lowercase letter in it
 * at all is touched. Anything already cased is left exactly as its source
 * wrote it, because a source that bothered with case usually knew better than
 * a general rule would.
 */

/** Words that stay lowercase inside a name, in the languages we cover. */
const PARTICLES = new Set([
  // Czech / Slovak / Polish
  "nad",
  "pod",
  "na",
  "u",
  "v",
  "ve",
  "za",
  "pri",
  "przy",
  "koło",
  "kolo",
  // German
  "an",
  "am",
  "im",
  "in",
  "der",
  "dem",
  "des",
  "bei",
  "auf",
  "ob",
  "zur",
  "zum",
  "vor",
  // Romance
  "de",
  "del",
  "della",
  "delle",
  "di",
  "da",
  "do",
  "dos",
  "das",
  "du",
  "la",
  "le",
  "les",
  "el",
  "lo",
  "sur",
  "sous",
  "e",
  "y",
  "i",
  // Dutch / English
  "van",
  "von",
  "aan",
  "op",
  "ter",
  "of",
  "the",
  "and",
  "upon",
]);

/** Elided articles that lead a word: d'Arbia, dell'Emilia, sant'Angelo. */
const ELISIONS = /^(d|l|dell|nell|all|sull|sant|dall)'/i;

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function caseWord(word: string, first: boolean): string {
  if (!word) return word;
  // Postcodes, house numbers, anything carrying a digit: left alone.
  if (/\d/.test(word)) return word;
  // Abbreviations written with stops — R.S.M, S.P. — keep their capitals.
  if ((word.match(/\./g)?.length ?? 0) >= 2) return word;
  if (!first && PARTICLES.has(word.toLowerCase())) return word.toLowerCase();
  // Province and country codes sit next to the town: Osoppo UD, Pieve
  // Vergonte VB. Three letters or fewer is not a word worth recasing, and
  // "UCI C1" would only be made worse by trying.
  if (word.replace(/[^\p{L}]/gu, "").length <= 3) return word;

  const elided = word.match(ELISIONS);
  if (elided) {
    const rest = word.slice(elided[0].length);
    const article = first ? capitalise(elided[0]) : elided[0].toLowerCase();
    return article + (rest ? capitalise(rest) : "");
  }
  return capitalise(word);
}

/**
 * "HRADEC KRÁLOVÉ" → "Hradec Králové", "ÚSTÍ NAD LABEM" → "Ústí nad Labem".
 * Anything with a lowercase letter already in it comes back untouched.
 */
export function formatPlaceName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (value !== value.toLocaleUpperCase()) return value;
  if (!/\p{Lu}/u.test(value)) return value;

  let index = 0;
  // Split on the separators a place name uses, keeping them in place.
  return value.replace(/[^\s/–-]+/gu, (word) => {
    const cased = caseWord(word, index === 0);
    if (/\p{L}/u.test(word)) index += 1;
    return cased;
  });
}

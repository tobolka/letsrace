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

/** Values a source put in the place field to mean "we do not know yet". */
const PLACEHOLDER =
  /^(?:\.{2,}|…|\[\?\]|\?+|-+|tb[acd]|n\/?a|unknown|lokalita v jednání|místo bude upřesněno|bude upřesněno|upřesníme|ort folgt|ort tba)$/i;

/** Regions a source appends after the town ("Söll, Tirol"). Cities that share a region's name are left out. */
const REGIONS = [
  "tirol", "tyrol", "niederosterreich", "oberosterreich", "karnten", "steiermark", "vorarlberg", "burgenland",
  "bayern", "bavaria", "baden-wurttemberg", "sachsen", "thuringen", "hessen", "niedersachsen",
  "nordrhein-westfalen", "rheinland-pfalz", "schleswig-holstein", "mecklenburg-vorpommern", "sachsen-anhalt",
  "saarland", "brandenburg", "sudtirol", "south tyrol", "alto adige", "trentino", "toscana", "tuscany",
  "lombardia", "lombardy", "veneto", "piemonte", "scotland", "england", "wales", "northern ireland",
  "south england", "north england", "great britain", "czech republic", "slovak republic",
  "ceska republika", "slovenska republika",
];

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

let notTowns: Set<string> | null = null;
/** Every country's name in the languages our sources write in, plus its code, plus the regions above. */
function notATown(part: string): boolean {
  if (!notTowns) {
    notTowns = new Set(REGIONS);
    const codes = "AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK".split(" ");
    for (const lang of ["en", "cs", "sk", "de", "pl", "it", "fr", "hu", "sl", "nl", "es"]) {
      const names = new Intl.DisplayNames([lang], { type: "region" });
      for (const code of codes) {
        const name = names.of(code);
        if (name) notTowns.add(fold(name));
      }
    }
    for (const code of codes) notTowns.add(code.toLowerCase());
    notTowns.add("uk");
  }
  return notTowns.has(fold(part));
}

/**
 * A place field split into the town and whatever came before it.
 *
 * The field is free text from many sources: "Festhalle, Güntersleben" (venue,
 * town), "Kirchzarten, Germany" (town, country), "Söll, Tirol", or just "DE"
 * or "TBC". Titles, lists and the structured data all want the town, and
 * reading the last comma-separated part gave "Germany" for a town in a
 * thousand-odd places. Only parts that are certainly not a town come off — a
 * country or region name, a country code, a placeholder — so a real two-letter
 * town like Aš is left alone.
 */
export function splitPlace(raw: string | null | undefined): { town: string | null; venue: string | null } {
  const value = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!value || PLACEHOLDER.test(value)) return { town: null, venue: null };
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  while (parts.length && (notATown(parts[parts.length - 1]!) || PLACEHOLDER.test(parts[parts.length - 1]!))) parts.pop();
  if (!parts.length) return { town: null, venue: null };
  const town = parts.pop()!;
  return { town, venue: parts.length ? parts.join(", ") : null };
}

/** The venue and town back as one display string ("Festhalle, Güntersleben"), or "" for neither. */
export function joinPlace(place: { town: string | null; venue: string | null }): string {
  return [place.venue, place.town].filter(Boolean).join(", ");
}

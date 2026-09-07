/**
 * A second, blunter attempt at a place that would not geocode.
 *
 * `cleanGeocodeQuery` tidies a place name. This one gives up on tidying and
 * goes looking for the town inside a string that is mostly something else: a
 * club's full name, an Italian street address, a venue, a Czech village named
 * after the bigger village next door. Every rule below comes from a row that is
 * sitting in the catalogue right now with no coordinates.
 *
 * It is only ever used after a real geocode has already failed, and a miss
 * still leaves the row where it was. A wrong pin would be worse than none, so
 * nothing here guesses at a place — it only removes the parts that are
 * certainly not one.
 */

/**
 * Words that mean "this is a club, not a town".
 *
 * Matched between spaces rather than with `\b`: an umlaut is not a word
 * character in a JavaScript regex, so `\bASKÖ\b` never matches the thing it
 * was written for.
 */
const CLUB =
  /(?:^|\s)(?:ARB[ÖO]|ASK[ÖO]|Raiffeisen|Radclub|Radsportclub|Radsportverein|Radteam|Cycling\s*Team|Radunion|Union|RC|RV|LRV|SV|SC|TJ|KL|Klub|Team)(?=\s|$)/gi;

/** Street and venue words that precede the detail rather than the town. */
const VENUE_CUT =
  /\s+(?:via|viale|piazza|localita|località|loc\.|centro\s+sport\w*|parco|bikepark|bike\s*park|masseria|c\/o|ulice|ul\.|náměstí|namesti|náves|naves)\b.*$/i;

const LEADING_VENUE =
  /^(?:localita|località|loc\.|frazione|fraz\.|parco|centro\s+sport\w*|tor\s+kolarski|velodrom\w*|bikepark|bike\s*park|masseria|náves|naves)\s+/i;

export function simplifyPlaceQuery(raw: string | null | undefined): string | null {
  let text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;

  // "Radclub Feld am See — Kärnten": the town is what is left once the club
  // words go, and the region after the dash is not it.
  CLUB.lastIndex = 0;
  if (CLUB.test(text)) {
    CLUB.lastIndex = 0;
    text = text.split(/\s+[—–-]\s+/)[0] ?? text;
    // Repeat until nothing more comes off: club names stack their words, and a
    // single pass leaves the second one behind wherever two sit side by side.
    for (let i = 0; i < 4; i++) {
      const next = text.replace(CLUB, " ").replace(/\s+/g, " ").trim();
      if (next === text) break;
      text = next;
    }
  }

  text = text.replace(LEADING_VENUE, "").trim();
  text = text.replace(VENUE_CUT, "").trim();

  // "BRESCIA/COLLE MADDALENA", "lambrugo-ghisallo": the first is the comune.
  if (/\//.test(text)) text = text.split("/")[0]!.trim();
  if (/\s+-\s+/.test(text)) text = text.split(/\s+-\s+/)[0]!.trim();

  // "Horní Planá u Lipna" is a village named after its neighbour; the geocoder
  // knows the village, not the pair.
  text = text.replace(/\s+u\s+\S+$/i, "").trim();

  // House numbers left behind by a street address.
  text = text.replace(/\s+\d+[a-z]?$/i, "").trim();

  text = text.replace(/[,;]+$/, "").trim();

  if (text.length < 3) return null;
  if (!/\p{L}{3}/u.test(text)) return null;
  if (text.toLowerCase() === (raw ?? "").trim().toLowerCase()) return null;
  return text;
}

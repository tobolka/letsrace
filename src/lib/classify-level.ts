/**
 * Race level from evidence, not from a blob of regexes.
 *
 * The previous inline version read a concatenation of name + place + series +
 * category names and accepted any two-letter abbreviation it found. Three
 * separate failure modes came out of that, all visible in the live catalog:
 *
 *  - `\bsp\b` fired inside "Spätsommercross" and "späť" (JS word boundaries are
 *    ASCII-only), so a German club cross and a Slovak family ride were World Cups.
 *  - `SP` is *Světový pohár* in Czech but *Slovenský pohár* in Slovak, and every
 *    Slovak national-cup round was promoted to World Cup.
 *  - `world series` matched the UCI **Gran Fondo** World Series — an amateur
 *    qualifier ladder — turning ~90 mass-participation rides into World Cups.
 *
 * Each rung here now needs a marker that only means that rung. Ambiguous
 * abbreviations must be joined by a discipline word ("MS MTB", "SP XCO") or by a
 * venue that only ever hosts that level. When nothing qualifies we return the
 * lower rung: under-claiming a local race is a gap, over-claiming a World Cup is
 * a lie the UI repeats on every card.
 */
import { fold, foldTokens, hasToken, hasTokenFollowedBy } from "@/lib/text-match";
import type { RaceLevel, UciClass } from "@/lib/taxonomy";

/** Discipline / category words that disambiguate a bare MS / ME / SP token. */
const DISCIPLINE_QUALIFIERS = [
  "mtb", "xco", "xcc", "xcm", "xce", "dh", "cx", "bmx", "road", "silnice", "cestna",
  "cyklokros", "cyclocross", "gravel", "enduro", "trial", "track", "draha",
  "juniorov", "juniori", "zeny", "muzi", "kadeti", "ziaci", "elite",
] as const;

/** Venues that only ever appear on the UCI MTB World Cup calendar. */
const WORLD_CUP_VENUES = [
  "nove mesto na morave", "nmnm", "leogang", "val di sole", "lenzerheide", "les gets",
  "mont sainte anne", "snowshoe", "araxa", "pal arinsal", "la thuile", "loudenvielle",
  "crans montana", "vallnord", "andorra", "bielsko biala",
] as const;

const WORLD_CHAMPIONSHIP =
  /world\s*champ|mistrovstvi\s*sveta|majstrovstva\s*sveta|weltmeisterschaft|campionat[oi]\s*mondial|championnats?\s*du\s*monde|campeonato\s*mundial|mistrzostwa\s*swiata/;

const EUROPEAN_CHAMPIONSHIP =
  /european\s*champ|mistrovstvi\s*evropy|majstrovstva\s*europy|europameisterschaft|championnats?\s*d[e']\s*europe|campionat[oi]\s*europe[oi]|mistrzostwa\s*europy/;

const WORLD_CUP =
  /world\s*cup|svetovy\s*pohar|weltcup|coupe\s*du\s*monde|copa\s*del\s*mundo|coppa\s*del\s*mondo|puchar\s*swiata|uci\s*(mtb|mountain\s*bike|bmx|cyclo\s*cross|cyclocross|track)\s*world\s*series/;

const CONTINENTAL =
  /continental\s*(cup|series)|european\s*cup|evropsky\s*pohar|uec\s*(european\s*)?cup|coupe\s*d[e']\s*europe|nations?\s*cup/;

const NATIONAL_CHAMPIONSHIP =
  /national\s*champ|mistrovstvi\s*(republiky|cr|ceske|ceska)|majstrovstva\s*(slovenska|sr)|mcr|msr|deutsche\s*meisterschaft|osterreichische\s*meisterschaft|schweizer\s*meisterschaft|campionato\s*italiano|campeonato\s*de\s*espana|championnats?\s*de\s*france|mistrzostwa\s*polski/;

const NATIONAL_SERIES =
  /cesky\s*pohar|slovensky\s*pohar|bundesliga|swiss\s*bike\s*cup|austrian\s*(cup|series)|coppa\s*italia|copa\s*de\s*espana|national\s*(cup|series|trophy|league)|kolo\s*pro\s*zivot|prima\s*cup|cube\s*cup|czech\s*enduro/;

const REGIONAL =
  /krajsk|regional|prebor\s*kraje|okres|district|landesmeisterschaft|landesliga|schwarzw|rhein\s*eifel|oberschwaben|saarlandliga|usti\s*mtb|sumavsk|bayerwald|werdenfels|rhein\s*main|eldorado|berg\s*&\s*bike|mpdv|detska\s*vrl|allgau|valais|bundicycling|bike\s*kingdom|valiant\s*gp|xco\s*nrw|jarni\s*bahno|copa\s*madrid|copa\s*catalunya/;

/**
 * The UCI **Gran Fondo** World Series and its World Championships are amateur
 * mass-participation qualifiers. They carry "UCI" and "World", so every generic
 * world-level pattern claims them; they are not elite racing and must not
 * outrank a national championship in the UI.
 */
export function isGranFondoWorldSeries(text: string): boolean {
  const t = fold(text);
  return /gran\s*fondo\s*world|granfondo\s*world|uci\s*gran\s*?fondo/.test(t);
}

export type LevelEvidence = {
  level: RaceLevel;
  /** Which marker decided it — surfaced by the audit script and admin preview. */
  reason: string;
};

/**
 * Resolve the level from name + series text.
 *
 * `countryHint` disambiguates the SP abbreviation: in Slovak listings SP is
 * almost always *Slovenský pohár*, so it stays national unless a world marker
 * or a World Cup venue is also present.
 */
export function resolveLevel(opts: {
  name: string;
  seriesName?: string | null;
  seriesSlug?: string | null;
  placeText?: string | null;
  categoryNames?: string[] | null;
  uciClass?: UciClass | null;
  countryHint?: string | null;
}): LevelEvidence {
  const blob = `${opts.name} ${opts.seriesName ?? ""} ${opts.seriesSlug ?? ""} ${opts.placeText ?? ""} ${(opts.categoryNames ?? []).join(" ")}`;
  const t = fold(blob);
  const tokens = foldTokens(blob);
  const country = (opts.countryHint ?? "").toUpperCase();

  const granFondo = isGranFondoWorldSeries(blob);
  const venueIsWorldCup = WORLD_CUP_VENUES.some((v) => tokens.includes(` ${v} `));

  // Gran Fondo ladder — amateur, capped at international regardless of "World".
  if (granFondo) {
    return /world\s*champ/.test(t)
      ? { level: "international", reason: "gran_fondo_world_championships" }
      : { level: "international", reason: "gran_fondo_world_series" };
  }

  if (WORLD_CHAMPIONSHIP.test(t)) return { level: "world_championship", reason: "world_championship_name" };
  if (hasToken(blob, "wch")) return { level: "world_championship", reason: "wch_token" };
  if (hasTokenFollowedBy(blob, "ms", DISCIPLINE_QUALIFIERS)) {
    return { level: "world_championship", reason: "ms_plus_discipline" };
  }

  // "European Cup" is continental, not a championship — check the cup first.
  if (CONTINENTAL.test(t)) return { level: "continental", reason: "continental_name" };

  if (EUROPEAN_CHAMPIONSHIP.test(t)) return { level: "european_championship", reason: "european_championship_name" };
  if (hasToken(blob, "ech")) return { level: "european_championship", reason: "ech_token" };
  if (hasTokenFollowedBy(blob, "me", DISCIPLINE_QUALIFIERS)) {
    return { level: "european_championship", reason: "me_plus_discipline" };
  }

  if (WORLD_CUP.test(t)) return { level: "world_cup", reason: "world_cup_name" };
  if (hasToken(blob, "wc") && /uci|xco|xcc|mtb|bmx/.test(t)) {
    return { level: "world_cup", reason: "wc_token_with_discipline" };
  }
  // SP: Světový pohár (CZ) vs Slovenský pohár (SK). Only a world marker or a
  // World Cup venue promotes it; everything else is the national cup.
  if (hasToken(blob, "sp")) {
    if (venueIsWorldCup && country !== "SK") {
      return { level: "world_cup", reason: "sp_at_world_cup_venue" };
    }
    return { level: "national", reason: "sp_national_cup" };
  }

  if (NATIONAL_CHAMPIONSHIP.test(t)) return { level: "national", reason: "national_championship_name" };
  if (NATIONAL_SERIES.test(t)) return { level: "national", reason: "national_series_name" };
  if (hasToken(blob, "cp") || hasToken(blob, "mcr") || hasToken(blob, "msr")) {
    return { level: "national", reason: "national_abbreviation" };
  }

  if (opts.uciClass) return { level: "international", reason: "uci_class" };
  if (/\binternational|mezinarodni|internationale?r?\b/.test(t) || hasToken(blob, "uci")) {
    return { level: "international", reason: "international_marker" };
  }

  if (REGIONAL.test(t)) return { level: "regional", reason: "regional_name" };
  return { level: "local", reason: "default" };
}

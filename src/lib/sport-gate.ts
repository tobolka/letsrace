/**
 * Is this actually a bike race?
 *
 * Calendar sources are rarely cycling-only. Regional German portals list club
 * triathlons beside club road races, Czech portals mix in trail runs, and a
 * hospice charity run sat in the catalog tagged `road` for a full season. The
 * name is the only signal available at parse time for most of them, so the gate
 * works on the name plus whatever discipline/category text the adapter found.
 *
 * The rule is deliberately asymmetric: another sport's marker only wins when
 * nothing says "bike". Multisport events that genuinely include a bike leg
 * (MTB biatlon, bike & run) still read as cycling, which is the behaviour we
 * want — those belong in the catalog.
 */
import { fold, foldTokens, hasAnyToken } from "@/lib/text-match";

/**
 * Words that make an entry a bike event no matter what else is in the name.
 *
 * Stems are matched on a leading boundary only, because these languages compound
 * freely — "cyklomaraton", "ciclismo", "cyklistický" all have to hit. Anything
 * that could start an unrelated word (rad-, kolo-) needs an explicit suffix.
 */
const CYCLING_SIGNALS =
  /\b(bike|biking|bicycl|cycl|cyklo|cyklis|cykli|velo|vtt|btt|bici|ciclis|rower|kolarstwo|rad(rennen|marathon|sport|tour|cross|liga)|rennrad|mtb|xco|xcc|xce|xcm|downhill|enduro|gravel|cyclocross|cyklokros|kriterium|criterium|granfondo|gran fondo|jedermann|sjezd|singletrail|bikepark|brevet|randonn|audax|peloton|tandem|handbike|ebike|e-bike|pumptrack|dirt jump|trial)/;

/** Whole words that must not match as a prefix of something else. */
const CYCLING_WORDS = /\b(kolo|kola|kolem|dh|rad)\b/;

/** Standalone tokens that are cycling but too short for the word list above. */
const CYCLING_TOKENS = ["bmx", "xc", "cx", "tt", "gf", "mtb", "vtt", "btt"] as const;

/**
 * Other sports. Each entry must be specific enough that it cannot appear in a
 * bike race name — "run" and "lauf" are handled separately because both mean
 * something else in this domain.
 */
const OTHER_SPORT =
  /\b(triatlon|triathlon|duatlon|duathlon|aquathlon|aquabike|swimrun|swim ?& ?run|plavani|swimming|halfmarathon|halbmarathon|polmaraton|pulmaraton|maratonsky beh|city ?run|fun ?run|park ?run|parkrun|crosslauf|waldlauf|volkslauf|stadtlauf|strassenlauf|berglauf|silvesterlauf|spendenlauf|charity ?run|nachtlauf|firmenlauf|staffellauf|hindernislauf|trailrun|trail ?running|ultratrail|ultra ?trail|skyrace|skyrunning|nordic ?walking|walking|langlauf|skilanglauf|skitour|skialp|skiroll|rollski|bezky|bezecke|bezecky|behu|behem|lyzarsky|lyzarska|biathlon|biatlon|biatlonovy|orienteering|orientacni beh|rogaining|kajak|kanoe|canoe|kayak|rowing|veslovani|inline|skateboard|motocross|enduro moto|supermoto|quad|hokej|fotbal|volejbal)\b/;

/** Running-only markers that survive the "Lauf = series round" ambiguity. */
const RUNNING_COMPOUND =
  /\b(\d+\s?(km|k)\s?-?\s?lauf|\d+\s?(km|k)\s?-?\s?run|halbmarathon|marathonlauf|laufveranstaltung|laufserie|laufcup|beh na|behu na)\b/;

/**
 * German `Lauf` means "round" in a series ("2. Lauf Isarcup MTB") far more often
 * than it means "run" on these calendars. Only an actual running compound
 * (Spendenlauf, Volkslauf, 100-km Lauf) counts as another sport; a bare ordinal
 * "N. Lauf" is a round and must not disqualify the race.
 */
export function looksLikeRunningEvent(name: string): boolean {
  const t = fold(name);
  if (RUNNING_COMPOUND.test(t)) return true;
  if (/\b(spenden|volks|stadt|strassen|berg|silvester|nacht|firmen|staffel|hindernis|cross|wald|panorama|advents|oster|herbst|fruhjahrs|sommernachts)lauf\b/.test(t)) {
    return true;
  }
  // "Lauf" standing alone, not preceded by an ordinal / round marker.
  if (/\blauf\b/.test(t) && !/\d+\s*\.?\s*lauf\b|\blauf\s*(zum|zur|des|der|de[sr]?)\b/.test(t)) {
    return /\bmarathon\b|\bkm\b/.test(t);
  }
  return false;
}

/** True when the text carries a positive cycling marker. */
export function hasCyclingSignal(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = fold(text);
  if (CYCLING_SIGNALS.test(t) || CYCLING_WORDS.test(t)) return true;
  return hasAnyToken(text, CYCLING_TOKENS);
}

/**
 * True when the entry is another sport and nothing marks it as cycling.
 *
 * Pass every scrap the adapter has — category names and the source's own sport
 * label included. A triathlon listed with a "Radfahren" split still reads as
 * cycling here, and that is intentional: we would rather keep a borderline
 * multisport race than drop a real one.
 */
export function isNonCyclingEventName(
  name: string,
  extraText?: string | null,
): boolean {
  const blob = `${name} ${extraText ?? ""}`;
  if (hasCyclingSignal(blob)) return false;
  const t = fold(blob);
  if (OTHER_SPORT.test(t)) return true;
  if (/\bstriebro|\bzlato/.test(t)) return false;
  return looksLikeRunningEvent(blob);
}

/**
 * True when the name is a bike race we can classify with confidence.
 * Used to decide whether a discipline guess is allowed to stand.
 */
export function isConfidentCyclingEvent(name: string, extraText?: string | null): boolean {
  return hasCyclingSignal(`${name} ${extraText ?? ""}`) && !isNonCyclingEventName(name, extraText);
}

/** Debug helper — which sport markers fired, for the audit script. */
export function sportMarkers(name: string, extraText?: string | null): string[] {
  const blob = foldTokens(`${name} ${extraText ?? ""}`);
  const out: string[] = [];
  const other = blob.match(OTHER_SPORT);
  if (other) out.push(`other:${other[0]}`);
  if (looksLikeRunningEvent(blob)) out.push("other:running");
  const cyc = blob.match(CYCLING_SIGNALS);
  if (cyc) out.push(`cycling:${cyc[0]}`);
  return out;
}

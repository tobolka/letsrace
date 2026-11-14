/**
 * A last look at races a pass wants to add, before anything is sent. The collector's
 * own gates decide what it writes to the copy; here the question is stricter, because
 * a wrong race on the public map is worse than a right one arriving a little later.
 * A held race is not rejected: it waits with its reason and the next read can clear it.
 */
import { assessDuplicate, datesCompatible, isGarbagePlace, isWeakRaceName, type DedupEvent } from "@/lib/dedup";
import { isNonRaceEventName } from "@/lib/event-visibility";
import { isNonCyclingEventName } from "@/lib/sport-gate";
import { normalizeName } from "@/lib/domain";
import { judgeRide } from "@/lib/pipeline2/rides";

export type NewRace = {
  id: string; name: string; start_date: string; end_date?: string | null; visibility?: string | null; event_type?: string | null;
  disciplines?: string[] | null; website_url?: string | null; location_id?: string | null;
};
export type Place = { municipality?: string | null; name?: string | null; country_code?: string | null; lat?: number | null; lng?: number | null };
export type KnownRace = { id: string; name: string; start_date: string; end_date?: string | null; disciplines?: string[] | null; website_url?: string | null; place?: Place | null };

/** Only discipline or generic words: "SHORT TRACK" could be any race anywhere. */
const ONLY_GENERIC_WORDS = /^(?:(?:short|track|xco|xcc|xcm|xce|xc|mtb|bmx|road|gravel|cyclocross|cyklokros|ciclocross|enduro|downhill|dh|race|rennen|zavod|závod|corsa|gara|wyscig|wyścig|maraton|marathon|cup|pohár|pohar|kriterium|kritérium|criterium|časovka|casovka|zeitfahren|gp|grand|prix|kids|dětský|detsky|junior|\d+\.?)\s*)+$/i;

const asDedup = (race: Pick<KnownRace, "name" | "start_date" | "end_date" | "disciplines" | "website_url">, place: Place | null | undefined): DedupEvent => ({
  name: race.name, startDate: race.start_date, endDate: race.end_date, countryCode: place?.country_code, placeText: place?.municipality ?? place?.name,
  lat: place?.lat, lng: place?.lng, disciplines: race.disciplines as DedupEvent["disciplines"], urls: [race.website_url],
});
function officialPage(url: string | null | undefined): string | null {
  try { const u = new URL(url!); return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "") + u.search; } catch { return null; }
}

export { pairKey } from "@/lib/pipeline2/agent-case-groups";
import { pairKey } from "@/lib/pipeline2/agent-case-groups";

/**
 * Reasons to hold this race back; empty means it is ready to send.
 * `separate` holds pairs already judged to be two different races, with the pages quoted
 * (see scripts/agent-daily.cjs). Such a listed race no longer counts as a possible double.
 */
export function newRaceProblems(race: NewRace, place: Place | null | undefined, catalogue: KnownRace[], today: string, separate?: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const name = race.name?.trim() ?? "";
  if (name.length < 4 || isWeakRaceName(name) || ONLY_GENERIC_WORDS.test(name)) problems.push("name_says_too_little");
  if (isNonRaceEventName(name) || isNonCyclingEventName(name, "")) problems.push("not_a_cycling_race");
  // A ride settled by what it is (a brevet, an RTF) goes out as a ride, which race views do not
  // show; one listed as a ride for a vaguer reason waits for its page to be read.
  if (race.event_type === "ride" && judgeRide({ name }).kind !== "ride") problems.push("listed_as_a_ride");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(race.start_date ?? "") || race.start_date < today) problems.push("no_future_date");
  const town = place?.municipality ?? place?.name;
  if (!place?.country_code || !town || isGarbagePlace(town)) problems.push("no_usable_place");
  // A known municipality is sufficient for publication; geocoding is separate work.

  const incoming = asDedup(race, place);
  for (const known of catalogue) {
    if (known.id === race.id) continue;
    if (separate?.has(pairKey(race.id, known.id))) continue;
    if (!datesCompatible({ startDate: known.start_date, endDate: known.end_date }, { startDate: race.start_date, endDate: race.end_date }, 1)) continue;
    // A broad calendar title can label a CX event MTB/road/gravel. Conflicting
    // discipline tags must not silently resurrect a previously merged alias.
    // This is a review hold, never an automatic merge across disciplines.
    const a = normalizeName(race.name), b = normalizeName(known.name);
    const shorter = a.length < b.length ? a : b, longer = a.length < b.length ? b : a;
    if (race.start_date === known.start_date && place?.country_code === known.place?.country_code &&
        officialPage(race.website_url) && officialPage(race.website_url) === officialPage(known.website_url) &&
        shorter.length >= 12 && shorter.split(" ").length >= 3 && (` ${longer} `).includes(` ${shorter} `)) {
      problems.push("may_already_be_listed"); break;
    }
    const match = assessDuplicate(incoming, asDedup(known, known.place));
    // "review" includes date-only scores: a shared weekend is not an identity
    // signal. Keep uncertain name/URL matches for review, not every race that day.
    const identity = match.reasons.some(reason => /^(?:fingerprint|same_url|same_canonical_name|name_sim_high|name_sim_mid|name_substring|series_alias|same_round|weak_name_absorbed|venue_format_mirror|national_championship_mirror)$/.test(reason));
    if (match.decision === "match" || match.decision === "review" && (identity || match.reasons.includes("same_place") && match.reasons.includes("name_sim_low"))) {
      problems.push("may_already_be_listed");
      break;
    }
  }
  return problems;
}

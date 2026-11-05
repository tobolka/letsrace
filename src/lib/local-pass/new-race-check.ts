/**
 * A last look at races a pass wants to add, before anything is sent. The collector's
 * own gates decide what it writes to the copy; here the question is stricter, because
 * a wrong race on the public map is worse than a right one arriving a little later.
 * A held race is not rejected: it waits with its reason and the next read can clear it.
 */
import { assessDuplicate, datesCompatible, isGarbagePlace, isWeakRaceName, type DedupEvent } from "@/lib/dedup";
import { isNonRaceEventName } from "@/lib/event-visibility";
import { isNonCyclingEventName } from "@/lib/sport-gate";

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

/** Reasons to hold this race back; empty means it is ready to send. */
export function newRaceProblems(race: NewRace, place: Place | null | undefined, catalogue: KnownRace[], today: string): string[] {
  const problems: string[] = [];
  const name = race.name?.trim() ?? "";
  if (name.length < 4 || isWeakRaceName(name) || ONLY_GENERIC_WORDS.test(name)) problems.push("name_says_too_little");
  if (isNonRaceEventName(name) || isNonCyclingEventName(name, "")) problems.push("not_a_cycling_race");
  if (race.event_type === "ride") problems.push("listed_as_a_ride");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(race.start_date ?? "") || race.start_date < today) problems.push("no_future_date");
  const town = place?.municipality ?? place?.name;
  if (!place?.country_code || !town || isGarbagePlace(town)) problems.push("no_usable_place");
  else if (place.lat == null || place.lng == null) problems.push("place_not_on_the_map");

  const incoming = asDedup(race, place);
  for (const known of catalogue) {
    if (known.id === race.id) continue;
    if (!datesCompatible({ startDate: known.start_date, endDate: known.end_date }, { startDate: race.start_date, endDate: race.end_date }, 1)) continue;
    if (assessDuplicate(incoming, asDedup(known, known.place)).decision !== "distinct") {
      problems.push("may_already_be_listed");
      break;
    }
  }
  return problems;
}

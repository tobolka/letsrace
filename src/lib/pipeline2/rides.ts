/**
 * Ride or race, decided when a listing is read rather than later by an agent.
 *
 * What settles it, strongest first:
 *  1. The organiser says so in plain words: "Es ist kein Wettrennen", "keine Zeitnahme",
 *     "nejde o závod", "non competitiva" (a ride) or "mit Zeitnahme und Wertung",
 *     "Siegerehrung", "výsledková listina" (a race).
 *  2. The source's own event type names a kind of ride: BREVET, RTF, CTF, Radtouristik.
 *  3. The name is such a kind: a brevet, an RTF or CTF, a rajd, a randonnée, a výšlap.
 *
 * "Tour" or "Marathon" in a name decides nothing: a Radmarathon, a gran fondo or a
 * "Mladá Boleslav Tour" is timed and ranked unless its own page says otherwise. A vague
 * type (TOUR, GRAVEL_TOUR) without a statement stays "unsure" and is asked about.
 */
import { fold } from "@/lib/text-match";

const fromNfd = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Names that say "ride without a result". A marathon or gran fondo is not in this list. */
export const looksLikeRide = (name: string) => /\b(brevet|brm|rtf|ctf|audax|randonn\w*|rajd\w*|permanente?|radtourenfahrt|radtouristik\w*|country[- ]?tourenfahrt|vyjizdka|spanil\w* jizd\w*|cicloturistic\w*|pedalata|social ride)\b/i.test(fromNfd(name));

/** Event types a calendar uses only for rides: no timing, no ranking. */
const RIDE_TYPES = new Set(["BREVET", "GRAVEL_BREVET", "RTF", "CTF", "RADTOURISTIK", "AUSFAHRT", "VOLKSRADFAHREN", "PERMANENTE"]);
/** Types that are usually rides but are also used for timed events. */
const VAGUE_RIDE_TYPES = new Set(["TOUR", "GRAVEL_TOUR", "GRAVEL_RIDE"]);

/** The organiser saying there is no race: no timing, no ranking, no winner. */
const SAYS_NOT_A_RACE = new RegExp([
  String.raw`\b(?:es ist |ist |sind )?kein(?:e|en)? (?:wett)?(?:rennen|radrennen|wettkampf|wettbewerb)\b`,
  String.raw`\bkeine (?:zeitnahme|zeitmessung|wertung|platzierung|rangliste|ergebnisliste)\b`,
  String.raw`\bohne (?:zeitnahme|zeitmessung|wertung|rangliste)\b`,
  String.raw`\bnicht um (?:die |eine )?(?:zeit|platzierung|platz)\b`,
  String.raw`\b(?:not|no) a race\b|\bno timing\b|\buntimed\b|\bnon[- ]?competitive\b|\bno (?:ranking|classification|results)\b`,
  String.raw`\b(?:neni|nejde o|nejedna se o) (?:zavod|soutez)\w*\b|\bbez (?:mereni casu|casomiry|vyhodnoceni|poradi)\b`,
  String.raw`\bnie (?:jest|ma) (?:wyscig|rywalizac)\w*\b|\bbez (?:pomiaru czasu|klasyfikacji)\b`,
  String.raw`\bnon competitiv[ao]\b|\bsenza (?:classifica|cronometraggio)\b|\bnessuna classifica\b`,
  String.raw`\bpas une course\b|\bsans (?:classement|chronometrage)\b|\bnon chronometre\w*\b`,
].join("|"));

/** The organiser describing a ranked result. Timing alone is not enough: a brevet records times too. */
const SAYS_RANKED = new RegExp([
  String.raw`\b(?:mit |inkl\.? )?(?:zeitnahme|zeitmessung) und (?:wertung|ergebnis\w*|platzierung\w*)\b`,
  String.raw`\b(?:siegerehrung|ergebnisliste|altersklassenwertung|gesamtwertung)\b`,
  String.raw`\b(?:prize ?giving|podium ceremony|ranked results|results list|overall ranking)\b`,
  String.raw`\b(?:vyhlaseni (?:vitezu|vysledku)|vysledkova listina|celkove poradi)\b`,
  String.raw`\b(?:dekoracja zwyciezcow|klasyfikacja generalna)\b|\bclassifica (?:generale|finale)\b|\bpremiazion\w*\b`,
  String.raw`\bclassement (?:general|scratch)\b`,
].join("|"));

export type RideJudgement = { kind: "ride" | "race" | "unsure"; why: string };

/**
 * One listing's judgement. `kind` is "ride" or "race" only when the evidence settles it;
 * "unsure" means a person or the agent should look at the organiser's page.
 * Returns race with why "no_ride_signal" when nothing points at a ride at all.
 */
export function judgeRide(input: { name: string; eventType?: string | null; text?: string | null }): RideJudgement {
  const type = (input.eventType ?? "").toUpperCase().replace(/[\s-]+/g, "_");
  const text = fold(input.text ?? "");
  const notARace = SAYS_NOT_A_RACE.exec(text);
  const ranked = SAYS_RANKED.exec(text.replace(SAYS_NOT_A_RACE, " "));
  if (notARace && !ranked) return { kind: "ride", why: `organiser: ${notARace[0].trim()}` };
  const rideType = RIDE_TYPES.has(type), vague = VAGUE_RIDE_TYPES.has(type), rideName = looksLikeRide(input.name);
  if (notARace && ranked) return { kind: "unsure", why: "organiser text says both" };
  if (ranked) return rideType || rideName ? { kind: "unsure", why: `ride type but ranked: ${ranked[0].trim()}` } : { kind: "race", why: `organiser: ${ranked[0].trim()}` };
  if (rideType) return { kind: "ride", why: `source type ${type}` };
  if (rideName) return { kind: "ride", why: "name is a kind of ride" };
  if (vague) return { kind: "unsure", why: `source type ${type} alone` };
  return { kind: "race", why: "no_ride_signal" };
}

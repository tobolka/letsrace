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

/** Event types and federation categories used only for rides: no timing, no ranking. */
const RIDE_TYPES = new Set([
  "BREVET",
  "GRAVEL_BREVET",
  "RTF",
  "CTF",
  "RADTOURISTIK",
  "RADTOURENFAHRT",
  "COUNTRY_TOURENFAHRT",
  "AUSFAHRT",
  "VOLKSRADFAHREN",
  "PERMANENTE",
  "RADWANDERN",
  "GENUSSFAHRT",
  "FAMILIENAUSFAHRT",
  "OHNE_ZEITNAHME",
  "NON_COMPETITIVA",
  "NON_COMPETITIVO",
  "NON_COMPETITIVE",
  "NON_COMPETITIF",
  "CICLOTURISTICA",
  "CICLOTURISTICO",
  "CICLOTURISMO",
  "CYCLOTOURISME",
  "CYCLO_TOURISME",
  "ESCURSIONISMO",
  "ESCURSIONISTICA",
  "ESCURSIONISTICO",
  "PEDALATA",
  "CICLOPEDALATA",
  "RADUNO",
  "CICLORADUNO",
  "CYKLOJIZDA",
  "VYJIZDKA",
  "CYKLOVYJIZDKA",
  "SPANILA_JIZDA",
  "NESOUTEZNI",
  "REKREACNI",
  "RAJD",
  "RAJD_ROWEROWY",
  "REKREACYJNY",
  "RECREATIONAL",
  "NON_TIMED",
  "UNTIMED",
  "RIDE",
  "SOCIAL_RIDE",
  "GROUP_RIDE",
  "FAMILY_RIDE",
  "CHARITY_RIDE",
  "FUN_RIDE",
  "RANDONNEE",
  "AUDAX",
]);
/** Types that are usually rides but are also used for timed events. */
const VAGUE_RIDE_TYPES = new Set(["TOUR", "GRAVEL_TOUR", "GRAVEL_RIDE", "RADTOUR", "BIKE_TOUR", "CYCLING_TOUR"]);

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

export type JudgeRideInput = {
  name: string;
  eventType?: string | null;
  sourceCategories?: (string | null | undefined)[] | null;
  text?: string | null;
};

export type AgentQueueAction = "process_race" | "skip_non_competitive" | "decide_ride";

export type AgentQueueClassification = {
  action: AgentQueueAction;
  judgement: RideJudgement;
};

const normalizeTypeToken = (value: string) =>
  fromNfd(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

function inspectCategoryLabels(labels: (string | null | undefined)[]): {
  rideMatch: string | null;
  vagueMatch: string | null;
} {
  let rideMatch: string | null = null;
  let vagueMatch: string | null = null;

  for (const raw of labels) {
    if (!raw || typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const candidates = [trimmed, ...trimmed.split(/[/,;|•·()–—]|\s+-\s+/)];
    for (const part of candidates) {
      const token = normalizeTypeToken(part);
      if (!token) continue;
      if (!rideMatch && RIDE_TYPES.has(token)) rideMatch = token;
      if (!vagueMatch && VAGUE_RIDE_TYPES.has(token)) vagueMatch = token;
    }

    if (!rideMatch) {
      const phrase = SAYS_NOT_A_RACE.exec(fold(trimmed));
      if (phrase) rideMatch = normalizeTypeToken(phrase[0]);
    }
  }

  return { rideMatch, vagueMatch };
}

const SOURCE_CATEGORY_KEYS = new Set([
  "category",
  "categories",
  "eventtype",
  "event_type",
  "type",
  "class",
  "raceclass",
  "race_class",
  "tipologia",
  "tipologia_gara",
  "tipologiagara",
  "categoria",
  "categorie",
  "disciplina",
  "discipline",
  "event_category",
  "eventcategory",
  "race_type",
  "racetype",
  "kind",
  "format",
  "classification",
  "subtype",
  "sub_type",
]);

const TEXT_CATEGORY_LINE_RE =
  /\b(?:category|categories|event[_ ]?type|type|class|race[_ ]?class|tipologia(?:[_ ]?gara)?|categoria|disciplina)\s*[:=]\s*([^\r\n;|]+)/gi;

/**
 * Safely extracts category/type strings from `event_sources.raw_payload`, `notes`,
 * or federation metadata objects/JSON strings without throwing on null or malformed JSON.
 */
export function extractSourceCategories(raw: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visited = new WeakSet<object>();

  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };

  const pushFieldValue = (value: unknown, depth: number) => {
    if (depth > 5 || value == null) return;
    if (typeof value === "string") {
      push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) pushFieldValue(item, depth + 1);
      return;
    }
    if (typeof value === "object") {
      if (visited.has(value)) return;
      visited.add(value);
      const record = value as Record<string, unknown>;
      for (const labelKey of ["name", "label", "code", "value", "title", "text"]) {
        if (typeof record[labelKey] === "string") push(record[labelKey]);
      }
      walk(record, depth + 1);
    }
  };

  const walk = (node: unknown, depth: number) => {
    if (depth > 5 || node == null) return;
    if (typeof node === "string") {
      const trimmed = node.trim();
      if (!trimmed) return;
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          walk(JSON.parse(trimmed), depth + 1);
          return;
        } catch {
          // Malformed JSON: fall through safely to text key:value extraction.
        }
      }
      for (const match of trimmed.matchAll(TEXT_CATEGORY_LINE_RE)) {
        if (match[1]) push(match[1]);
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node === "object") {
      if (visited.has(node)) return;
      visited.add(node);
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        const compactKey = lowerKey.replace(/[^a-z0-9]/g, "");
        if (SOURCE_CATEGORY_KEYS.has(lowerKey) || SOURCE_CATEGORY_KEYS.has(compactKey)) {
          pushFieldValue(value, depth + 1);
        } else if (value && typeof value === "object") {
          walk(value, depth + 1);
        } else if (typeof value === "string" && (value.trim().startsWith("{") || value.trim().startsWith("["))) {
          walk(value, depth + 1);
        }
      }
    }
  };

  walk(raw, 0);
  return out;
}

/**
 * One listing's judgement. `kind` is "ride" or "race" only when the evidence settles it;
 * "unsure" means a person or the agent should look at the organiser's page.
 * Returns race with why "no_ride_signal" when nothing points at a ride at all.
 */
export function judgeRide(input: JudgeRideInput): RideJudgement {
  const typeCheck = inspectCategoryLabels([input.eventType]);
  const categoryCheck = inspectCategoryLabels(input.sourceCategories ?? []);
  const text = fold(input.text ?? "");
  const notARace = SAYS_NOT_A_RACE.exec(text);
  const ranked = SAYS_RANKED.exec(text.replace(SAYS_NOT_A_RACE, " "));
  if (notARace && !ranked) return { kind: "ride", why: `organiser: ${notARace[0].trim()}` };
  const rideType = typeCheck.rideMatch;
  const rideCategory = categoryCheck.rideMatch;
  const vagueType = typeCheck.vagueMatch;
  const vagueCategory = categoryCheck.vagueMatch;
  const rideName = looksLikeRide(input.name);
  if (notARace && ranked) return { kind: "unsure", why: "organiser text says both" };
  if (ranked) {
    return rideType || rideCategory || rideName
      ? { kind: "unsure", why: `ride type but ranked: ${ranked[0].trim()}` }
      : { kind: "race", why: `organiser: ${ranked[0].trim()}` };
  }
  if (rideType) return { kind: "ride", why: `source type ${rideType}` };
  if (rideCategory) return { kind: "ride", why: `source category ${rideCategory}` };
  if (rideName) return { kind: "ride", why: "name is a kind of ride" };
  if (vagueType) return { kind: "unsure", why: `source type ${vagueType} alone` };
  if (vagueCategory) return { kind: "unsure", why: `source category ${vagueCategory} alone` };
  return { kind: "race", why: "no_ride_signal" };
}

/**
 * Queue gate for agent cases (`extract_details`, `find_regulations`, `decide_ride`).
 * Evaluates each event independently by its own day, name, event type, source categories and text,
 * so a companion non-competitive ride on one day never suppresses a separate race on another day.
 */
export function classifyEventForAgentQueue(event: {
  id: string;
  name: string;
  startDate: string;
  endDate?: string | null;
  eventType?: string | null;
  sourceCategories?: (string | null | undefined)[];
  sourceText?: string | null;
  notes?: string | null;
}): AgentQueueClassification {
  const combinedText = [event.sourceText, event.notes]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n");

  const judgement = judgeRide({
    name: event.name,
    eventType: event.eventType,
    sourceCategories: event.sourceCategories,
    text: combinedText || null,
  });

  if (event.eventType?.trim().toLowerCase() === "ride") {
    return {
      action: "skip_non_competitive",
      judgement: judgement.kind === "ride" ? judgement : { kind: "ride", why: "event_type is ride" },
    };
  }
  if (judgement.kind === "ride") return { action: "skip_non_competitive", judgement };
  if (judgement.kind === "unsure") return { action: "decide_ride", judgement };
  return { action: "process_race", judgement };
}

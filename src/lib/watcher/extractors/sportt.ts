import type { Discipline, ParsedEvent } from "@/lib/domain";
import { fetchText } from "@/lib/watcher/http";

const SITE = "https://sportt.cz";
const API = `${SITE}/www.sportovniservis.frontend.index`;

/**
 * sportt.cz (Sportovní servis) is a Czech entry platform for whoever books it:
 * of twenty-odd upcoming events most are running races, with a golf scramble
 * and a race-walking hour among them, and a handful are bike races nobody
 * else lists.
 *
 * Two things it does not have, at all, in any of its calls: where a race is,
 * and what sport it is. A blanket "does this name mention another sport" gate
 * is the wrong test here — it keeps the golf and the road running — so the
 * burden of proof runs the other way: a race is taken only when its own name
 * or its organiser's address shows it is ridden on a bike, and only when a
 * place can be read out of the name. Everything else is left alone rather than
 * guessed at, because a race with no place cannot go on a map and a running
 * race in a cycling catalogue is worse than a gap.
 *
 * The listing page is a shell around a JSON API, which is what this reads.
 */

export function isSporttHost(host: string): boolean {
  return host.replace(/^www\./, "").endsWith("sportt.cz");
}

export type SporttRace = {
  id?: number;
  name?: string | null;
  /** `[year, month, day]`, month 1-based. */
  date?: [number, number, number] | number[] | null;
  web?: string | null;
  raceFee?: number | null;
  status?: number | null;
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** What the name says the race is ridden on, when it says anything. */
const NAME_DISCIPLINE: { re: RegExp; discipline: Discipline }[] = [
  { re: /\bsilnicn\w*|\bcasovk\w*\b/, discipline: "road" },
  { re: /\bmtb\b|\bhorsk\w*\s+kol/, discipline: "mtb" },
  { re: /\bgravel\b/, discipline: "gravel" },
  { re: /\bcyklokros\b|\bcyclocross\b/, discipline: "cx" },
  { re: /\bcyklistik\w*|\bcyklo\w*/, discipline: "mtb" },
];

/**
 * An organiser whose address says what they put on. "Maraton" in a name means
 * running as often as it means MTB; `ustimtbcup.cz` does not.
 */
const HOST_DISCIPLINE: { re: RegExp; discipline: Discipline }[] = [
  { re: /mtb|bike|kolo|cyklo/, discipline: "mtb" },
  { re: /silnic|road/, discipline: "road" },
];

export function sporttDiscipline(name: string, web: string | null | undefined): Discipline[] | null {
  const text = fold(name);
  for (const rule of NAME_DISCIPLINE) {
    if (rule.re.test(text)) return [rule.discipline];
  }
  let host = "";
  try {
    host = new URL(web ?? "").hostname.toLowerCase();
  } catch {
    host = "";
  }
  if (host) {
    for (const rule of HOST_DISCIPLINE) {
      if (rule.re.test(host)) return [rule.discipline];
    }
  }
  return null;
}

/**
 * The town, out of the name, or nothing.
 *
 * This was going to read the capitalised word too — Czech organisers shout the
 * venue — until the first race tried it on: "RI OKNA MAŘENICE-CHATA LUŽ" puts
 * the window company that pays for it in capitals before the village. Picking
 * the longest, or the second, is guessing at marketing copy, and a race pinned
 * to the wrong village is worse than a race this source does not add.
 *
 * What is left is the one form that is a rule rather than a habit: the
 * adjective a Czech town makes of itself, "Kraslické" from Kraslice. Anything
 * else is nothing.
 */
const ADJECTIVE_ENDINGS: [RegExp, string][] = [
  [/ovsk[éeáyý]$/i, "ov"],
  [/ick[éeáyý]$/i, "ice"],
];

const NOT_A_PLACE = new Set([
  "ceske",
  "cesky",
  "velke",
  "velky",
  "male",
  "maly",
  "nove",
  "novy",
  "horske",
  "silnicni",
  "detske",
  "sportovni",
]);

export function sporttPlace(name: string): string | null {
  const cleaned = name
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const word of cleaned.split(" ")) {
    if (word.length < 6) continue;
    if (NOT_A_PLACE.has(fold(word))) continue;
    for (const [re, tail] of ADJECTIVE_ENDINGS) {
      if (!re.test(word)) continue;
      const stem = word.replace(re, "");
      if (stem.length < 4) continue;
      return titleCase(stem + tail);
    }
  }

  return null;
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function isoDate(date: SporttRace["date"]): string | null {
  if (!Array.isArray(date) || date.length < 3) return null;
  const [y, m, d] = date;
  if (!y || !m || !d) return null;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** A PDF of the regulations is not the race's website. */
function websiteOf(web: string | null | undefined): string | undefined {
  const url = (web ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return undefined;
  if (/\.pdf(\?|$)/i.test(url)) return undefined;
  return url;
}

export function parseSporttRaces(records: SporttRace[]): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  for (const race of records) {
    const id = race.id;
    const name = (race.name ?? "").replace(/\s+/g, " ").trim();
    if (!id || name.length < 4) continue;

    const startDate = isoDate(race.date);
    if (!startDate) continue;

    const discipline = sporttDiscipline(name, race.web);
    if (!discipline) continue;

    const placeText = sporttPlace(name);
    if (!placeText) continue;

    const externalId = `sportt-${id}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    events.push({
      externalId,
      name: name.slice(0, 160),
      startDate,
      placeText,
      countryHint: "CZ",
      discipline,
      audience: "mixed",
      sourceUrl: `${SITE}/race/${id}`,
      // This is the platform you actually enter on, which is the one link
      // these races tend not to have anywhere else.
      registrationUrl: `${SITE}/race/${id}`,
      websiteUrl: websiteOf(race.web),
      // The place is read out of the name, not stated by the source.
      confidence: 0.6,
    });
  }

  return events;
}

/** `{"records": [...]}` for every race not yet run. */
export async function fetchSporttRaces(now = new Date()): Promise<SporttRace[]> {
  const request = {
    method: "getRacesList",
    filter: {
      onlyStatuses: [0],
      minDate: [now.getFullYear(), now.getMonth() + 1, now.getDate()],
    },
    sortBy: "date",
  };
  const res = await fetchText(API, {
    method: "POST",
    body: `request=${encodeURIComponent(JSON.stringify(request))}`,
    contentType: "application/x-www-form-urlencoded",
    accept: "application/json",
    timeoutMs: 20_000,
  });
  if (!res.ok || !res.text) return [];
  try {
    const parsed = JSON.parse(res.text) as { records?: SporttRace[] };
    return parsed.records ?? [];
  } catch {
    return [];
  }
}

export async function parseSportt(): Promise<ParsedEvent[]> {
  return parseSporttRaces(await fetchSporttRaces());
}

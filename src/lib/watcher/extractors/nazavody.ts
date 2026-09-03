import type { Discipline, ParsedEvent } from "@/lib/domain";
import { fetchText } from "@/lib/watcher/http";

const API = "https://www.nazavody.cz/webapi/home/allraces-grouped-paginated";
const SITE = "https://www.nazavody.cz";
const MAX_PAGES = 20;

/**
 * naZávody.cz is a Czech entry platform, mostly for running: of forty-odd
 * upcoming events about ten are bike races, and those are the grassroots kind
 * — a pumptrack race, a kids' MTB cup round, a downhill at a trail park — that
 * no federation calendar carries. The listing page is a React shell, so this
 * reads the JSON its own client reads.
 */
export function isNaZavodyHost(host: string): boolean {
  return host.replace(/^www\./, "").endsWith("nazavody.cz");
}

/** Their own tag vocabulary. These are the ones ridden on a bike. */
const CYCLING_TAGS: Record<string, Discipline> = {
  mtb: "mtb",
  "silnicni cyklistika": "road",
  cyklo: "mtb",
  gravel: "gravel",
};

/**
 * Tags for sports done on foot, skates or in the water. One alongside a bike
 * tag is normal — a village race puts a run on the same morning — but a handful
 * of them means an adventure or multisport event that happens to include a bike
 * leg, which is not a bike race.
 */
const OTHER_SPORT_TAGS = new Set([
  "beh",
  "kros beh",
  "1/2 maraton",
  "maraton",
  "triatlon",
  "duatlon",
  "inline",
  "canicross",
  "dogtrekking",
  "nordic walking",
  "plavani",
]);

const MULTISPORT_TAGS = new Set(["triatlon", "duatlon"]);

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type ApiRace = {
  id?: number;
  slug?: string | null;
  name?: string | null;
  datetime?: string | null;
  place?: string | null;
  tags?: string[] | null;
};

type ApiRange = { startDate?: string | null; endDate?: string | null; races?: ApiRace[] | null };
type ApiMonth = { dateRanges?: ApiRange[] | null };
type ApiPage = { months?: ApiMonth[] | null; noOtherRaces?: boolean };

/**
 * Their timestamps are UTC, and a Czech race starting at midnight local time is
 * stamped 22:00 the previous day. Reading the first ten characters would move
 * every second race a day earlier — and a race on the wrong day does not merge
 * with the one already in the catalogue, it duplicates it.
 */
export function pragueDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

/** Which disciplines a race's tags name, and whether it is a bike race at all. */
export function disciplinesFromTags(tags: string[]): Discipline[] | null {
  const folded = tags.map(fold);
  const discs = new Set<Discipline>();
  for (const tag of folded) {
    const d = CYCLING_TAGS[tag];
    if (d) discs.add(d);
  }
  if (discs.size === 0) return null;
  if (folded.some((tag) => MULTISPORT_TAGS.has(tag))) return null;
  const others = folded.filter((tag) => OTHER_SPORT_TAGS.has(tag)).length;
  if (others > 1) return null;
  return [...discs];
}

export function parseNaZavodyPage(page: ApiPage): ParsedEvent[] {
  const events: ParsedEvent[] = [];

  for (const month of page.months ?? []) {
    for (const range of month.dateRanges ?? []) {
      for (const race of range.races ?? []) {
        const id = race.id;
        const name = (race.name ?? "").replace(/\s+/g, " ").trim();
        if (!id || name.length < 3 || !race.datetime) continue;

        const discipline = disciplinesFromTags(race.tags ?? []);
        if (!discipline) continue;

        const startDate = pragueDate(race.datetime);
        if (!startDate) continue;
        const endRaw = range.endDate ? pragueDate(range.endDate) : null;
        const endDate = endRaw && endRaw > startDate ? endRaw : undefined;

        const slug = (race.slug ?? "").trim();
        const url = slug ? `${SITE}/zavod/${slug}/` : `${SITE}/zavody`;

        events.push({
          externalId: `nazavody-${id}`,
          name: name.slice(0, 160),
          startDate,
          ...(endDate ? { endDate } : {}),
          placeText: (race.place ?? "").replace(/\s+/g, " ").trim(),
          countryHint: "CZ",
          discipline,
          audience: "mixed",
          sourceUrl: url,
          // The platform page is where you actually enter, so it is the entry
          // link rather than a calendar row pretending to be one.
          registrationUrl: slug ? url : undefined,
          confidence: 0.8,
        });
      }
    }
  }

  return events;
}

export async function parseNaZavody(): Promise<ParsedEvent[]> {
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await fetchText(`${API}?page=${page}`, {
      accept: "application/json",
      timeoutMs: 20_000,
    });
    if (!res.ok || !res.text) break;

    let parsed: ApiPage;
    try {
      parsed = JSON.parse(res.text) as ApiPage;
    } catch {
      break;
    }

    for (const ev of parseNaZavodyPage(parsed)) {
      if (seen.has(ev.externalId)) continue;
      seen.add(ev.externalId);
      events.push(ev);
    }

    if (parsed.noOtherRaces) break;
  }

  return events;
}

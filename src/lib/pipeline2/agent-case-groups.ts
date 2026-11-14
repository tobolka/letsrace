/**
 * One question once. Cases for the agent are grouped before they enter its queue, so that
 *  - two records of one race (a hyphen in one name, an en dash in the other) are one date search,
 *  - "is a like b" and "is b like a" are one duplicate check, whichever list raised it,
 *  - two filtered views of one calendar (Cycling Austria's "all" and "road") are one read,
 *  - and a race the agent found on both views is one lead, with every page that lists it.
 * Grouping never joins two races: it only stops asking the same thing twice. Different names or
 * different days stay different cases (Stubalpen Mehrstunden on Saturday, Kids on Sunday).
 */
import { normalizeName } from "@/lib/domain";

/** One key for a pair of races, whichever way round it is asked. */
export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/** Name and day of a race, the way two records of it would agree: punctuation, case, accents and year do not count. */
export const sameRaceKey = (name: string, date: string) => `${normalizeName(name)}|${date}`;

type RaceCase = { case: string; race: { id: string; name: string; last_date?: string; date?: string; pages_we_read?: string[]; found_on?: string[]; same_race_ids?: string[] } };

/**
 * Cases about one race in several records, folded into the first. The kept case lists the other
 * records in `race.same_race_ids` and every page any of them was read from, so one answer covers all.
 */
export function groupSameRace<T extends RaceCase>(cases: T[]): T[] {
  const kept = new Map<string, T>();
  for (const item of cases) {
    const key = sameRaceKey(item.race.name, item.race.last_date ?? item.race.date ?? "");
    const first = kept.get(key);
    if (!first) { kept.set(key, item); continue; }
    const race = first.race;
    race.same_race_ids = [...new Set([...(race.same_race_ids ?? []), item.race.id])];
    if (item.race.pages_we_read) race.pages_we_read = [...new Set([...(race.pages_we_read ?? []), ...item.race.pages_we_read])];
    if (item.race.found_on) race.found_on = [...new Set([...(race.found_on ?? []), ...item.race.found_on])];
  }
  return [...kept.values()];
}

/** A calendar regardless of its filter and page: the host without www, and the path. */
export function calendarKey(url: string): string {
  try { const u = new URL(url); return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/+$/, "").toLowerCase()}`; } catch { return url; }
}

type CalendarCase = { case: string; source: { url: string; kind: string; also?: string[] }; we_have: { name: string; date: string }[] };

/** Filtered views of one calendar, folded into one case that names every view and everything we hold from any. */
export function groupCalendars<T extends CalendarCase>(cases: T[]): T[] {
  const kept = new Map<string, T>();
  for (const item of cases) {
    const key = calendarKey(item.source.url);
    const first = kept.get(key);
    if (!first) { kept.set(key, item); continue; }
    first.source.also = [...new Set([...(first.source.also ?? []), item.source.url])];
    const held = new Map(first.we_have.map(race => [sameRaceKey(race.name, race.date), race]));
    for (const race of item.we_have) held.set(sameRaceKey(race.name, race.date), race);
    first.we_have = [...held.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  return [...kept.values()];
}

export type FoundRace = { name: string; start_date: string; end_date: string | null; place: string | null; country?: string | null; discipline?: string | null; url: string; quote: string };

/**
 * Races the agent found, from one or several answers, as one lead each. A race found on two views of a
 * calendar keeps all its pages in `urls`; `url` is the one the lead is filed under, the same every time
 * (the shortest, then alphabetical), so a repeated find does not open a second lead.
 */
export function mergeFoundRaces<T extends FoundRace & { from?: string }>(found: T[]): (T & { urls: string[]; from_cases: string[] })[] {
  const merged = new Map<string, T & { urls: string[]; from_cases: string[] }>();
  for (const race of found) {
    const key = `${sameRaceKey(race.name, race.start_date)}|${(race.country ?? "").toUpperCase()}`;
    const first = merged.get(key);
    if (!first) { merged.set(key, { ...race, urls: [race.url], from_cases: race.from ? [race.from] : [] }); continue; }
    first.urls = [...new Set([...first.urls, race.url])];
    if (race.from && !first.from_cases.includes(race.from)) first.from_cases.push(race.from);
    // Facts one answer gave and the other did not are kept, never overwritten.
    first.place ??= race.place; first.end_date ??= race.end_date; first.discipline ??= race.discipline;
  }
  for (const race of merged.values()) {
    race.urls.sort((a, b) => a.length - b.length || a.localeCompare(b));
    const canonical = race.urls[0]!;
    if (canonical !== race.url) {
      // The quote must be the one found on the page the lead is filed under.
      const own = found.find(item => item.url === canonical && sameRaceKey(item.name, item.start_date) === sameRaceKey(race.name, race.start_date));
      race.url = canonical; if (own) race.quote = own.quote;
    }
  }
  return [...merged.values()];
}

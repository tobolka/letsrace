import { normalizeName } from "@/lib/domain";
import { parseCyclingAustria } from "@/lib/watcher/extractors/cyclingaustria";

/**
 * Races a calendar moved to another day, found by the calendar's own number.
 *
 * Some readers key a row as `<prefix>-<calendar id>-<date>` (Cycling Austria:
 * `oerv-<federation id>-<date>`). The date is in the key because one federation id
 * can cover two different races on consecutive days (35. KTM Kamptal Trophy,
 * Youngsters on 3 April, UCI XCO on 4 April 2027). The price is that a moved race
 * comes back under a new key: the next read creates a second race on the new day and
 * the old-day race stays public (Arlberg Giro Kriterium, Rund um den Liebfrauenberg,
 * Kirschblütenrennen Wels, all found on 16 Nov 2026).
 *
 * This decides, from one complete read of the calendar and the races holding its ids,
 * which old-day races are the same race as a new-day one. It writes nothing; the
 * caller merges through the normal merge routine. It merges only when all of this holds:
 *
 * - the read was complete, so an id missing from a date really is gone from it;
 * - the calendar lists the id, but no longer on any day the old race holds;
 * - the old day is still ahead (listings start at today, so a past day proves nothing,
 *   and an old edition must never fold into this year's), and the new day is in the same year;
 * - no listed day falls inside the old race's own span (a multi-day race listed by day);
 * - the old race's name is the name the calendar now shows on exactly one new day;
 * - exactly one public race holds the id on that new day and starts on it;
 * - the old race has no hand-locked fields (the merge refuses those anyway).
 *
 * Anything else is listed with the reason and left alone.
 */

export type ListedEntry = { id: string; date: string; name: string };

export type HeldRace = {
  eventId: string;
  name: string;
  startDate: string;
  endDate?: string | null;
  visibility: string;
  status?: string | null;
  lockedFields?: string[] | null;
  /** This race's source keys for the calendar, already split into id and date. */
  keys: { id: string; date: string }[];
};

export type DateMove = {
  id: string;
  oldDate: string;
  newDate: string;
  dropId: string;
  dropName: string;
  keepId: string;
  keepName: string;
};

export type HeldBack = {
  id: string;
  eventId: string;
  name: string;
  oldDate: string;
  reason:
    | "name_differs"
    | "several_new_days"
    | "new_day_not_in_catalogue"
    | "new_day_race_hidden"
    | "several_races_on_new_day"
    | "locked"
    | "other_season";
  detail?: string;
};

const DATED_KEY = /^(.+)-(\d{4}-\d{2}-\d{2})$/;

/** `oerv-12B0…-2027-06-19` → `{ id: "12B0…", date: "2027-06-19" }` for the given prefix and id shape. */
export function splitDatedKey(
  externalId: string | null | undefined,
  prefix: string,
  idShape: RegExp,
): { id: string; date: string } | null {
  if (!externalId?.startsWith(`${prefix}-`)) return null;
  const m = DATED_KEY.exec(externalId.slice(prefix.length + 1));
  if (!m || !idShape.test(m[1]!)) return null;
  return { id: m[1]!, date: m[2]! };
}

/** Cycling Austria rows keyed by the federation's own event number (a 32-digit hex id). */
export const OERV_ID = /^[A-F0-9]{16,}$/i;

const sameName = (a: string, b: string) => normalizeName(a) === normalizeName(b);

export function planDateMoves(
  listed: ListedEntry[],
  races: HeldRace[],
  today: string,
): { moves: DateMove[]; heldBack: HeldBack[] } {
  const listedById = new Map<string, ListedEntry[]>();
  for (const entry of listed) {
    const list = listedById.get(entry.id) ?? [];
    list.push(entry);
    listedById.set(entry.id, list);
  }

  const moves: DateMove[] = [];
  const heldBack: HeldBack[] = [];
  for (const [id, entries] of listedById) {
    const listedDays = new Set(entries.map((e) => e.date));
    const holding = races.filter((r) => r.keys.some((k) => k.id === id));
    for (const race of holding) {
      if (race.visibility !== "public") continue;
      const days = race.keys.filter((k) => k.id === id).map((k) => k.date);
      // Still listed on one of its days, or already showing a listed day: not stale.
      if (days.some((d) => listedDays.has(d)) || listedDays.has(race.startDate)) continue;
      const end = race.endDate && race.endDate > race.startDate ? race.endDate : race.startDate;
      if ([...listedDays].some((d) => d >= race.startDate && d <= end)) continue;
      const oldDate = race.startDate;
      // Today's race can drop off a listing that starts tomorrow; only a day still ahead proves a move.
      if (oldDate <= today) continue;
      const base = { id, eventId: race.eventId, name: race.name, oldDate };

      const newDays = [...new Set(entries.filter((e) => sameName(e.name, race.name)).map((e) => e.date))];
      if (newDays.length === 0) {
        heldBack.push({ ...base, reason: "name_differs", detail: entries.map((e) => `${e.date} ${e.name}`).join("; ") });
        continue;
      }
      if (newDays.length > 1) {
        heldBack.push({ ...base, reason: "several_new_days", detail: newDays.join(", ") });
        continue;
      }
      const newDate = newDays[0]!;
      if (newDate.slice(0, 4) !== oldDate.slice(0, 4)) {
        heldBack.push({ ...base, reason: "other_season", detail: newDate });
        continue;
      }
      const onNewDay = holding.filter(
        (r) => r.eventId !== race.eventId && r.startDate === newDate && r.keys.some((k) => k.id === id && k.date === newDate),
      );
      const publicOnNewDay = onNewDay.filter((r) => r.visibility === "public");
      if (!onNewDay.length) {
        heldBack.push({ ...base, reason: "new_day_not_in_catalogue", detail: newDate });
        continue;
      }
      if (!publicOnNewDay.length) {
        heldBack.push({ ...base, reason: "new_day_race_hidden", detail: `${newDate} ${onNewDay.map((r) => r.eventId).join(", ")}` });
        continue;
      }
      if (publicOnNewDay.length > 1) {
        heldBack.push({ ...base, reason: "several_races_on_new_day", detail: `${newDate} ${publicOnNewDay.map((r) => r.eventId).join(", ")}` });
        continue;
      }
      if (race.lockedFields?.length) {
        heldBack.push({ ...base, reason: "locked", detail: race.lockedFields.join(", ") });
        continue;
      }
      const keep = publicOnNewDay[0]!;
      moves.push({ id, oldDate, newDate, dropId: race.eventId, dropName: race.name, keepId: keep.eventId, keepName: keep.name });
    }
  }
  return { moves, heldBack };
}

export const OERV_CALENDAR = "https://www.cyclingaustria.at/kalender?view=events";

export type CalendarRead =
  | { complete: true; entries: ListedEntry[]; pages: number }
  | { complete: false; reason: string; pages: number };

/**
 * Every page of the federation's whole calendar (all disciplines, today onwards).
 *
 * Complete only when page 1 names the last page, every page up to it lists races,
 * and the page after it lists none. Anything less is not a full read: an id that
 * merely sat on a page we did not get must never look like a race that moved.
 */
export async function readOervCalendar(
  fetchHtml: (url: string) => Promise<{ status: number; html: string }>,
  maxPages = 30,
): Promise<CalendarRead> {
  const pageUrl = (n: number) => `${OERV_CALENDAR}&page=${n}`;
  const entries: ListedEntry[] = [];
  let last = 1;
  for (let n = 1; n <= last + 1; n++) {
    const got = await fetchHtml(pageUrl(n));
    if (got.status !== 200) return { complete: false, reason: `page ${n} answered ${got.status}`, pages: n - 1 };
    if (n === 1) {
      last = Math.max(1, ...[...got.html.matchAll(/[?&](?:amp;)?page=(\d+)/g)].map((m) => Number(m[1])));
      if (last > maxPages) return { complete: false, reason: `calendar claims ${last} pages`, pages: 0 };
    }
    const rows = (got.html.match(/data-date="20\d{2}-\d{2}-\d{2}/g) ?? []).length;
    if (n > last) {
      if (rows) return { complete: false, reason: `page ${n} after the last one still lists races`, pages: n - 1 };
      break;
    }
    if (!rows) return { complete: false, reason: `page ${n} lists no races`, pages: n - 1 };
    for (const ev of parseCyclingAustria(pageUrl(n), got.html)) {
      const key = splitDatedKey(ev.externalId, "oerv", OERV_ID);
      if (key) entries.push({ ...key, name: ev.name });
    }
  }
  return { complete: true, entries, pages: last };
}

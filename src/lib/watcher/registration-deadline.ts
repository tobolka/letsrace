/**
 * Entry deadlines from free text.
 *
 * "Can I still sign up?" is the question a race finder exists to answer, and
 * `events.registration_closes_at` was empty for all 1,540 upcoming races — the
 * column existed, nothing ever filled it. Race pages state the deadline in
 * prose, in six languages, so read it there rather than building a scraper per
 * entry platform.
 *
 * Deliberately conservative: a wrong deadline is worse than none, because a
 * rider who believes entries are open until Friday and finds them shut on
 * Wednesday blames the app, not the organiser. Only an explicit
 * deadline phrase followed closely by a full date counts.
 */
import * as cheerio from "cheerio";
import { fold } from "@/lib/text-match";

/**
 * Readable text only.
 *
 * `$("body").text()` includes inline scripts, and modern race sites ship a lot
 * of them — Sentry, Wix and DataTables bundles all contain the word "entries"
 * next to numbers, which is exactly the shape this parser looks for.
 */
export function visibleText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, template").remove();
  return $("body").text().replace(/\s+/g, " ");
}

/** Phrases that introduce a closing date, across the covered markets. */
const CLOSES_PHRASE = [
  // cs / sk
  "prihlasky do", "prihlaseni do", "registrace do", "uzaverka prihlasek",
  "uzaverka registraci", "prihlasovani do", "prihlaska do", "prihlasit do",
  "prihlasky koncia", "uzavierka prihlasok", "registracia do",
  // de
  "anmeldeschluss", "meldeschluss", "anmeldung bis", "nennschluss",
  "voranmeldung bis", "anmeldungen bis",
  // en
  "entries close", "entry deadline", "registration closes", "register by",
  "entries until", "registration deadline", "closing date",
  // it
  "iscrizioni entro", "chiusura iscrizioni", "termine iscrizioni",
  // pl
  "zapisy do", "rejestracja do", "zgloszenia do",
] as const;

/** Phrases that introduce an opening date. */
const OPENS_PHRASE = [
  "prihlasky od", "registrace od", "prihlasovani od", "registracia od",
  "anmeldung ab", "anmeldung startet", "entries open", "registration opens",
  "iscrizioni dal", "zapisy od",
] as const;

const MONTHS: Record<string, number> = {
  ledna: 1, unora: 2, brezna: 3, dubna: 4, kvetna: 5, cervna: 6, cervence: 7,
  srpna: 8, zari: 9, rijna: 10, listopadu: 11, prosince: 12,
  januar: 1, februar: 2, marz: 3, april: 4, mai: 5, juni: 6, juli: 7,
  august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
  january: 1, february: 2, march: 3, may: 5, june: 6, july: 7,
  october: 10, december: 12,
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, wrzesnia: 9, pazdziernika: 10, listopada: 11, grudnia: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/**
 * First date in `text`, in any of the formats these calendars use.
 * `fallbackYear` fills in "15. 9." style dates that omit the year.
 */
export function firstDateIn(text: string, fallbackYear: number): string | null {
  const numeric = text.match(/\b(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})\b/);
  if (numeric) {
    let y = Number(numeric[3]);
    if (y < 100) y += 2000;
    return iso(y, Number(numeric[2]), Number(numeric[1]));
  }
  const isoLike = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoLike) return iso(Number(isoLike[1]), Number(isoLike[2]), Number(isoLike[3]));

  const worded = text.match(/\b(\d{1,2})\.?\s*([a-z]{3,12})\.?\s*(20\d{2})?\b/);
  if (worded) {
    const m = MONTHS[worded[2]!];
    if (m) return iso(worded[3] ? Number(worded[3]) : fallbackYear, m, Number(worded[1]));
  }
  const dayless = text.match(/\b(\d{1,2})\s*[./]\s*(\d{1,2})\b/);
  if (dayless) return iso(fallbackYear, Number(dayless[2]), Number(dayless[1]));
  return null;
}

/** Range connectors — only trusted once an opening phrase has been located. */
const RANGE_CONNECTOR = [" do ", " bis ", " until ", " to ", " al ", " - "] as const;

function findAfterPhrase(
  text: string,
  phrases: readonly string[],
  fallbackYear: number,
): string | null {
  const t = fold(text).replace(/\s+/g, " ");
  for (const phrase of phrases) {
    let from = 0;
    for (;;) {
      const at = t.indexOf(phrase, from);
      if (at === -1) break;
      // Only look just past the phrase — a date further away belongs to
      // something else on the page.
      const window = t.slice(at + phrase.length, at + phrase.length + 40);
      const found = firstDateIn(window, fallbackYear);
      if (found) return found;
      from = at + phrase.length;
    }
  }
  return null;
}

export type RegistrationWindow = {
  opensAt: string | null;
  closesAt: string | null;
};

/**
 * Read the entry window off a race page.
 *
 * `startDate` anchors dates written without a year and rejects nonsense: a
 * deadline after the race, or more than a year before it, is a misread rather
 * than a fact worth publishing.
 */
export function parseRegistrationWindow(
  text: string,
  startDate: string,
): RegistrationWindow {
  const year = Number(startDate.slice(0, 4));
  if (!Number.isFinite(year)) return { opensAt: null, closesAt: null };

  const sane = (d: string | null): string | null => {
    if (!d) return null;
    if (d > startDate) return null;
    const earliest = new Date(Date.parse(`${startDate}T00:00:00Z`) - 400 * 864e5)
      .toISOString()
      .slice(0, 10);
    return d < earliest ? null : d;
  };

  const opensAt = sane(findAfterPhrase(text, OPENS_PHRASE, year));
  let closesAt = sane(findAfterPhrase(text, CLOSES_PHRASE, year));

  // "Přihlášky od 1.6. do 15.9." — the closing half has no phrase of its own,
  // only a connector. Trust a bare "do" once the opening half has anchored it.
  if (!closesAt && opensAt) {
    const t = fold(text).replace(/\s+/g, " ");
    const openAt = OPENS_PHRASE.map((p) => t.indexOf(p)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (openAt != null) {
      const tail = t.slice(openAt);
      for (const connector of RANGE_CONNECTOR) {
        const at = tail.indexOf(connector);
        if (at === -1) continue;
        const candidate = sane(firstDateIn(tail.slice(at + connector.length, at + connector.length + 40), year));
        if (candidate && candidate > opensAt) {
          closesAt = candidate;
          break;
        }
      }
    }
  }
  if (opensAt && closesAt && opensAt > closesAt) return { opensAt: null, closesAt };
  return { opensAt, closesAt };
}

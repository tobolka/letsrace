import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";

const ORIGIN = "https://turbo-sport.eu";

/**
 * BRV Timing runs the clock for Bavarian road racing, so its event list is the
 * only public register of those races — the federation's own calendar is behind
 * rad-net's member login.
 */
export function isTurboSportHost(host: string): boolean {
  return host.replace(/^www\./, "").endsWith("turbo-sport.eu");
}

/** Entries on the list that are the series page rather than a race. */
const NOT_A_RACE = /^\d{4}\s|serie$|^anmeldung/i;

export function parseTurboSport(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!/^\/(events|veranstaltungen)\//.test(href)) return;

    const label = $(el).text().replace(/\s+/g, " ").trim();
    const m = label.match(/^(\d{2})\.(\d{2})\.(\d{2})\s+(.+)$/);
    if (!m) return;

    const [, dd, mm, yy, rawName] = m;
    const name = rawName!.trim();
    if (name.length < 3 || NOT_A_RACE.test(name)) return;

    const slug = href.replace(/\/+$/, "").split("/").pop()!;
    const externalId = `turbosport-${slug}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const month = Number(mm);
    const day = Number(dd);
    if (month < 1 || month > 12 || day < 1 || day > 31) return;

    events.push({
      externalId,
      name: name.slice(0, 160),
      startDate: `20${yy}-${mm}-${dd}`,
      placeText: placeFrom(name, slug),
      countryHint: "DE",
      discipline: ["road"],
      audience: "mixed",
      sourceUrl: href.startsWith("http") ? href : new URL(href, ORIGIN).toString(),
      confidence: 0.75,
    });
  });

  return events;
}

/**
 * Neither the list nor the race page states a venue. Rather than guess a pin
 * into the wrong village, take a town only where the name says one outright —
 * everything else stays unplaced and shows in the list without a map pin.
 */
/** German race names open with an adjective as often as with a town. */
const NOT_A_PLACE = new Set([
  "groß", "klein", "offen", "intern", "national", "bayerisch", "deutsch",
  "erst", "zweit", "dritt", "letzt", "jährlich", "inklusiv", "gemeinsam",
]);

export function placeFrom(name: string, slug: string): string {
  const adjectival = name.match(/\b([A-ZÄÖÜ][a-zäöüß]{4,})er\s/);
  if (adjectival && !NOT_A_PLACE.has(adjectival[1]!.toLowerCase())) return adjectival[1]!;

  const plain = name.match(/\b(?:in|um|auf|bei)\s+([A-ZÄÖÜ][a-zäöüß]{3,})/);
  if (plain) return plain[1]!;

  const trailing = name.match(/\b(Stadtmeisterschaft|Rundstreckenrennen|Straßenpreis|Kriterium)\s+([A-ZÄÖÜ][a-zäöüß]{3,})\b/);
  if (trailing) return trailing[2]!;

  const fromSlug = slug.match(/^([a-zäöüß]{4,})$/);
  if (fromSlug) return capitalize(fromSlug[1]!);

  return "";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";

/**
 * The Czech cyclocross calendar, which was in the watchlist and producing
 * nothing.
 *
 * cyklokros.cz publishes the whole national season as one table: a date, a
 * town, and four columns — World Cup, UCI international, JANEV Cup youth,
 * everything else. Which column a name sits in is the only statement of how big
 * the race is, and it is the reason this is worth parsing rather than leaving
 * to the federation portal, whose own race pages carry no categories at all.
 *
 * A name repeated across two columns is one race with two audiences, not two
 * races: "JANEV Cup" appears under both UCI and youth on the same row because
 * the round runs both.
 */

const MONTHS: Record<string, number> = {
  leden: 1,
  únor: 2,
  unor: 2,
  březen: 3,
  brezen: 3,
  duben: 4,
  květen: 5,
  kveten: 5,
  červen: 6,
  cerven: 6,
  červenec: 7,
  cervenec: 7,
  srpen: 8,
  září: 9,
  zari: 9,
  říjen: 10,
  rijen: 10,
  listopad: 11,
  prosinec: 12,
};

/**
 * Which column a race sits in, and what that says about who rides it.
 *
 * The columns also state how big the race is — World Cup, UCI international,
 * national youth, everything else — but a parsed event carries no level field;
 * that is worked out downstream from the title and the class. The audience is
 * the part this table knows better than a name ever will.
 */
const COLUMNS = [
  { audience: "mixed" },
  { audience: "mixed" },
  { audience: "youth" },
  { audience: "mixed" },
] as const;

export function isCyklokrosHost(host: string): boolean {
  return host.replace(/^www\./, "").endsWith("cyklokros.cz");
}

function isoDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
}

export function parseCyklokrosCalendar(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("tr").each((_, tr) => {
    const cells = $(tr)
      .find("td, th")
      .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 6) return;

    const date = isoDate(cells[0] ?? "");
    if (!date) return;
    const place = (cells[1] ?? "").trim();
    if (!place) return;

    // The first column that names something wins; a repeat further along the
    // row is the same race in a second classification.
    let name = "";
    let audience: string = "mixed";
    let youth = false;
    for (let i = 0; i < COLUMNS.length; i++) {
      const value = (cells[2 + i] ?? "").trim();
      if (!value) continue;
      if (!name) {
        name = value;
        audience = COLUMNS[i]!.audience;
      }
      if (COLUMNS[i]!.audience === "youth") youth = true;
    }
    if (!name) return;
    // A round listed under youth as well as UCI is one race that both ride.
    if (youth) audience = "mixed";

    // "JANEV Cup" is four different Saturdays; the town is what tells them
    // apart, and it is what every other source calls them by.
    const title = name.toLowerCase().includes(place.toLowerCase())
      ? name
      : `${name} — ${place}`;

    const externalId = `cyklokros-${date}-${place.toLowerCase().replace(/\s+/g, "-")}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    events.push({
      externalId,
      name: title,
      startDate: date,
      placeText: place,
      countryHint: "CZ",
      discipline: ["cx"],
      audience: audience as ParsedEvent["audience"],
      sourceUrl: url,
      confidence: 0.8,
    });
  });

  return events;
}

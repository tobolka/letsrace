/**
 * PPKBIKE — Pohár Plzeňského kraje horských kol (ppkbike.cz, also ppk-hk.cz).
 *
 * The site has no list with years any more (`ppk-races.js` is gone). What it states:
 *  - the rules page lists the season's races, each with weekday, full date, place and name, and
 *    marks the partner races that do not count for the cup ("partnerský závod mimo bodování");
 *  - each race has a card (`inform.php&vybrzavodinfo=N`) with its venue, GPS, organiser, race
 *    director, contact, the organiser's web and the entry fees.
 * The N of a card is the race's number in the season, so a race keeps its identity
 * (`ppkbike-<year>-round-<N>`) from one reading to the next.
 */
import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { fetchText } from "@/lib/watcher/http";

export const PPK_SITE = "https://ppkbike.cz/";
export const PPK_RULES = "https://ppkbike.cz/?paldesignindex=data/pravidla.php";
const PPK_REGISTRATION = "https://hynekmusil.cz/resreg/?designindex=data/registry.php&seiresepyt=ppk";
const cardUrl = (n: number) => `https://ppkbike.cz/?paldesignindex=data/inform.php&vybrzavodinfo=${n}&englovnik=`;

const MONTHS: Record<string, number> = { ledna: 1, února: 2, března: 3, dubna: 4, května: 5, června: 6, července: 7, srpna: 8, září: 9, října: 10, listopadu: 11, prosince: 12 };
const WEEKDAYS = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];

export type PpkRace = { round: number; weekday: string; date: string; place: string; name: string; partner: boolean; line: string };

/** The season's races from the rules page, in the order the site numbers its cards. */
export function readPpkRules(html: string): PpkRace[] {
  const $ = cheerio.load(html);
  const list = $("p").filter((_, el) => /se skládá z/i.test($(el).text())).first().nextAll("div").first().find("ol > li");
  const races: PpkRace[] = [];
  list.each((index, li) => {
    const parts = ($(li).html() ?? "").split(/<br\s*\/?>/i).map(part => cheerio.load(`<div>${part}</div>`)("div").first().text().replace(/\s+/g, " ").trim()).filter(Boolean);
    const head = /^(\p{L}+)\s+(\d{1,2})\.\s*(\p{L}+)\s+(20\d{2})\s*[-–]\s*(.+)$/u.exec(parts[0] ?? "");
    const month = head ? MONTHS[head[3]!.toLowerCase()] : undefined;
    if (!head || !month) return;
    const date = `${head[4]}-${String(month).padStart(2, "0")}-${head[2]!.padStart(2, "0")}`;
    const rest = parts.slice(1).map(part => part.replace(/\s*\*+$/, "").trim());
    const partner = rest.some(part => /partnersk\p{L}* závod/iu.test(part) && /mimo bodov/i.test(part));
    races.push({ round: index + 1, weekday: head[1]!.toLowerCase(), date, place: head[5]!.trim(), name: rest.filter(part => !/^\(.*\)$/.test(part)).join(" – "), partner, line: $(li).text().replace(/\s+/g, " ").trim() });
  });
  return races;
}

/** "neděle 20. září 2027" when 20 September 2027 is a Monday: one of the two is wrong, and the page does not say which. */
export function weekdayMismatch(race: Pick<PpkRace, "weekday" | "date">): string | null {
  const actual = WEEKDAYS[new Date(`${race.date}T12:00:00Z`).getUTCDay()]!;
  return WEEKDAYS.includes(race.weekday) && race.weekday !== actual ? `weekday_mismatch: the page says ${race.weekday}, ${race.date} is ${actual}` : null;
}

export type PpkCard = { venue?: string; lat?: number; lng?: number; organizer?: string; director?: string; contact?: string; website?: string; fees: { label: string; amount: number; currency: "CZK" }[] };

/** "49°45'4.771''N" or "N 49°34.27400'": degrees with minutes and seconds, or with decimal minutes. Out-of-range parts are no position. */
export function readGps(text: string): { lat: number; lng: number } | null {
  const one = (value: string, hemisphere: "NS" | "EW") => {
    const m = new RegExp(`([${hemisphere}])?\\s*(\\d{1,3})°\\s*(\\d{1,2}(?:\\.\\d+)?)'\\s*(?:(\\d{1,2}(?:\\.\\d+)?)'')?\\s*([${hemisphere}])?`).exec(value);
    if (!m) return null;
    const minutes = Number(m[3]), seconds = m[4] ? Number(m[4]) : 0;
    if (minutes >= 60 || seconds >= 60 || m[4] && !Number.isInteger(minutes)) return null;
    const sign = /[SW]/.test(m[1] ?? m[5] ?? "") ? -1 : 1;
    return sign * (Number(m[2]) + minutes / 60 + seconds / 3600);
  };
  const [north, east] = text.split(",");
  const lat = north ? one(north, "NS") : null, lng = east ? one(east, "EW") : null;
  return lat !== null && lng !== null && lat > 47 && lat < 52 && lng > 11 && lng < 19.5 ? { lat: Number(lat.toFixed(7)), lng: Number(lng.toFixed(7)) } : null;
}

/** One race's card: what the organiser states about venue, people and fees. */
export function readPpkCard(html: string): PpkCard {
  const $ = cheerio.load(html);
  const cell = (label: RegExp) => {
    const row = $("tr").filter((_, tr) => label.test($(tr).find("td").first().text().trim())).first();
    return row.find("td").eq(1).text().replace(/\s+/g, " ").trim() || undefined;
  };
  const gps = readGps(cell(/^GPS/i) ?? "");
  const web = $("tr").filter((_, tr) => /^WEB pořadatele/i.test($(tr).find("td").first().text().trim())).find("a[href]").attr("href")?.trim();
  const fees: PpkCard["fees"] = [];
  $("tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length !== 2) return;
    const amount = /^(\d{2,4}),-\s*Kč$/.exec(cells.eq(1).text().replace(/\s+/g, " ").trim());
    if (amount) fees.push({ label: cells.eq(0).text().replace(/\s+/g, " ").trim(), amount: Number(amount[1]), currency: "CZK" });
  });
  return { venue: cell(/^Lokalita/i), ...(gps ?? {}), organizer: cell(/^Pořadatel/i), director: cell(/^Ředitel/i), contact: cell(/^Kontakt/i)?.replace(/\(zavináč\)/gi, "@"), website: web && /^https?:\/\//.test(web) ? web : undefined, fees };
}

/** "MEMORIÁL VÍTKA PŘEROSTA" as "Memoriál Vítka Přerosta"; abbreviations and words already in mixed case stay as written. */
export function readableName(name: string): string {
  let first = true;
  return name.split(/(\s+|[-–])/).map(token => {
    if (!/\p{L}/u.test(token)) return token;
    const wasFirst = first; first = false;
    if (token !== token.toUpperCase() || /^(?:MTB|MSBA|PLK|XCO|HK|PPK|PPKBIKE|MČR|ČP)$/.test(token)) return token;
    const lower = token.toLowerCase();
    if (!wasFirst && /^(?:a|i|u|v|na|do|od|pod|nad|za)$/.test(lower)) return lower;
    return lower[0]!.toUpperCase() + lower.slice(1);
  }).join("");
}

function disciplinesOf(name: string): Discipline[] {
  if (/časovk/i.test(name)) return ["mtb", "tt"];
  if (/do vrchu/i.test(name)) return ["mtb", "hill_climb"];
  if (/družstev/i.test(name)) return ["mtb"];
  return ["xco"];
}

/** The season's races with their cards read; `cards` maps a race's number to its card's HTML. */
export function ppkEvents(rulesHtml: string, cards: Map<number, string>): ParsedEvent[] {
  return readPpkRules(rulesHtml).map(race => {
    const card = cards.has(race.round) ? readPpkCard(cards.get(race.round)!) : null;
    // "VELKÁ CENA KLATOV - mistrovství PLK": the championship is a title the race carries, not its name.
    const name = readableName(race.name.split(" – ")[0]!.replace(/\s[-–]\s*mistrovstv\p{L}*\b.*$/iu, ""));
    const warning = weekdayMismatch(race);
    return {
      externalId: `ppkbike-${race.date.slice(0, 4)}-round-${race.round}`,
      name,
      startDate: race.date,
      placeText: card?.venue ?? race.place,
      countryHint: "CZ",
      discipline: disciplinesOf(race.line),
      audience: "mixed",
      eventType: "race",
      // A partner race is held beside the cup and does not count for it.
      ...(race.partner ? {} : { seriesName: "PPKBIKE", seriesSlug: "ppkbike", seriesWebsite: PPK_SITE }),
      sourceUrl: cardUrl(race.round),
      websiteUrl: cardUrl(race.round),
      registrationUrl: PPK_REGISTRATION,
      regulationsUrl: PPK_RULES,
      ...(card?.lat != null && card.lng != null ? { lat: card.lat, lng: card.lng } : {}),
      ...(warning ? { sourceWarnings: [warning] } : {}),
      evidence: { quote: race.line, sourceUrl: PPK_RULES, method: "adapter", version: "ppkbike-v2" },
      confidence: warning ? 0.75 : 0.9,
    } satisfies ParsedEvent;
  });
}

/** Reads the rules page and every card. Called for any ppkbike.cz or ppk-hk.cz address the cycle watches. */
export async function parsePpkBike(url: string, html: string): Promise<ParsedEvent[]> {
  // The old season file answers 404 now; the season is read once, from the site itself.
  if (/\/ppk-races\.js$/i.test(new URL(url).pathname)) return [];
  const rules = /se skládá z/i.test(html) ? html : (await fetchText(PPK_RULES, { timeoutMs: 15_000 })).text;
  if (!rules) return [];
  const races = readPpkRules(rules);
  const cards = new Map<number, string>();
  for (const race of races) {
    const page = /vybrzavodinfo=(\d+)/.exec(url)?.[1] === String(race.round) ? { ok: true, text: html } : await fetchText(cardUrl(race.round), { timeoutMs: 15_000 });
    if (page.ok && page.text) cards.set(race.round, page.text);
  }
  return ppkEvents(rules, cards);
}

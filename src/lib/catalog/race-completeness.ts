import { isAggregatorUrl, isCalendarPage, isDumpListingUrl } from "@/lib/watcher/public-url";
import { namesAnotherEdition, pageIsAbout, searchableName } from "@/lib/catalog/web-finder";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Known races are worked on until a rider has what they need. Calendars say a race exists; the
 * organiser's page and regulations say where to go, when to start and what it costs.
 */
export type RaceToComplete = { name: string; start_date: string; practical_details?: unknown; country?: string | null };

const FIELDS = ["organizer", "schedule", "fees", "categories"] as const;
const FIRST_COUNTRIES = new Set(["CZ", "SK"]);
const DAY = 86_400_000;

const missingFields = (details: unknown) => FIELDS.filter(field => !(details && typeof details === "object" && field in details)).length;
const daysUntil = (date: string, now: number) => (Date.parse(date) - now) / DAY;

/** Sooner races are worth looking at again sooner: that is when organisers publish. */
export function daysBeforeNextLook(race: RaceToComplete, failed: boolean, now = Date.now()): number {
  if (awaitingInstructions(race, now)) return 2;
  if (!missingFields(race.practical_details)) return 30;
  const days = daysUntil(race.start_date, now);
  if (failed || days <= 30) return 3;
  return days <= 90 ? 7 : 21;
}

/** Nearest first, Czechia and Slovakia ahead of the rest, the emptiest ahead of the nearly done. */
export function completionOrder(a: RaceToComplete, b: RaceToComplete, now = Date.now()): number {
  const band = (race: RaceToComplete) => {
    const soon = daysUntil(race.start_date, now) <= 60, first = FIRST_COUNTRIES.has(race.country ?? "");
    return soon ? (first ? 0 : 1) : first ? 2 : 3;
  };
  return band(a) - band(b) || a.start_date.localeCompare(b.start_date) || missingFields(b.practical_details) - missingFields(a.practical_details);
}

const REGULATIONS_WORD: Record<string, string> = { CZ: "propozice", SK: "propozície", DE: "Ausschreibung", AT: "Ausschreibung", CH: "Ausschreibung", PL: "regulamin", IT: "regolamento", FR: "règlement" };

export function regulationsQuery(race: { name: string; start_date: string; municipality?: string | null; country?: string | null }): string {
  const name = searchableName(race.name);
  const town = race.municipality && !name.toLowerCase().includes(race.municipality.toLowerCase()) ? ` ${race.municipality}` : "";
  return `${name}${town} ${race.start_date.slice(0, 4)} ${REGULATIONS_WORD[race.country ?? ""] ?? "regulations"}`;
}

/** Second try: a catalogue's name may not be the race's own ("TBC — Hůrka" is the Hůrecký krpál), but place and day are. */
export function placeAndDayQuery(race: { start_date: string; municipality?: string | null; discipline?: string | null; country?: string | null }): string | null {
  if (!race.municipality) return null;
  const [year, month, day] = race.start_date.split("-").map(Number) as [number, number, number];
  const word = race.discipline === "cx" ? "cyklokros" : race.discipline === "mtb" ? "MTB" : race.discipline === "gravel" ? "gravel" : ["CZ", "SK"].includes(race.country ?? "") ? "cyklistika závod" : "bike race";
  return `${race.municipality} ${word} ${day}.${month}.${year}`;
}

/** Search results worth opening: never calendars, entry listings or another year's page. */
export function usableHits(urls: string[], race: { name: string; start_date: string }, seen: Set<string>, max = 4): string[] {
  // For "Series — Town" the series' own front page is not this round's page.
  const words = distinctiveWords(race.name.split(/[—–]/).at(-1)!);
  // A site's front page is a race's page only when the site is named after it.
  const frontPageOfAnother = (url: string) => { try { const { hostname, pathname } = new URL(url); return !pathname.replace(/\/+$/, "") && !words.some(word => folded(hostname).includes(word)); } catch { return true; } };
  const listing = (url: string) => /\/(?:kalendar|kalendare|terminovka|termine|rozpis\/organizace)(?:\/|$)/i.test(url);
  return [...new Set(urls)].filter(url => !seen.has(url) && !frontPageOfAnother(url) && !listing(url) && !isDumpListingUrl(url) && !isCalendarPage(url) && !(isAggregatorUrl(url) && !/\.pdf(?:$|\?)/i.test(url)) && !namesAnotherEdition(url, race.name, race.start_date)).slice(0, max);
}

/** The text gives this race's day, written as people write dates here. */
export function statesRaceDay(text: string, startDate: string): boolean {
  const [year, month, day] = startDate.split("-").map(Number) as [number, number, number];
  const clean = text.replace(/\s+/g, " ");
  return new RegExp(`(?<![\\d.])0?${day}\\s*[./]\\s*0?${month}(?:\\s*[./]\\s*(?:20)?${String(year).slice(2)})?(?![\\d])`).test(clean) || clean.includes(startDate);
}

const folded = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const LOOSE_WORDS = new Set(["kolo", "kola", "zavod", "zavody", "race", "cup", "pohar", "tour", "cross", "cyklokros", "cyclocross", "mtb", "gravel", "gran", "fondo", "grand", "prix", "memorial", "mem", "edition", "rocnik", "kategorie", "serie", "series", "liga", "elite", "uci", "2026", "2027", "2028", "der", "von", "und", "the", "nad", "pod", "cyklistika"]);
/** Bicycle words that do not also mean a round of something, as "kolo" does in Czech and Slovak. */
const CYCLING = /cyklokros|cyclocross|cyclo-cross|querfeldein|cyklist|cyklomaraton|\bmtb\b|mountainbike|horsk[ey]ch? kol|gravel|silnicni|rennrad|radsport|radrennen|kolarsk|kolarstw|ciclis|cyclis|\bcx\b|\bbmx\b|\bxco\b|\bbike\b|cyklo/;
const OTHER_SPORT = /poker|casino|kasino|atletick|\bbeh\b.*\bm\b.*\bzeny\b|bezeck|lyzarsk|plaveck/;

/** The words that tell this race from others: its name without what every race is called. */
export function distinctiveWords(name: string): string[] {
  return [...new Set(folded(searchableName(name)).split(/[^a-z0-9]+/).filter(word => word.length >= 3 && !LOOSE_WORDS.has(word) && !/^\d+$/.test(word)))];
}

/**
 * Only a page that names this race, in this year, on this day may speak for it. Measured on the
 * nearest races: resemblance alone accepted a casino in Šamorín and other races of a series.
 */
export function documentIsAboutRace(text: string, race: { name: string; start_date: string; municipality?: string | null }): boolean {
  const t = folded(text).replace(/\s+/g, " ");
  // A page opening with another year's date is that event's, even if "next events" beside it names this race.
  const firstDate = /(?<!\d)\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*(20\d{2})(?!\d)/.exec(t.slice(0, 400));
  if (firstDate && firstDate[1] !== race.start_date.slice(0, 4) && !distinctiveWords(race.name.split(/[—–]/).at(-1)!).some(word => t.slice(0, firstDate.index).includes(word))) return false;
  if (!CYCLING.test(t) || OTHER_SPORT.test(t.slice(0, 3000)) && !/cyklokros|cyclocross|\bmtb\b/.test(t.slice(0, 1500))) return false;
  const place = race.municipality ? folded(race.municipality).split(/[^a-z0-9]+/).filter(word => word.length >= 3) : [];
  // Catalogues label rounds "Series — Town": the page may call the race something else, but then its place must be there, with the series.
  const label = /[—–]|^tbc\b/i.test(race.name) ? distinctiveWords(race.name.split(/[—–]/).at(-1)!) : [];
  let words = distinctiveWords(race.name);
  if (!words.length) return false;
  if (!words.every(word => t.includes(word))) {
    if (!label.length || !label.every(word => t.includes(word)) || !place.length || !place.every(word => t.includes(word))) return false;
    words = label;
  }
  if (!statesRaceDay(text, race.start_date) || !text.includes(race.start_date.slice(0, 4))) return false;
  if (!pageIsAbout(text, race.name, race.municipality ?? null, race.start_date) && words.length < 2 && !place.length) return false;
  // The day and the name belong together: a season's table or a news page lists many races and days.
  const [, month, day] = race.start_date.split("-").map(Number) as [number, number, number];
  const dated = new RegExp(`(?<![\\d.])0?${day}\\s*[./]\\s*0?${month}(?![\\d])`, "g");
  for (const match of t.matchAll(dated)) {
    const around = t.slice(Math.max(0, match.index - 700), match.index + 700);
    if (words.every(word => around.includes(word))) return true;
  }
  return false;
}

/** The results server regulations name: "Výsledky: www.maraton.cz". */
export function resultsLinkIn(text: string): string | null {
  const match = /(?:v[yý]sledky|results|ergebnisse|wyniki|risultati|classifiche)\s*[:\-–]?\s*(?:na\s+|auf\s+|on\s+|na stránce\s+)?((?:https?:\/\/|www\.)[^\s,;)]+)/i.exec(text);
  if (!match) return null;
  const url = match[1]!.replace(/[.]+$/, "");
  return url.startsWith("http") ? url : `https://${url}`;
}

/** A source page of this race that could carry details: a page of its own, not a site's front page or a calendar. */
export function ownSourcePages(urls: (string | null | undefined)[]): string[] {
  return [...new Set(urls.filter((url): url is string => {
    if (!url || isDumpListingUrl(url) || isCalendarPage(url) || isAggregatorUrl(url) || /\/(?:kalendar|kalendare|terminovka|termine)(?:\/|$)/i.test(url)) return false;
    try { return new URL(url).pathname.replace(/\/+$/, "").length > 3; } catch { return false; }
  }))];
}

/**
 * The race's regulations among what was read, wherever they were found. Without this a PDF reached
 * through the organiser's page gave its facts, but riders never got the link to it.
 */
export function regulationsAmong(documents: { url: string; text: string }[], race: { name: string; start_date: string; municipality?: string | null }): string | null {
  const file = /\.pdf(?:$|\?)|propoz|ausschreibung|regulamin|regolamento|reglement|règlement/i;
  const candidates = documents.filter(document => { try { return file.test(decodeURIComponent(document.url)); } catch { return file.test(document.url); } });
  return candidates.find(document => /\.pdf(?:$|\?)/i.test(document.url) && documentIsAboutRace(document.text, race))?.url ?? candidates.find(document => documentIsAboutRace(document.text, race))?.url ?? null;
}

const INSTRUCTIONS = /organiza[cč]n[ií][\s_-]*pokyn|pokyny[\s_-]*(?:pro|k[\s_-]*z[aá]vodu)|org[\s_-]*pokyn|\bpokyny\b|instrukcj|informator|organisationshinweis|teilnehmerinfo|wettkampfinfo|athlete[\s_-]*guide|rider[\s_-]*guide|race[\s_-]*guide|technical[\s_-]*guide|guida[\s_-]*tecnica/i;
const SERIES_RULES = /\/(?:pravidla|rules|regeln|reglement-serie)(?:\/|$|\.)|pravidla[\s_-]*(?:s[eé]rie|seri[aá]lu|poh[aá]ru)/i;
const decoded = (url: string) => { try { return decodeURIComponent(url); } catch { return url; } };

/** Which of the documents read are worth a link of their own. Organisers publish instructions days before a race, apart from the regulations. */
export function documentLinks(documents: { url: string; text: string }[], race: { name: string; start_date: string; municipality?: string | null; website_url?: string | null }): { kind: "regulations" | "instructions" | "series_rules"; url: string }[] {
  const out: { kind: "regulations" | "instructions" | "series_rules"; url: string }[] = [];
  const hostOf = (url: string | null | undefined) => { try { return new URL(url ?? "").hostname.replace(/^www\./, ""); } catch { return ""; } };
  const regulations = regulationsAmong(documents, race);
  for (const document of documents) {
    const name = `${decoded(document.url)} ${document.text.slice(0, 200)}`;
    if (SERIES_RULES.test(decoded(document.url))) { if (hostOf(document.url) === hostOf(race.website_url)) out.push({ kind: "series_rules", url: document.url }); continue; }
    if (INSTRUCTIONS.test(name) && documentIsAboutRace(document.text, race)) out.push({ kind: "instructions", url: document.url });
    else if (document.url === regulations) out.push({ kind: "regulations", url: document.url });
  }
  return out;
}

/** Instructions come late: until they are here, a race in its last two weeks is looked at every other day. */
export function awaitingInstructions(race: RaceToComplete, now = Date.now()): boolean {
  const days = daysUntil(race.start_date, now);
  const documents = (race.practical_details as { documents?: { value?: { kind?: string }[] } } | undefined)?.documents?.value ?? [];
  return days >= 0 && days <= 14 && !documents.some(document => document.kind === "instructions");
}

const HOMEPAGE = /^https?:\/\/[^/]+\/?$/i;

/** What a found page may replace: nothing, a homepage, or a calendar's stand-in. */
export function websiteMayBeReplaced(stored: string | null | undefined): boolean {
  return !stored || HOMEPAGE.test(stored) || isCalendarPage(stored) || isAggregatorUrl(stored);
}

/** Searches cost money per query, so the Mac keeps count across runs. Limits are per day and per month. */
export function takeSearch(path: string, limits: { day: number; month: number }, now = new Date()): boolean {
  let used: { days?: Record<string, number>; months?: Record<string, number> } = {};
  try { used = JSON.parse(readFileSync(path, "utf8")); } catch { /* first search */ }
  const day = now.toISOString().slice(0, 10), month = day.slice(0, 7);
  const days = used.days ?? {}, months = used.months ?? {};
  if ((days[day] ?? 0) >= limits.day || (months[month] ?? 0) >= limits.month) return false;
  days[day] = (days[day] ?? 0) + 1; months[month] = (months[month] ?? 0) + 1;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, JSON.stringify({ days, months }));
  renameSync(`${path}.tmp`, path);
  return true;
}

import { format, parseISO } from "date-fns";
import type { EventListItem } from "@/lib/events";
import type { Locale } from "@/lib/i18n/messages";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { ageCategoryLabel, disciplineLabel } from "@/lib/i18n/taxonomy";
import { countryDisplayName } from "@/lib/geo/europe";

/**
 * The words of a race page and the lists that link to races, per language.
 *
 * A race page used to say little more than its name and date, so a search
 * engine had nothing to match "cyklokros Plzeň přihlášky" or "Ausschreibung"
 * against. What we know about a race is written out here in sentences, in
 * the reader's language.
 */
export const raceCopy: Record<Locale, {
  about: string;
  classes: string;
  entry: string;
  entryCloses: string;
  entryClosed: string;
  regulations: string;
  website: string;
  results: string;
  otherRounds: string;
  sameWeekend: string;
  taken: string;
  pastRounds: string;
  home: string;
  upcoming: string;
  byCountry: string;
  series: string;
  allRaces: string;
  race: string;
  inPlace: string;
  /** "{name} is a {discipline} race in {place}, {country}, on {date}." */
  lead: string;
  leadNoPlace: string;
  partOf: string;
  forWhom: string;
  entryOnline: string;
  entryUntil: string;
  regsAvailable: string;
  noEntryKnown: string;
  /** Hub titles: what people type next to the discipline and country. */
  calendar: string;
  hubIntro: string;
  /** The browse section: countries, then disciplines, then series. */
  browse: string;
  browseIntro: string;
  disciplines: string;
  outsideSeries: string;
  outsideSeriesBody: string;
  rounds: string;
  nextRound: string;
}> = {
  en: {
    about: "About the race",
    classes: "Categories",
    entry: "Entry",
    entryCloses: "Online entry closes {date}",
    entryClosed: "Online entry closed {date}",
    regulations: "Regulations",
    website: "Race website",
    results: "Results",
    otherRounds: "Other rounds of {name}",
    sameWeekend: "Also that weekend nearby",
    taken: "This race has taken place.",
    pastRounds: "Already ridden",
    home: "Races",
    upcoming: "Upcoming races",
    byCountry: "Races by country",
    series: "Series",
    allRaces: "All races",
    race: "race",
    inPlace: "in {place}",
    lead: "{name} is a {discipline} held in {place}, {country}, on {date}.",
    leadNoPlace: "{name} is a {discipline} held on {date}.",
    partOf: "It is a round of {series}.",
    forWhom: "Categories: {classes}.",
    entryOnline: "Entries are taken online.",
    entryUntil: "Online entry closes {date}.",
    regsAvailable: "The regulations are published by the organiser.",
    noEntryKnown: "We have not found an online entry for it yet; check with the organiser.",
    calendar: "race calendar {season}",
    hubIntro: "{count} races in the next twelve months, with dates, venues, categories and links to entry and regulations. Updated every day from the organisers' and federations' calendars.",
    browse: "Browse races",
    browseIntro: "Pick a country, then a discipline and a series — every race with its date, place, categories and entry.",
    disciplines: "Disciplines",
    outsideSeries: "Outside a series",
    outsideSeriesBody: "{count} races that are not a round of any series",
    rounds: "{count} rounds",
    nextRound: "next {date}",
  },
  cs: {
    about: "O závodě",
    classes: "Kategorie",
    entry: "Přihlášky",
    entryCloses: "Online přihlášky do {date}",
    entryClosed: "Online přihlášky skončily {date}",
    regulations: "Propozice",
    website: "Web závodu",
    results: "Výsledky",
    otherRounds: "Další kola – {name}",
    sameWeekend: "Ten víkend v okolí",
    taken: "Tento závod už proběhl.",
    pastRounds: "Už odjeté",
    home: "Závody",
    upcoming: "Nadcházející závody",
    byCountry: "Závody podle zemí",
    series: "Seriály",
    allRaces: "Všechny závody",
    race: "závod",
    inPlace: "v místě {place}",
    lead: "{name} je {discipline} – termín {date}, místo {place} ({country}).",
    leadNoPlace: "{name} je {discipline} – termín {date}.",
    partOf: "Je to kolo seriálu {series}.",
    forWhom: "Kategorie: {classes}.",
    entryOnline: "Přihlásit se dá online.",
    entryUntil: "Online přihlášky končí {date}.",
    regsAvailable: "Pořadatel zveřejnil propozice.",
    noEntryKnown: "Online přihlášky jsme zatím nenašli, ověř si je u pořadatele.",
    calendar: "kalendář závodů {season}",
    hubIntro: "{count} závodů na příštích dvanáct měsíců – termíny, místa, kategorie a odkazy na přihlášky a propozice. Aktualizujeme denně z kalendářů pořadatelů a svazů.",
    browse: "Procházet závody",
    browseIntro: "Vyber zemi, pak disciplínu a seriál – u každého závodu termín, místo, kategorie a přihlášky.",
    disciplines: "Disciplíny",
    outsideSeries: "Mimo seriál",
    outsideSeriesBody: "{count} závodů, které nepatří do žádného seriálu",
    rounds: "{count} kol",
    nextRound: "další {date}",
  },
  pl: {
    about: "O wyścigu",
    classes: "Kategorie",
    entry: "Zapisy",
    entryCloses: "Zapisy online do {date}",
    entryClosed: "Zapisy online zakończone {date}",
    regulations: "Regulamin",
    website: "Strona wyścigu",
    results: "Wyniki",
    otherRounds: "Inne rundy – {name}",
    sameWeekend: "W ten weekend w pobliżu",
    taken: "Ten wyścig już się odbył.",
    pastRounds: "Już rozegrane",
    home: "Wyścigi",
    upcoming: "Nadchodzące wyścigi",
    byCountry: "Wyścigi według krajów",
    series: "Cykle",
    allRaces: "Wszystkie wyścigi",
    race: "wyścig",
    inPlace: "w miejscowości {place}",
    lead: "{name} to {discipline} – termin {date}, miejsce {place} ({country}).",
    leadNoPlace: "{name} to {discipline} – termin {date}.",
    partOf: "To runda cyklu {series}.",
    forWhom: "Kategorie: {classes}.",
    entryOnline: "Zapisy przyjmowane są online.",
    entryUntil: "Zapisy online trwają do {date}.",
    regsAvailable: "Organizator opublikował regulamin.",
    noEntryKnown: "Nie znaleźliśmy jeszcze zapisów online – sprawdź u organizatora.",
    calendar: "kalendarz wyścigów {season}",
    hubIntro: "{count} wyścigów w najbliższych dwunastu miesiącach – terminy, miejsca, kategorie oraz linki do zapisów i regulaminów. Aktualizowane codziennie z kalendarzy organizatorów i związków.",
    browse: "Przeglądaj wyścigi",
    browseIntro: "Wybierz kraj, potem dyscyplinę i cykl – przy każdym wyścigu termin, miejsce, kategorie i zapisy.",
    disciplines: "Dyscypliny",
    outsideSeries: "Poza cyklem",
    outsideSeriesBody: "{count} wyścigów, które nie należą do żadnego cyklu",
    rounds: "{count} rund",
    nextRound: "następna {date}",
  },
  sk: {
    about: "O preteku",
    classes: "Kategórie",
    entry: "Prihlášky",
    entryCloses: "Online prihlášky do {date}",
    entryClosed: "Online prihlášky skončili {date}",
    regulations: "Propozície",
    website: "Web preteku",
    results: "Výsledky",
    otherRounds: "Ďalšie kolá – {name}",
    sameWeekend: "V ten víkend v okolí",
    taken: "Tento pretek sa už konal.",
    pastRounds: "Už odjazdené",
    home: "Preteky",
    upcoming: "Nadchádzajúce preteky",
    byCountry: "Preteky podľa krajín",
    series: "Seriály",
    allRaces: "Všetky preteky",
    race: "pretek",
    inPlace: "v obci {place}",
    lead: "{name} je {discipline} – termín {date}, miesto {place} ({country}).",
    leadNoPlace: "{name} je {discipline} – termín {date}.",
    partOf: "Je to kolo seriálu {series}.",
    forWhom: "Kategórie: {classes}.",
    entryOnline: "Prihlásiť sa dá online.",
    entryUntil: "Online prihlášky končia {date}.",
    regsAvailable: "Organizátor zverejnil propozície.",
    noEntryKnown: "Online prihlášky sme zatiaľ nenašli, over si ich u organizátora.",
    calendar: "kalendár pretekov {season}",
    hubIntro: "{count} pretekov na najbližších dvanásť mesiacov – termíny, miesta, kategórie a odkazy na prihlášky a propozície. Aktualizujeme denne z kalendárov organizátorov a zväzov.",
    browse: "Prehľadávať preteky",
    browseIntro: "Vyber krajinu, potom disciplínu a seriál – pri každom preteku termín, miesto, kategórie a prihlášky.",
    disciplines: "Disciplíny",
    outsideSeries: "Mimo seriálu",
    outsideSeriesBody: "{count} pretekov, ktoré nepatria do žiadneho seriálu",
    rounds: "{count} kôl",
    nextRound: "ďalšie {date}",
  },
};

/** The kind of race in a sentence: "cyclocross race", "závod v cyklokrosu"… */
const KIND: Record<Locale, (discipline: string | null) => string> = {
  en: (d) => (d ? `${lower(d)} race` : "cycling race"),
  cs: (d) => (d ? `závod v disciplíně ${lower(d)}` : "cyklistický závod"),
  pl: (d) => (d ? `wyścig w dyscyplinie ${lower(d)}` : "wyścig kolarski"),
  sk: (d) => (d ? `pretek v disciplíne ${lower(d)}` : "cyklistický pretek"),
};

/** "Cyklokros" → "cyklokros", but "MTB" and "XCO" stay as they are written. */
function lower(word: string): string {
  return /^\p{Lu}\p{Ll}/u.test(word) ? word.charAt(0).toLowerCase() + word.slice(1) : word;
}

export function fill(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

export function longDate(iso: string, locale: Locale): string {
  return format(parseISO(iso), locale === "en" ? "d MMMM yyyy" : "d. MMMM yyyy", { locale: dateFnsLocale(locale) });
}

export function shortDate(iso: string, locale: Locale): string {
  return format(parseISO(iso), locale === "en" ? "d MMM yyyy" : "d. M. yyyy", { locale: dateFnsLocale(locale) });
}

export function monthHeading(iso: string, locale: Locale): string {
  const label = format(parseISO(iso), "LLLL yyyy", { locale: dateFnsLocale(locale) });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function placeOf(event: EventListItem): string | null {
  return event.location?.municipality || event.location?.name || null;
}

/** The race's disciplines in words, the first one leading. */
export function disciplineWords(event: EventListItem, locale: Locale): string | null {
  const words = event.disciplines.map((d) => disciplineLabel(d, locale)).filter(Boolean);
  return words.length ? words.slice(0, 2).join(", ") : null;
}

/**
 * A short written account of the race from what we hold: kind, place, date,
 * series, classes, entry. Every sentence is a fact we have; none is padding.
 */
export function raceSummary(event: EventListItem & { registrationClosesAt?: string | null }, locale: Locale): string[] {
  const c = raceCopy[locale];
  const place = placeOf(event);
  const country = event.location?.countryCode ? countryDisplayName(event.location.countryCode, locale) : "";
  const kind = KIND[locale](disciplineWords(event, locale)?.split(", ")[0] ?? null);
  const date = longDate(event.startDate, locale) + (event.endDate && event.endDate !== event.startDate ? ` – ${longDate(event.endDate, locale)}` : "");
  const out = [place ? fill(c.lead, { name: event.name, discipline: kind, place, country, date }) : fill(c.leadNoPlace, { name: event.name, discipline: kind, date })];
  if (event.series) out.push(fill(c.partOf, { series: event.series.name }));
  if (event.ageConfidence === "explicit" && event.ageCategories.length) {
    out.push(fill(c.forWhom, { classes: event.ageCategories.map((a) => ageCategoryLabel(a, locale)).join(", ") }));
  }
  if (event.registrationUrl) {
    out.push(event.registrationClosesAt && event.registrationClosesAt.slice(0, 10) >= new Date().toISOString().slice(0, 10)
      ? fill(c.entryUntil, { date: longDate(event.registrationClosesAt.slice(0, 10), locale) })
      : c.entryOnline);
  } else if (event.startDate >= new Date().toISOString().slice(0, 10)) {
    out.push(c.noEntryKnown);
  }
  if (event.regulationsUrl) out.push(c.regsAvailable);
  return out;
}

/** Title for search: name, kind and place, the year once. */
export function raceTitle(event: EventListItem, locale: Locale): string {
  const year = event.startDate.slice(0, 4);
  const name = event.name.includes(year) ? event.name : `${event.name} ${year}`;
  const disc = disciplineWords(event, locale)?.split(",")[0];
  const place = placeOf(event);
  const bits = [name, [disc, place && !name.toLowerCase().includes(place.toLowerCase()) ? place : null].filter(Boolean).join(" · ")].filter(Boolean);
  return bits.join(" – ");
}

/** Description for search: the date, place and what you can do from here. */
export function raceDescription(event: EventListItem & { registrationClosesAt?: string | null }, locale: Locale): string {
  const c = raceCopy[locale];
  const place = placeOf(event);
  const parts = [shortDate(event.startDate, locale), place, disciplineWords(event, locale)].filter(Boolean).join(" · ");
  const extras = [
    event.ageConfidence === "explicit" && event.ageCategories.length ? `${c.classes}: ${event.ageCategories.map((a) => ageCategoryLabel(a, locale)).join(", ")}` : null,
    event.registrationUrl ? c.entry : null,
    event.regulationsUrl ? c.regulations : null,
  ].filter(Boolean);
  return [parts, extras.join(", ")].filter(Boolean).join(". ") + ".";
}

/** The season a calendar covers: "2026", or "2026/27" from September on. */
export function seasonLabel(now = new Date()): string {
  const y = now.getUTCFullYear();
  return now.getUTCMonth() >= 8 ? `${y}/${String(y + 1).slice(2)}` : String(y);
}

export function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The series running in a set of races, most rounds first. */
export function seriesIn(events: EventListItem[]): { slug: string; name: string; rounds: number }[] {
  const by = new Map<string, { slug: string; name: string; rounds: number }>();
  for (const e of events) {
    if (!e.series) continue;
    const s = by.get(e.series.slug) ?? { slug: e.series.slug, name: e.series.name, rounds: 0 };
    s.rounds += 1;
    by.set(e.series.slug, s);
  }
  return [...by.values()].sort((a, b) => b.rounds - a.rounds || a.name.localeCompare(b.name));
}

/** A country's flag from its two letters, as the regional-indicator emoji pair. */
export function flagEmoji(code: string): string {
  return code.toUpperCase().replace(/[A-Z]/g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}

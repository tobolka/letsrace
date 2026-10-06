import { format, parseISO } from "date-fns";
import type { EventListItem } from "@/lib/events";
import type { Locale } from "@/lib/i18n/messages";
import { dateFnsLocale } from "@/lib/i18n/dates";
import { ageCategoryLabel } from "@/lib/i18n/taxonomy";
import { DISCIPLINE_LABELS, type Discipline } from "@/lib/taxonomy";
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
  /** Hub titles end in it: what people type after the discipline and country. */
  calendar: string;
  /** The browse index's title and description in search. */
  browseTitle: string;
  browseDescription: string;
  hubIntro: string;
  /** The browse section: countries, then disciplines, then series. */
  browse: string;
  browseIntro: string;
  disciplines: string;
  outsideSeries: string;
  outsideSeriesBody: string;
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
    calendar: "race calendar",
    browseTitle: "Cycling races by country and discipline",
    browseDescription: "Race calendars for Czechia, Slovakia, Poland, Germany, Austria, Switzerland and Italy: road, MTB, gravel, cyclocross, track and BMX, with entry links.",
    hubIntro: "{count} races in the next twelve months, with dates, venues, categories and links to entry and regulations. Updated every day from the organisers' and federations' calendars.",
    browse: "Browse races",
    browseIntro: "Pick a country, then a discipline and a series — every race with its date, place, categories and entry.",
    disciplines: "Disciplines",
    outsideSeries: "Outside a series",
    outsideSeriesBody: "{count} races that are not a round of any series",
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
    calendar: "kalendář",
    browseTitle: "Cyklistické závody podle zemí a disciplín",
    browseDescription: "Kalendáře závodů v Česku, na Slovensku, v Polsku, Německu, Rakousku, Švýcarsku a Itálii: silnice, MTB, gravel, cyklokros, dráha i BMX, s přihláškami.",
    hubIntro: "{count} závodů na příštích dvanáct měsíců – termíny, místa, kategorie a odkazy na přihlášky a propozice. Aktualizujeme denně z kalendářů pořadatelů a svazů.",
    browse: "Procházet závody",
    browseIntro: "Vyber zemi, pak disciplínu a seriál – u každého závodu termín, místo, kategorie a přihlášky.",
    disciplines: "Disciplíny",
    outsideSeries: "Mimo seriál",
    outsideSeriesBody: "{count} závodů, které nepatří do žádného seriálu",
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
    calendar: "kalendarz",
    browseTitle: "Wyścigi kolarskie według krajów i dyscyplin",
    browseDescription: "Kalendarze wyścigów w Polsce, Czechach, na Słowacji, w Niemczech, Austrii, Szwajcarii i we Włoszech: szosa, MTB, gravel, przełaje, tor i BMX, z zapisami.",
    hubIntro: "{count} wyścigów w najbliższych dwunastu miesiącach – terminy, miejsca, kategorie oraz linki do zapisów i regulaminów. Aktualizowane codziennie z kalendarzy organizatorów i związków.",
    browse: "Przeglądaj wyścigi",
    browseIntro: "Wybierz kraj, potem dyscyplinę i cykl – przy każdym wyścigu termin, miejsce, kategorie i zapisy.",
    disciplines: "Dyscypliny",
    outsideSeries: "Poza cyklem",
    outsideSeriesBody: "{count} wyścigów, które nie należą do żadnego cyklu",
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
    calendar: "kalendár",
    browseTitle: "Cyklistické preteky podľa krajín a disciplín",
    browseDescription: "Kalendáre pretekov na Slovensku, v Česku, Poľsku, Nemecku, Rakúsku, Švajčiarsku a Taliansku: cesta, MTB, gravel, cyklokros, dráha aj BMX, s prihláškami.",
    hubIntro: "{count} pretekov na najbližších dvanásť mesiacov – termíny, miesta, kategórie a odkazy na prihlášky a propozície. Aktualizujeme denne z kalendárov organizátorov a zväzov.",
    browse: "Prehľadávať preteky",
    browseIntro: "Vyber krajinu, potom disciplínu a seriál – pri každom preteku termín, miesto, kategórie a prihlášky.",
    disciplines: "Disciplíny",
    outsideSeries: "Mimo seriálu",
    outsideSeriesBody: "{count} pretekov, ktoré nepatria do žiadneho seriálu",
    nextRound: "ďalšie {date}",
  },
  de: {
    about: "Über das Rennen",
    classes: "Klassen",
    entry: "Anmeldung",
    entryCloses: "Online-Anmeldung bis {date}",
    entryClosed: "Online-Anmeldung endete am {date}",
    regulations: "Ausschreibung",
    website: "Website des Rennens",
    results: "Ergebnisse",
    otherRounds: "Weitere Läufe – {name}",
    sameWeekend: "Am selben Wochenende in der Nähe",
    taken: "Dieses Rennen hat bereits stattgefunden.",
    pastRounds: "Bereits gefahren",
    home: "Rennen",
    upcoming: "Kommende Rennen",
    byCountry: "Rennen nach Ländern",
    series: "Serien",
    allRaces: "Alle Rennen",
    race: "Rennen",
    inPlace: "in {place}",
    lead: "{name} ist ein {discipline} – Termin {date}, Ort {place} ({country}).",
    leadNoPlace: "{name} ist ein {discipline} – Termin {date}.",
    partOf: "Es ist ein Lauf der Serie {series}.",
    forWhom: "Klassen: {classes}.",
    entryOnline: "Die Anmeldung läuft online.",
    entryUntil: "Online-Anmeldung bis {date}.",
    regsAvailable: "Der Veranstalter hat die Ausschreibung veröffentlicht.",
    noEntryKnown: "Eine Online-Anmeldung haben wir noch nicht gefunden – frag beim Veranstalter nach.",
    calendar: "Termine",
    browseTitle: "Radrennen nach Ländern und Disziplinen",
    browseDescription: "Rennkalender für Deutschland, Österreich, die Schweiz, Italien, Tschechien, die Slowakei und Polen: Straße, MTB, Gravel, Cyclocross, Bahn und BMX.",
    hubIntro: "{count} Rennen in den nächsten zwölf Monaten – Termine, Orte, Klassen und Links zu Anmeldung und Ausschreibung. Täglich aktualisiert aus den Kalendern der Veranstalter und Verbände.",
    browse: "Rennen durchsuchen",
    browseIntro: "Wähle ein Land, dann Disziplin und Serie – bei jedem Rennen Termin, Ort, Klassen und Anmeldung.",
    disciplines: "Disziplinen",
    outsideSeries: "Ohne Serie",
    outsideSeriesBody: "{count} Rennen, die zu keiner Serie gehören",
    nextRound: "nächster {date}",
  },
};

/**
 * The kind of race as a rider names it: "MTB závod", "Straßenrennen",
 * "wyścig przełajowy". It used to be the bare taxonomy label — a Czech race
 * page titled "… – Silnice" and described itself as a "závod v disciplíně
 * silnice", which is not how anyone says or searches it.
 */
const KIND: Record<Locale, Partial<Record<Discipline, string>> & { other: string }> = {
  en: {
    road: "road race", road_race: "road race", tt: "time trial", criterium: "criterium", hill_climb: "hill climb",
    gran_fondo: "gran fondo", gravel: "gravel race", mtb: "MTB race", xco: "MTB race", xcc: "MTB race",
    xce: "MTB race", xcm: "MTB marathon", dh: "downhill race", enduro: "enduro race", cx: "cyclocross race",
    track: "track race", bmx: "BMX race", other: "cycling race",
  },
  cs: {
    road: "silniční závod", road_race: "silniční závod", tt: "časovka", criterium: "kritérium", hill_climb: "závod do vrchu",
    gran_fondo: "gran fondo", gravel: "gravel závod", mtb: "MTB závod", xco: "MTB závod", xcc: "MTB závod",
    xce: "MTB závod", xcm: "MTB maraton", dh: "závod ve sjezdu", enduro: "enduro závod", cx: "cyklokrosový závod",
    track: "dráhový závod", bmx: "BMX závod", other: "cyklistický závod",
  },
  sk: {
    road: "cestný pretek", road_race: "cestný pretek", tt: "časovka", criterium: "kritérium", hill_climb: "pretek do vrchu",
    gran_fondo: "gran fondo", gravel: "gravel pretek", mtb: "MTB pretek", xco: "MTB pretek", xcc: "MTB pretek",
    xce: "MTB pretek", xcm: "MTB maratón", dh: "pretek v zjazde", enduro: "enduro pretek", cx: "cyklokrosový pretek",
    track: "dráhový pretek", bmx: "BMX pretek", other: "cyklistický pretek",
  },
  pl: {
    road: "wyścig szosowy", road_race: "wyścig szosowy", tt: "jazda na czas", criterium: "kryterium", hill_climb: "wyścig pod górę",
    gran_fondo: "gran fondo", gravel: "wyścig gravelowy", mtb: "wyścig MTB", xco: "wyścig MTB", xcc: "wyścig MTB",
    xce: "wyścig MTB", xcm: "maraton MTB", dh: "wyścig zjazdowy", enduro: "zawody enduro", cx: "wyścig przełajowy",
    track: "wyścig torowy", bmx: "wyścig BMX", other: "wyścig kolarski",
  },
  // German nouns keep their capital, and every one of them takes "ein".
  de: {
    road: "Straßenrennen", road_race: "Straßenrennen", tt: "Zeitfahren", criterium: "Kriterium", hill_climb: "Bergrennen",
    gran_fondo: "Jedermannrennen", gravel: "Gravel-Rennen", mtb: "MTB-Rennen", xco: "MTB-Rennen", xcc: "MTB-Rennen",
    xce: "MTB-Rennen", xcm: "MTB-Marathon", dh: "Downhill-Rennen", enduro: "Enduro-Rennen", cx: "Cyclocross-Rennen",
    track: "Bahnrennen", bmx: "BMX-Rennen", other: "Radrennen",
  },
};

/** Lowercase, without accents — for asking whether a name already says a word. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * The discipline a race is filed under first — unless its name says another
 * of its disciplines: "Spoletonorcia Gravel", listed as MTB and gravel, is a
 * gravel race.
 */
function leadDiscipline(event: EventListItem): string | null {
  const name = fold(event.name);
  const named = event.disciplines.find((d) => {
    const word = fold(DISCIPLINE_LABELS[d as Discipline] ?? d);
    return word.length >= 3 && name.includes(word);
  });
  return named ?? event.disciplines[0] ?? null;
}

/** "MTB závod", "Straßenrennen" — lowercase except where the language says not. */
export function raceKind(event: EventListItem, locale: Locale): string {
  const kinds = KIND[locale];
  const lead = leadDiscipline(event);
  return (lead && kinds[lead as Discipline]) || kinds.other;
}

/** True when the race's own name already says what kind of race it is. */
function nameSaysKind(name: string, kind: string): boolean {
  const generic = new Set(["zavod", "pretek", "race", "rennen", "wyscig", "zawody"]);
  const words = fold(kind).split(/[\s-]+/).filter((w) => w.length >= 3 && !generic.has(w));
  if (!words.length) return false;
  const folded = fold(name);
  // "cyklokrosový" is said by "Cyklokros Chýnov": compare the stem.
  return words.every((w) => folded.includes(w.length > 6 ? w.slice(0, -3) : w));
}

const SMALL_WORDS = new Set([
  "a", "al", "alla", "am", "an", "and", "auf", "da", "das", "de", "dei", "del", "della", "der", "di", "die", "do",
  "e", "ed", "for", "i", "il", "im", "in", "la", "le", "na", "o", "of", "per", "po", "pod", "s", "the", "to", "u",
  "um", "und", "v", "ve", "von", "w", "we", "z", "ze",
]);

/**
 * A name typed in capitals, written the way a title is: "CICLOCROSS DEL LAGO"
 * → "Ciclocross del Lago". Search shows a shouted title as shouting, or
 * rewrites it. Short capitals are kept, because they are mostly initials (UCI,
 * XCO, MTB, GP); a name already in mixed case is left as its organiser wrote it.
 */
export function unshout(name: string): string {
  const letters = name.replace(/[^\p{L}]/gu, "");
  if (letters.length < 8) return name;
  const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
  if (upper / letters.length < 0.8) return name;
  let first = true;
  return name.replace(/\p{L}[\p{L}'’]*/gu, (word) => {
    const lowerWord = word.toLowerCase();
    const isFirst = first;
    first = false;
    if (SMALL_WORDS.has(lowerWord)) return isFirst ? word.charAt(0) + lowerWord.slice(1) : lowerWord;
    if (word.length <= 3) return word;
    return word.charAt(0) + word.slice(1).toLowerCase();
  });
}

/**
 * Where a race starts, as a place name. A venue with no town of its own often
 * reads "Sporthalle Schule, Haid" — the town is the last part.
 */
function placeOf(event: EventListItem): string | null {
  // The town field itself sometimes holds the venue too ("Sportheim, Lupburg").
  const value = (event.location?.municipality || event.location?.name || "").trim();
  if (!value) return null;
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

/** A place a title should not repeat: every word of it is in the race's name already. */
function nameSaysPlace(name: string, place: string): boolean {
  const folded = fold(name);
  return fold(place).split(/[\s,-]+/).filter((w) => w.length >= 2).every((w) => folded.includes(w));
}

/** Trim a very long name at a natural break, and at a word if there is none. */
function shortName(name: string, max: number): string {
  if (name.length <= max) return name;
  // Punctuation first, then a joining word: "15. Piko-Bike Maraton 2026 a 5. kolo…".
  for (const sep of [" – ", " — ", " - ", " / ", ": ", " \"", " („", " (", " a ", " und ", " e ", " i ", " and "]) {
    const at = name.indexOf(sep);
    if (at >= 15 && at <= max) return name.slice(0, at).trim();
  }
  const cut = name.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return (space > 20 ? cut.slice(0, space) : cut.slice(0, max)).replace(/[\s,;:–—-]+$/, "");
}

export function fill(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

export function longDate(iso: string, locale: Locale): string {
  return format(parseISO(iso), locale === "en" || locale === "pl" ? "d MMMM yyyy" : "d. MMMM yyyy", { locale: dateFnsLocale(locale) });
}

export function shortDate(iso: string, locale: Locale): string {
  return format(parseISO(iso), locale === "en" ? "d MMM yyyy" : locale === "de" ? "d.M.yyyy" : locale === "pl" ? "dd.MM.yyyy" : "d. M. yyyy", { locale: dateFnsLocale(locale) });
}

export function monthHeading(iso: string, locale: Locale): string {
  const label = format(parseISO(iso), "LLLL yyyy", { locale: dateFnsLocale(locale) });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * A short written account of the race from what we hold: kind, place, date,
 * series, classes, entry. Every sentence is a fact we have; none is padding.
 */
export function raceSummary(event: EventListItem & { registrationClosesAt?: string | null }, locale: Locale): string[] {
  const c = raceCopy[locale];
  const place = placeOf(event);
  const country = event.location?.countryCode ? countryDisplayName(event.location.countryCode, locale) : "";
  const kind = raceKind(event, locale);
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

/** The search snippet's words for a race, per language. */
const SNIPPET: Record<Locale, {
  /** "{kind} {when} in {place}, {country}." */
  lead: string;
  leadNoPlace: string;
  on: string;
  range: string;
  series: string;
  closer: string;
}> = {
  en: {
    lead: "{kind} {when} in {place}, {country}.",
    leadNoPlace: "{kind} {when}.",
    on: "on {weekday} {date}",
    range: "from {start} to {end}",
    series: "A round of {series}.",
    closer: "Date, venue on the map and other races nearby.",
  },
  cs: {
    lead: "{kind} – {when}, {place} ({country}).",
    leadNoPlace: "{kind} – {when}.",
    on: "{weekday} {date}",
    range: "{start}{dash}{end}",
    series: "Kolo seriálu {series}.",
    closer: "Termín, místo na mapě a další závody v okolí.",
  },
  sk: {
    lead: "{kind} – {when}, {place} ({country}).",
    leadNoPlace: "{kind} – {when}.",
    on: "{weekday} {date}",
    range: "{start}{dash}{end}",
    series: "Kolo seriálu {series}.",
    closer: "Termín, miesto na mape a ďalšie preteky v okolí.",
  },
  pl: {
    lead: "{kind} – {when}, {place} ({country}).",
    leadNoPlace: "{kind} – {when}.",
    on: "{weekday}, {date}",
    range: "{start}{dash}{end}",
    series: "Runda cyklu {series}.",
    closer: "Termin, miejsce na mapie i inne wyścigi w okolicy.",
  },
  de: {
    lead: "{kind} {when} in {place} ({country}).",
    leadNoPlace: "{kind} {when}.",
    on: "am {weekday}, {date}",
    range: "vom {start} bis {end}",
    series: "Ein Lauf der Serie {series}.",
    closer: "Termin, Ort auf der Karte und weitere Rennen in der Nähe.",
  },
};

/** Search shows about sixty characters of a title and a hundred and sixty of a description. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/**
 * The first day of a range, saying only what the last day does not:
 * "5." for 5–6 September, "31. října" for 31 October – 1 November.
 */
function rangeStart(start: string, end: string, locale: Locale): string {
  const dotted = locale === "cs" || locale === "sk" || locale === "de";
  const pattern =
    start.slice(0, 7) === end.slice(0, 7)
      ? dotted ? "d." : "d"
      : start.slice(0, 4) === end.slice(0, 4)
        ? dotted ? "d. MMMM" : "d MMMM"
        : null;
  return pattern ? format(parseISO(start), pattern, { locale: dateFnsLocale(locale) }) : longDate(start, locale);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Title for search: the race and its year, then the kind of race and the town
 * — "Jihlavský HROT 2026 – MTB závod, Jihlava" — what someone types when they
 * look for it. A part the name already says is not said twice, and a part
 * that does not fit is dropped rather than cut off mid-word by the results page.
 */
export function raceTitle(event: EventListItem, locale: Locale): string {
  const year = event.startDate.slice(0, 4);
  let name = shortName(unshout(event.name.trim()), 52);
  if (!name.includes(year) && !/\b20\d\d\b/.test(name)) name = `${name} ${year}`;
  const kind = raceKind(event, locale);
  const place = placeOf(event);
  // Asked of the name as the title shows it: a word cut off with the rest of
  // a long name is no longer said by it.
  const withKind = !nameSaysKind(name, kind);
  const withPlace = Boolean(place) && !nameSaysPlace(name, place!);
  const tail = (k: boolean, p: boolean) => {
    if (locale === "en" || locale === "de") {
      return [k ? kind : null, p ? (k ? `in ${place}` : place) : null].filter(Boolean).join(" ");
    }
    return [k ? kind : null, p ? place : null].filter(Boolean).join(", ");
  };
  const options = [tail(withKind, withPlace), tail(withKind, false), tail(false, withPlace)].filter(Boolean);
  for (const t of options) {
    const title = `${name} – ${t}`;
    if (title.length <= TITLE_MAX) return title;
  }
  return name;
}

/**
 * Description for search: sentences, not a list of labels. It used to read
 * "19. 9. 2026 · Thale · MTB. Přihlášky." — thirty-odd characters that told
 * nobody why to click. Facts go in by how much a rider needs them (when and
 * where, then entry, classes, series, regulations), each as a whole sentence,
 * until the snippet is full.
 */
export function raceDescription(event: EventListItem & { registrationClosesAt?: string | null }, locale: Locale): string {
  const c = raceCopy[locale];
  const w = SNIPPET[locale];
  const df = { locale: dateFnsLocale(locale) };
  const place = placeOf(event);
  const country = event.location?.countryCode ? countryDisplayName(event.location.countryCode, locale) : "";
  const multiDay = Boolean(event.endDate && event.endDate !== event.startDate);
  const when = multiDay
    ? fill(w.range, {
        start: rangeStart(event.startDate, event.endDate!, locale),
        end: longDate(event.endDate!, locale),
        // "5.–6. září", but "31. října – 1. listopadu".
        dash: event.startDate.slice(0, 7) === event.endDate!.slice(0, 7) ? "–" : " – ",
      })
    : fill(w.on, { weekday: format(parseISO(event.startDate), "EEEE", df), date: longDate(event.startDate, locale) });
  const kind = capitalize(raceKind(event, locale));
  const lead = place && country
    ? fill(w.lead, { kind, when, place, country })
    : fill(w.leadNoPlace, { kind, when });

  const today = new Date().toISOString().slice(0, 10);
  const past = (event.endDate ?? event.startDate) < today;
  const entry = past
    ? c.taken
    : event.registrationUrl
      ? event.registrationClosesAt && event.registrationClosesAt.slice(0, 10) >= today
        ? fill(c.entryUntil, { date: longDate(event.registrationClosesAt.slice(0, 10), locale) })
        : c.entryOnline
      : null;
  const classes = event.ageConfidence === "explicit" && event.ageCategories.length
    ? fill(c.forWhom, { classes: event.ageCategories.map((a) => ageCategoryLabel(a, locale)).join(", ") })
    : null;
  const series = event.series ? fill(w.series, { series: event.series.name }) : null;
  const regulations = event.regulationsUrl ? c.regsAvailable : null;

  let out = lead;
  for (const sentence of [entry, classes, series, regulations, w.closer]) {
    if (sentence && out.length + 1 + sentence.length <= DESCRIPTION_MAX) out += ` ${sentence}`;
  }
  return out;
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

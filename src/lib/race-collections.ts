import type { EventListItem } from "@/lib/events";
import type { Locale } from "@/lib/i18n/messages";
import { ageCategoryMatch, matchesDisciplineFilter } from "@/lib/taxonomy";
import { addDaysIso } from "@/lib/seo-race-copy";
import { counted, fillCopy } from "@/lib/seo";

export const COLLECTION_SLUGS = ["cz-2027", "cz-mtb-2027", "kids-2027", "weekend", "kids-weekend", "kids", "youth", "amateur"] as const;
export type CollectionSlug = (typeof COLLECTION_SLUGS)[number];
export const MIN_COLLECTION_RACES = 8;

type CollectionText = { label: string; title: string; description: string; note: string };
type CollectionCopy = {
  heading: string;
  browseIntro: string;
  allCountries: string;
  emptyTitle: string;
  emptyDescription: string;
  showAll: string;
  period: string;
  collections: Record<CollectionSlug, CollectionText>;
};

export const collectionCopy: Record<Locale, CollectionCopy> = {
  cs: {
    heading: "Kolekce závodů",
    browseIntro: "Vyber si závody podle země, věku nebo plánu na víkend. Termíny, místa, kategorie a přihlášky na jednom místě.",
    allCountries: "Všechny země",
    emptyTitle: "Zatím tu není žádný závod",
    emptyDescription: "Zkus stejnou kolekci ve všech zemích nebo si prohlédni ostatní závody v okolí.",
    showAll: "Procházet všechny závody",
    period: "{count} · {from}–{to}",
    collections: {
      "cz-2027": {"label": "Česko 2027", "title": "Cyklistické závody v Česku 2027", "description": "Celý rok českých cyklistických závodů: termíny, místa, disciplíny, známé vzdálenosti a kategorie.", "note": "Přehled od 1. ledna do 31. prosince 2027, včetně již uplynulých závodů tohoto ročníku. Počty popisují náš katalog, nikoli všechny existující závody."},
      "cz-mtb-2027": {"label": "MTB Česko 2027", "title": "MTB závody v Česku 2027", "description": "Horské kolo v Česku v roce 2027: XC, maratony, enduro, sjezd, fourcross i MTBO, s termíny a místy.", "note": "Celý kalendářní rok 2027 pro MTB disciplíny. Jednotlivé závody odlišujeme podle disciplíny; podmínky a kategorie najdeš v detailu."},
      "kids-2027": {"label": "Děti 2027", "title": "Dětské cyklistické závody 2027 {in}", "description": "Dětské závody pro celý rok 2027 {in}: doložené kategorie, termíny, místa a přihlášky.", "note": "Celý rok 2027, pouze závody se zveřejněnými dětskými kategoriemi zhruba do 11 let. Loňské a odhadnuté kategorie do tohoto výběru nezařazujeme."},

      kids: { label: "Děti", title: "Cyklistické závody pro děti {in}", description: "Závody s kategoriemi pro děti do 11 let {in}: MTB, silnice i cyklokros. Termíny, místa, kategorie a odkazy na přihlášky.", note: "Vybíráme jen závody s potvrzenými dětskými kategoriemi (zhruba do 11 let, U7–U11). Přesné věkové rozdělení najdeš v detailu závodu a v propozicích pořadatele." },
      "kids-weekend": { label: "Děti tento víkend", title: "Dětské cyklistické závody tento víkend {in}", description: "Závody s dětskými kategoriemi, které startují tento víkend {in}. Termíny, místa a odkazy na přihlášky na jednom místě.", note: "Závody s potvrzenými dětskými kategoriemi (zhruba do 11 let), které startují tuto sobotu nebo neděli. Přehled se každý týden posune na aktuální víkend." },
      youth: { label: "Mládež", title: "Cyklistické závody pro mládež {in}", description: "Závody s kategoriemi pro žáky a kadety {in}: MTB, silnice i cyklokros. Termíny, místa, kategorie a odkazy na přihlášky.", note: "Vybíráme závody s potvrzenými mládežnickými kategoriemi (žáci a kadeti, zhruba U13–U17). Přesné věkové rozdělení najdeš v detailu závodu a v propozicích pořadatele." },
      amateur: { label: "Amatéři a hobby", title: "Amatérské cyklistické závody {in}", description: "Amatérské a hobby cyklistické závody {in}: MTB, silnice i gravel. Termíny, místa a odkazy na přihlášky a propozice.", note: "Závody pro amatéry a podniky s potvrzenou hobby kategorií. Podmínky účasti a případnou licenci si ověř v propozicích pořadatele." },
      weekend: { label: "Tento víkend", title: "Cyklistické závody tento víkend {in}", description: "Cyklistické závody se startem tento víkend {in}. Porovnej termíny, místa, disciplíny a kategorie a vyber si, kam vyrazit.", note: "Závody, které startují tuto sobotu nebo neděli. Přehled se každý týden posune na aktuální víkend." },
    },
  },
  en: {
    heading: "Race collections",
    browseIntro: "Choose races by country, age group or weekend plans. Dates, places, categories and entry links in one place.",
    allCountries: "All countries",
    emptyTitle: "No races here yet",
    emptyDescription: "Try this collection across all countries, or browse other races nearby.",
    showAll: "Browse all races",
    period: "{count} · {from}–{to}",
    collections: {
      "cz-2027": {"label": "Czechia 2027", "title": "Cycling races in Czechia 2027", "description": "A full year of Czech cycling races: dates, places, disciplines, known distances and categories.", "note": "1 January through 31 December 2027, including races already held in this edition. Counts describe our catalogue, not every race in existence."},
      "cz-mtb-2027": {"label": "MTB Czechia 2027", "title": "MTB races in Czechia 2027", "description": "Mountain bike racing in Czechia in 2027: XC, marathons, enduro, downhill, four-cross and MTBO, with dates and venues.", "note": "The full 2027 calendar year for MTB disciplines. Each race identifies its discipline; check its detail for categories and entry conditions."},
      "kids-2027": {"label": "Kids 2027", "title": "Kids’ cycling races 2027 {in}", "description": "Children’s races for the whole of 2027 {in}: stated categories, dates, places and entry links.", "note": "The full year 2027, with stated categories for children roughly up to 11. Previous-edition and guessed categories are excluded."},

      kids: { label: "Kids", title: "Kids' cycling races {in}", description: "Races with categories for children up to 11 {in}: MTB, road and cyclocross. Dates, venues, categories and entry links.", note: "Only races with confirmed children's categories (roughly up to 11, U7–U11). Find the exact age groups on the race page and in the organiser's regulations." },
      "kids-weekend": { label: "Kids this weekend", title: "Kids' cycling races this weekend {in}", description: "Races with children's categories starting this weekend {in}. Dates, venues and entry links in one place.", note: "Races with confirmed children's categories (roughly up to 11) starting this Saturday or Sunday. The collection moves to the current weekend each week." },
      youth: { label: "Youth", title: "Youth cycling races {in}", description: "Races with youth categories {in}: MTB, road and cyclocross. Dates, venues, age categories and entry links.", note: "Races with confirmed youth categories (roughly U13–U17). Find the exact age groups on the race page and in the organiser's regulations." },
      amateur: { label: "Amateur racing", title: "Amateur cycling races {in}", description: "Amateur cycling races {in}: MTB, road and gravel. Dates, venues and links to entry and regulations.", note: "Amateur races and events with a confirmed amateur category. Check the organiser's regulations for entry conditions and licence requirements." },
      weekend: { label: "This weekend", title: "Cycling races this weekend {in}", description: "Cycling races starting this weekend {in}. Compare dates, places, disciplines and categories and choose where to race.", note: "Races starting this Saturday or Sunday. The collection moves to the current weekend each week." },
    },
  },
  sk: {
    heading: "Kolekcie pretekov",
    browseIntro: "Vyber si preteky podľa krajiny, veku alebo plánov na víkend. Termíny, miesta, kategórie a prihlášky na jednom mieste.",
    allCountries: "Všetky krajiny",
    emptyTitle: "Zatiaľ tu nie sú žiadne preteky",
    emptyDescription: "Skús túto kolekciu vo všetkých krajinách alebo si pozri ďalšie preteky v okolí.",
    showAll: "Prehliadať všetky preteky",
    period: "{count} · {from}–{to}",
    collections: {
      "cz-2027": {"label": "Česko 2027", "title": "Cyklistické preteky v Česku 2027", "description": "Celý rok českých cyklistických pretekov: termíny, miesta, disciplíny, známe vzdialenosti a kategórie.", "note": "Od 1. januára do 31. decembra 2027 vrátane už skončených pretekov ročníka. Počty opisujú náš katalóg."},
      "cz-mtb-2027": {"label": "MTB Česko 2027", "title": "MTB preteky v Česku 2027", "description": "MTB v Česku v roku 2027: XC, maratóny, enduro, zjazd, fourcross aj MTBO.", "note": "Celý kalendárny rok 2027 pre MTB disciplíny. Podmienky a kategórie nájdeš v detaile pretekov."},
      "kids-2027": {"label": "Deti 2027", "title": "Detské cyklistické preteky 2027 {in}", "description": "Detské preteky na celý rok 2027 {in}: zverejnené kategórie, termíny, miesta a prihlášky.", "note": "Celý rok 2027, len preteky so zverejnenými kategóriami približne do 11 rokov. Minuloročné a odhadnuté kategórie nezaraďujeme."},

      kids: { label: "Deti", title: "Cyklistické preteky pre deti {in}", description: "Preteky s kategóriami pre deti do 11 rokov {in}: MTB, cesta aj cyklokros. Termíny, miesta, kategórie a odkazy na prihlášky.", note: "Vyberáme len preteky s potvrdenými detskými kategóriami (zhruba do 11 rokov, U7–U11). Presné vekové rozdelenie nájdeš v detaile pretekov a v propozíciách organizátora." },
      "kids-weekend": { label: "Deti tento víkend", title: "Detské cyklistické preteky tento víkend {in}", description: "Preteky s detskými kategóriami, ktoré štartujú tento víkend {in}. Termíny, miesta a odkazy na prihlášky na jednom mieste.", note: "Preteky s potvrdenými detskými kategóriami (zhruba do 11 rokov), ktoré štartujú túto sobotu alebo nedeľu. Prehľad sa každý týždeň posunie na aktuálny víkend." },
      youth: { label: "Mládež", title: "Cyklistické preteky pre mládež {in}", description: "Preteky s kategóriami pre žiakov a kadetov {in}: MTB, cesta aj cyklokros. Termíny, miesta, kategórie a odkazy na prihlášky.", note: "Vyberáme preteky s potvrdenými mládežníckymi kategóriami (žiaci a kadeti, zhruba U13–U17). Presné vekové rozdelenie nájdeš v detaile pretekov a v propozíciách organizátora." },
      amateur: { label: "Amatéri a hobby", title: "Amatérske cyklistické preteky {in}", description: "Amatérske a hobby cyklistické preteky {in}: MTB, cesta aj gravel. Termíny, miesta a odkazy na prihlášky a propozície.", note: "Preteky pre amatérov a podujatia s potvrdenou hobby kategóriou. Podmienky účasti a prípadnú licenciu si over v propozíciách organizátora." },
      weekend: { label: "Tento víkend", title: "Cyklistické preteky tento víkend {in}", description: "Cyklistické preteky so štartom tento víkend {in}. Porovnaj termíny, miesta, disciplíny a kategórie a vyber si, kam vyraziť.", note: "Preteky, ktoré štartujú túto sobotu alebo nedeľu. Prehľad sa každý týždeň posunie na aktuálny víkend." },
    },
  },
  pl: {
    heading: "Kolekcje wyścigów",
    browseIntro: "Wybierz wyścigi według kraju, kategorii wiekowej lub planów na weekend. Terminy, miejsca, kategorie i zapisy w jednym miejscu.",
    allCountries: "Wszystkie kraje",
    emptyTitle: "Nie ma tu jeszcze wyścigów",
    emptyDescription: "Sprawdź tę kolekcję we wszystkich krajach lub zobacz inne wyścigi w okolicy.",
    showAll: "Przeglądaj wszystkie wyścigi",
    period: "{count} · {from}–{to}",
    collections: {
      "cz-2027": {"label": "Czechy 2027", "title": "Wyścigi kolarskie w Czechach 2027", "description": "Cały rok czeskich wyścigów: terminy, miejsca, dyscypliny, znane dystanse i kategorie.", "note": "Od 1 stycznia do 31 grudnia 2027, także rozegrane wyścigi tego sezonu. Liczby opisują nasz katalog."},
      "cz-mtb-2027": {"label": "MTB Czechy 2027", "title": "Wyścigi MTB w Czechach 2027", "description": "MTB w Czechach w 2027 roku: XC, maratony, enduro, downhill, four-cross i MTBO.", "note": "Pełny rok kalendarzowy 2027 dla dyscyplin MTB. Kategorie i warunki udziału znajdziesz w szczegółach wyścigu."},
      "kids-2027": {"label": "Dzieci 2027", "title": "Wyścigi kolarskie dla dzieci 2027 {in}", "description": "Wyścigi dziecięce na cały rok 2027 {in}: opublikowane kategorie, terminy, miejsca i zapisy.", "note": "Cały rok 2027, tylko opublikowane kategorie dla dzieci do około 11 lat. Pomijamy kategorie zeszłoroczne i domniemane."},

      kids: { label: "Dzieci", title: "Wyścigi kolarskie dla dzieci {in}", description: "Wyścigi z kategoriami dla dzieci do 11 lat {in}: MTB, szosa i przełaje. Terminy, miejsca, kategorie i linki do zapisów.", note: "Tylko wyścigi z potwierdzonymi kategoriami dziecięcymi (mniej więcej do 11 lat, U7–U11). Dokładne grupy wiekowe znajdziesz na stronie wyścigu i w regulaminie organizatora." },
      "kids-weekend": { label: "Dzieci w ten weekend", title: "Wyścigi dla dzieci w ten weekend {in}", description: "Wyścigi z kategoriami dziecięcymi ze startem w ten weekend {in}. Terminy, miejsca i linki do zapisów w jednym miejscu.", note: "Wyścigi z potwierdzonymi kategoriami dziecięcymi (mniej więcej do 11 lat) startujące w tę sobotę lub niedzielę. Kolekcja jest co tydzień aktualizowana na bieżący weekend." },
      youth: { label: "Młodzież", title: "Wyścigi kolarskie dla młodzieży {in}", description: "Wyścigi z kategoriami młodzieżowymi {in}: MTB, szosa i przełaje. Terminy, miejsca, kategorie wiekowe i linki do zapisów.", note: "Wyścigi z potwierdzonymi kategoriami młodzieżowymi (żacy i kadeci, mniej więcej U13–U17). Dokładne grupy wiekowe znajdziesz na stronie wyścigu i w regulaminie organizatora." },
      amateur: { label: "Wyścigi amatorskie", title: "Amatorskie wyścigi kolarskie {in}", description: "Amatorskie wyścigi kolarskie {in}: MTB, szosa i gravel. Terminy, miejsca oraz linki do zapisów i regulaminów.", note: "Wyścigi amatorskie i imprezy z potwierdzoną kategorią amatorską. Warunki udziału i wymagania dotyczące licencji sprawdź w regulaminie organizatora." },
      weekend: { label: "Ten weekend", title: "Wyścigi kolarskie w ten weekend {in}", description: "Wyścigi kolarskie ze startem w ten weekend {in}. Porównaj terminy, miejsca, dyscypliny i kategorie i wybierz swój wyścig.", note: "Wyścigi startujące w tę sobotę lub niedzielę. Kolekcja jest co tydzień aktualizowana na bieżący weekend." },
    },
  },
  de: {
    heading: "Rennsammlungen",
    browseIntro: "Wähle Rennen nach Land, Altersklasse oder Wochenendplänen. Termine, Orte, Klassen und Anmeldelinks an einem Ort.",
    allCountries: "Alle Länder",
    emptyTitle: "Hier gibt es noch keine Rennen",
    emptyDescription: "Sieh dir diese Sammlung für alle Länder an oder entdecke andere Rennen in der Nähe.",
    showAll: "Alle Rennen entdecken",
    period: "{count} · {from}–{to}",
    collections: {
      "cz-2027": {"label": "Tschechien 2027", "title": "Radrennen in Tschechien 2027", "description": "Ein ganzes Jahr tschechischer Radrennen: Termine, Orte, Disziplinen, bekannte Streckenlängen und Kategorien.", "note": "1. Januar bis 31. Dezember 2027, einschließlich bereits ausgetragener Rennen dieses Jahrgangs. Die Zahlen beschreiben unseren Katalog."},
      "cz-mtb-2027": {"label": "MTB Tschechien 2027", "title": "MTB-Rennen in Tschechien 2027", "description": "MTB in Tschechien 2027: XC, Marathon, Enduro, Downhill, Fourcross und MTBO.", "note": "Das ganze Kalenderjahr 2027 für MTB-Disziplinen. Kategorien und Teilnahmebedingungen stehen beim jeweiligen Rennen."},
      "kids-2027": {"label": "Kinder 2027", "title": "Kinderradrennen 2027 {in}", "description": "Kinderrennen für das ganze Jahr 2027 {in}: veröffentlichte Kategorien, Termine, Orte und Anmeldung.", "note": "Das ganze Jahr 2027, nur veröffentlichte Kategorien für Kinder bis etwa elf Jahre. Vorjahresangaben und Vermutungen sind ausgeschlossen."},

      kids: { label: "Kinder", title: "Radrennen für Kinder {in}", description: "Rennen mit Klassen für Kinder bis 11 Jahre {in}: MTB, Straße und Cyclocross. Termine, Orte, Klassen und Anmeldelinks.", note: "Nur Rennen mit bestätigten Kinderklassen (etwa bis 11 Jahre, U7–U11). Die genauen Altersgruppen findest du auf der Rennseite und in der Ausschreibung des Veranstalters." },
      "kids-weekend": { label: "Kinder dieses Wochenende", title: "Kinderradrennen dieses Wochenende {in}", description: "Rennen mit Kinderklassen, die dieses Wochenende {in} starten. Termine, Orte und Anmeldelinks an einem Ort.", note: "Rennen mit bestätigten Kinderklassen (etwa bis 11 Jahre), die diesen Samstag oder Sonntag starten. Die Sammlung wird jede Woche auf das aktuelle Wochenende umgestellt." },
      youth: { label: "Jugend", title: "Radrennen für Jugendliche {in}", description: "Rennen mit Jugendklassen {in}: MTB, Straße und Cyclocross. Termine, Orte, Altersklassen und Anmeldelinks.", note: "Rennen mit bestätigten Jugendklassen (Schüler und Jugend, etwa U13–U17). Die genauen Altersgruppen findest du auf der Rennseite und in der Ausschreibung des Veranstalters." },
      amateur: { label: "Amateure und Hobby", title: "Amateur- und Hobbyradrennen {in}", description: "Amateur- und Hobbyradrennen {in}: MTB, Straße und Gravel. Termine, Orte und Links zu Anmeldung und Ausschreibung.", note: "Amateurrennen und Veranstaltungen mit bestätigter Hobbyklasse. Prüfe die Teilnahmebedingungen und Lizenzanforderungen in der Ausschreibung." },
      weekend: { label: "Dieses Wochenende", title: "Radrennen dieses Wochenende {in}", description: "Radrennen mit Start an diesem Wochenende {in}. Vergleiche Termine, Orte, Disziplinen und Klassen und wähle dein Rennen.", note: "Rennen, die diesen Samstag oder Sonntag starten. Die Sammlung wird jede Woche auf das aktuelle Wochenende umgestellt." },
    },
  },
};

export function isCollectionSlug(slug: string): slug is CollectionSlug {
  return (COLLECTION_SLUGS as readonly string[]).includes(slug);
}

export type CollectionWindow = { today: string; from: string; to: string; weekendFrom: string; weekendTo: string };

/** Calendar days in the site's home timezone, including Sunday’s Saturday. */
export function collectionWindow(now = new Date()): CollectionWindow {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const weekendFrom = addDaysIso(today, day === 0 ? -1 : 6 - day);
  return { today, from: weekendFrom < today ? weekendFrom : today, to: addDaysIso(today, 365), weekendFrom, weekendTo: addDaysIso(weekendFrom, 1) };
}

/** Weekend collections cover this Saturday and Sunday; the rest the next twelve months. */
export function collectionDates(slug: CollectionSlug, window: CollectionWindow): { from: string; to: string } {
  if (isSeasonCollection(slug)) return { from: "2027-01-01", to: "2027-12-31" };
  return slug === "weekend" || slug === "kids-weekend" ? { from: window.weekendFrom, to: window.weekendTo } : { from: window.today, to: window.to };
}

/** Kids are the youngest bands only (U7–U11); youth (U13–U17) is its own collection. */
export function collectionAgeCategories(slug: CollectionSlug): string[] | undefined {
  if (slug === "kids" || slug === "kids-weekend" || slug === "kids-2027") return ["kids"];
  if (slug === "youth") return ["youth"];
  return undefined;
}

export function belongsToCollection(event: EventListItem, slug: CollectionSlug, window: CollectionWindow): boolean {
  const { from, to } = collectionDates(slug, window);
  if (event.startDate < from || event.startDate > to) return false;
  const fixed = collectionFixedCountry(slug);
  if (fixed && event.location?.countryCode !== fixed) return false;
  if (slug === "cz-2027") return true;
  if (slug === "cz-mtb-2027") return matchesDisciplineFilter(event.disciplines, ["mtb"]);
  const ages = collectionAgeCategories(slug);
  if (ages) return ageCategoryMatch(event, ages) === "match";
  if (slug === "weekend") return true;
  return event.level === "amateur" || event.competitionType === "amateur" || ageCategoryMatch(event, ["amateur"]) === "match";
}

export function collectionPeriod(slug: CollectionSlug, count: number, locale: Locale, window: CollectionWindow): string {
  const format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
  const { from, to } = collectionDates(slug, window);
  return fillCopy(collectionCopy[locale].period, { count: counted(count, "race", locale), from: format.format(new Date(`${from}T12:00:00Z`)), to: format.format(new Date(`${to}T12:00:00Z`)) });
}

/** Curated season collections, not arbitrary year/filter combinations. */
export function isSeasonCollection(slug: CollectionSlug) { return ["cz-2027", "cz-mtb-2027", "kids-2027"].includes(slug); }
export function collectionFixedCountry(slug: CollectionSlug) { return slug === "cz-2027" || slug === "cz-mtb-2027" ? "CZ" : undefined; }
